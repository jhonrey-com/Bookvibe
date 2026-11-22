use serde::Serialize;
use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpListener, TcpStream, UdpSocket};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const MAX_SYNC_PAYLOAD_BYTES: usize = 50 * 1024 * 1024;
const MAX_HTTP_HEADER_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanSessionInfo {
    pub host_ip: String,
    pub port: u16,
    pub pin: String,
    pub host_name: String,
    pub active: bool,
    pub incoming_count: usize,
}

struct LanHostInner {
    active: Arc<AtomicBool>,
    host_ip: String,
    port: u16,
    pin: String,
    host_name: String,
    #[allow(dead_code)]
    book_json: Arc<Mutex<String>>,
    incoming_queue: Arc<Mutex<VecDeque<String>>>,
}

static LAN_HOST_SLOT: OnceLock<Mutex<Option<LanHostInner>>> = OnceLock::new();

fn host_slot() -> &'static Mutex<Option<LanHostInner>> {
    LAN_HOST_SLOT.get_or_init(|| Mutex::new(None))
}

pub fn constant_time_eq(a: &str, b: &str) -> bool {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    let max_len = ab.len().max(bb.len());
    let mut diff: u8 = if ab.len() == bb.len() { 0 } else { 1 };
    for i in 0..max_len {
        let x = if i < ab.len() { ab[i] } else { 0 };
        let y = if i < bb.len() { bb[i] } else { 0 };
        diff |= x ^ y;
    }
    diff == 0
}

/// Strictly restrict LAN sync connections to RFC1918 private LAN or localhost (blocks SSRF).
pub fn is_allowed_lan_ipv4(ip: Ipv4Addr) -> bool {
    if ip.is_loopback() {
        return true;
    }
    let octets = ip.octets();
    // 10.0.0.0/8
    if octets[0] == 10 {
        return true;
    }
    // 172.16.0.0/12
    if octets[0] == 172 && (16..=31).contains(&octets[1]) {
        return true;
    }
    // 192.168.0.0/16
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }
    false
}

pub fn parse_allowed_lan_addr(peer_addr: &str) -> Result<SocketAddrV4, String> {
    let trimmed = peer_addr.trim();
    let parsed: SocketAddrV4 = trimmed
        .parse()
        .map_err(|_| String::from("Peer address must be IPv4:PORT (e.g. 192.168.1.24:48321)."))?;
    if parsed.port() == 0 {
        return Err(String::from("Peer port must be between 1 and 65535."));
    }
    if !is_allowed_lan_ipv4(*parsed.ip()) {
        return Err(String::from(
            "Blocked non-LAN IP address. Only private Wi-Fi LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x) and 127.0.0.1 are permitted.",
        ));
    }
    Ok(parsed)
}

pub fn get_local_lan_ip() -> String {
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        // Non-sending connect determines the active local Wi-Fi/LAN interface address
        if socket.connect("192.168.255.254:9").is_ok() {
            if let Ok(local_addr) = socket.local_addr() {
                if let std::net::IpAddr::V4(v4) = local_addr.ip() {
                    if !v4.is_unspecified() {
                        return v4.to_string();
                    }
                }
            }
        }
    }
    String::from("127.0.0.1")
}

fn generate_six_digit_pin() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64 ^ d.as_secs())
        .unwrap_or(482913);
    let mixed = nanos.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let pin_num = ((mixed >> 16) % 900_000) + 100_000;
    format!("{pin_num:06}")
}

fn read_http_message(stream: &mut TcpStream) -> Result<(String, String, Option<String>, Vec<u8>), String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(6)));
    let mut buf = Vec::with_capacity(4096);
    let mut tmp = [0u8; 4096];
    let mut header_end: Option<usize> = None;

    while header_end.is_none() {
        let n = stream.read(&mut tmp).map_err(|e| format!("Socket read error: {e}"))?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&tmp[..n]);
        if buf.len() > MAX_HTTP_HEADER_BYTES {
            return Err(String::from("HTTP headers too large."));
        }
        if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            header_end = Some(pos);
        }
    }

    let hdr_end = header_end.ok_or_else(|| String::from("Malformed HTTP headers."))?;
    let header_str = String::from_utf8_lossy(&buf[..hdr_end]).to_string();
    let mut lines = header_str.lines();
    let first_line = lines.next().ok_or_else(|| String::from("Empty HTTP request."))?;
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("").to_string();

    let mut content_length: usize = 0;
    let mut pin_header: Option<String> = None;

    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_ascii_lowercase();
            let val = v.trim().to_string();
            if key == "content-length" {
                content_length = val.parse::<usize>().unwrap_or(0);
                if content_length > MAX_SYNC_PAYLOAD_BYTES {
                    return Err(String::from("Payload exceeds 50 MB limit."));
                }
            } else if key == "x-bookvibe-pin" {
                pin_header = Some(val);
            }
        }
    }

    let body_start = hdr_end + 4;
    let mut body = Vec::with_capacity(content_length);
    if buf.len() > body_start {
        body.extend_from_slice(&buf[body_start..]);
    }
    while body.len() < content_length {
        let n = stream.read(&mut tmp).map_err(|e| format!("Socket body read error: {e}"))?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&tmp[..n]);
        if body.len() > MAX_SYNC_PAYLOAD_BYTES {
            return Err(String::from("Payload exceeds 50 MB limit."));
        }
    }
    body.truncate(content_length);

    Ok((method, target, pin_header, body))
}

fn write_http_response(stream: &mut TcpStream, status: &str, body: &str) {
    let bytes = body.as_bytes();
    let resp = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        bytes.len()
    );
    let _ = stream.write_all(resp.as_bytes());
    let _ = stream.write_all(bytes);
    let _ = stream.flush();
}

pub fn start_lan_sync_host(
    book_json: String,
    host_name: String,
    port: Option<u16>,
) -> Result<LanSessionInfo, String> {
    if book_json.len() > MAX_SYNC_PAYLOAD_BYTES {
        return Err(String::from("Book payload exceeds 50 MB limit."));
    }
    stop_lan_sync_host();

    let requested_port = port.unwrap_or(0);
    let listener = TcpListener::bind(("0.0.0.0", requested_port))
        .map_err(|e| format!("Unable to open LAN port: {e}"))?;
    let actual_port = listener
        .local_addr()
        .map_err(|e| format!("Failed reading bound port: {e}"))?
        .port();
    let _ = listener.set_nonblocking(true);

    let pin = generate_six_digit_pin();
    let host_ip = get_local_lan_ip();
    let active = Arc::new(AtomicBool::new(true));
    let shared_book = Arc::new(Mutex::new(book_json));
    let incoming_queue = Arc::new(Mutex::new(VecDeque::new()));

    let active_clone = Arc::clone(&active);
    let book_clone = Arc::clone(&shared_book);
    let queue_clone = Arc::clone(&incoming_queue);
    let pin_clone = pin.clone();

    thread::spawn(move || {
        while active_clone.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((mut stream, _addr)) => {
                    if let Ok((method, target, supplied_pin, body)) = read_http_message(&mut stream) {
                        let pin_ok = supplied_pin
                            .as_deref()
                            .map(|p| constant_time_eq(p, &pin_clone))
                            .unwrap_or(false);
                        if !pin_ok {
                            write_http_response(&mut stream, "403 Forbidden", r#"{"error":"Invalid PIN"}"#);
                            continue;
                        }
                        if method == "GET" && target == "/api/book" {
                            let snapshot = book_clone
                                .lock()
                                .map(|g| g.clone())
                                .unwrap_or_else(|_| String::from("{}"));
                            write_http_response(&mut stream, "200 OK", &snapshot);
                        } else if method == "POST" && target == "/api/push" {
                            if let Ok(incoming_str) = String::from_utf8(body) {
                                if let Ok(mut q) = queue_clone.lock() {
                                    if q.len() < 16 {
                                        q.push_back(incoming_str);
                                    }
                                }
                                write_http_response(&mut stream, "200 OK", r#"{"ok":true}"#);
                            } else {
                                write_http_response(&mut stream, "400 Bad Request", r#"{"error":"Invalid UTF-8"}"#);
                            }
                        } else {
                            write_http_response(&mut stream, "404 Not Found", r#"{"error":"Not found"}"#);
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(60));
                }
                Err(_) => break,
            }
        }
    });

    let info = LanSessionInfo {
        host_ip: host_ip.clone(),
        port: actual_port,
        pin: pin.clone(),
        host_name: host_name.clone(),
        active: true,
        incoming_count: 0,
    };

    if let Ok(mut guard) = host_slot().lock() {
        *guard = Some(LanHostInner {
            active,
            host_ip,
            port: actual_port,
            pin,
            host_name,
            book_json: shared_book,
            incoming_queue,
        });
    }

    Ok(info)
}

pub fn stop_lan_sync_host() {
    if let Ok(mut guard) = host_slot().lock() {
        if let Some(prev) = guard.take() {
            prev.active.store(false, Ordering::Relaxed);
        }
    }
}

pub fn get_lan_sync_status() -> Option<LanSessionInfo> {
    let guard = host_slot().lock().ok()?;
    let inner = guard.as_ref()?;
    let incoming_count = inner.incoming_queue.lock().map(|q| q.len()).unwrap_or(0);
    Some(LanSessionInfo {
        host_ip: inner.host_ip.clone(),
        port: inner.port,
        pin: inner.pin.clone(),
        host_name: inner.host_name.clone(),
        active: inner.active.load(Ordering::Relaxed),
        incoming_count,
    })
}

pub fn poll_lan_incoming_sync() -> Option<String> {
    let guard = host_slot().lock().ok()?;
    let inner = guard.as_ref()?;
    let mut q = inner.incoming_queue.lock().ok()?;
    q.pop_front()
}

pub fn pull_book_from_lan_peer(peer_addr: &str, pin: &str) -> Result<String, String> {
    let addr = parse_allowed_lan_addr(peer_addr)?;
    let clean_pin = pin.trim();
    if clean_pin.is_empty() {
        return Err(String::from("Enter the 6-digit pairing PIN from the host device."));
    }

    let mut stream = TcpStream::connect_timeout(&SocketAddr::V4(addr), Duration::from_secs(5))
        .map_err(|e| format!("Cannot reach peer {addr}: {e}"))?;
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let req = format!(
        "GET /api/book HTTP/1.1\r\nHost: {addr}\r\nX-Bookvibe-Pin: {clean_pin}\r\nConnection: close\r\n\r\n"
    );
    stream
        .write_all(req.as_bytes())
        .map_err(|e| format!("Failed sending LAN request: {e}"))?;
    stream.flush().ok();

    let (_, status_code, body) = read_http_response_from_peer(&mut stream)?;
    if status_code != 200 {
        return Err(format!("Peer rejected request (HTTP {status_code}). Verify the PIN."));
    }
    String::from_utf8(body).map_err(|_| String::from("Peer returned non-UTF-8 data."))
}

pub fn push_book_to_lan_peer(peer_addr: &str, pin: &str, book_json: &str) -> Result<String, String> {
    if book_json.len() > MAX_SYNC_PAYLOAD_BYTES {
        return Err(String::from("Book payload exceeds 50 MB limit."));
    }
    let addr = parse_allowed_lan_addr(peer_addr)?;
    let clean_pin = pin.trim();
    if clean_pin.is_empty() {
        return Err(String::from("Enter the 6-digit pairing PIN from the host device."));
    }

    let mut stream = TcpStream::connect_timeout(&SocketAddr::V4(addr), Duration::from_secs(5))
        .map_err(|e| format!("Cannot reach peer {addr}: {e}"))?;
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let bytes = book_json.as_bytes();
    let req = format!(
        "POST /api/push HTTP/1.1\r\nHost: {addr}\r\nX-Bookvibe-Pin: {clean_pin}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        bytes.len()
    );
    stream
        .write_all(req.as_bytes())
        .and_then(|_| stream.write_all(bytes))
        .map_err(|e| format!("Failed sending book to peer: {e}"))?;
    stream.flush().ok();

    let (_, status_code, body) = read_http_response_from_peer(&mut stream)?;
    if status_code != 200 {
        return Err(format!("Peer rejected push (HTTP {status_code}). Verify the PIN."));
    }
    Ok(String::from_utf8_lossy(&body).into_owned())
}

fn read_http_response_from_peer(stream: &mut TcpStream) -> Result<(String, u16, Vec<u8>), String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(8)));
    let mut raw = Vec::with_capacity(4096);
    let mut tmp = [0u8; 4096];
    loop {
        match stream.read(&mut tmp) {
            Ok(0) => break,
            Ok(n) => {
                raw.extend_from_slice(&tmp[..n]);
                if raw.len() > MAX_SYNC_PAYLOAD_BYTES {
                    return Err(String::from("Peer response exceeded 50 MB limit."));
                }
            }
            Err(e) => return Err(format!("Socket error reading peer response: {e}")),
        }
    }
    let split = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .ok_or_else(|| String::from("Malformed HTTP response from peer."))?;
    let hdr = String::from_utf8_lossy(&raw[..split]).to_string();
    let first_line = hdr.lines().next().unwrap_or("");
    let code = first_line
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(500);
    let body = raw[split + 4..].to_vec();
    Ok((hdr, code, body))
}

pub fn launch_os_bluetooth_share(file_path: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(ref p) = file_path {
            let trimmed = p.trim();
            if !trimmed.is_empty() {
                let _ = Command::new("explorer.exe").arg("/select,").arg(trimmed).spawn();
            }
        }
        let status = Command::new("fsquirt.exe").spawn();
        return match status {
            Ok(_) => Ok(String::from("Opened Windows Bluetooth File Transfer wizard (fsquirt.exe).")),
            Err(_) => Ok(String::from("Saved sync file. Send it via Windows Nearby Sharing or Bluetooth.")),
        };
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(ref p) = file_path {
            let _ = Command::new("open").arg("-R").arg(p).spawn();
        }
        return Ok(String::from("Revealed sync file in Finder. Right-click -> Share -> AirDrop or Bluetooth."));
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(ref p) = file_path {
            if let Some(parent) = std::path::Path::new(p).parent() {
                let _ = Command::new("xdg-open").arg(parent).spawn();
            }
        }
        return Ok(String::from("Opened sync folder. Send the .bookvibe file via Bluetooth or Nearby Share."));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_public_and_metadata_ips() {
        assert!(parse_allowed_lan_addr("127.0.0.1:48000").is_ok());
        assert!(parse_allowed_lan_addr("192.168.1.42:48000").is_ok());
        assert!(parse_allowed_lan_addr("10.0.0.5:48000").is_ok());
        assert!(parse_allowed_lan_addr("172.16.4.12:48000").is_ok());

        assert!(parse_allowed_lan_addr("169.254.169.254:80").is_err());
        assert!(parse_allowed_lan_addr("8.8.8.8:443").is_err());
        assert!(parse_allowed_lan_addr("172.32.0.1:8080").is_err());
    }

    #[test]
    fn constant_time_pin_matching() {
        assert!(constant_time_eq("482910", "482910"));
        assert!(!constant_time_eq("482910", "482911"));
        assert!(!constant_time_eq("482910", "48291"));
    }

    #[test]
    fn loopback_host_pull_and_push_round_trip() {
        let initial = String::from(r#"{"title":"Lan Book","parts":[]}"#);
        let session = start_lan_sync_host(initial.clone(), String::from("Desk-A"), None)
            .expect("host binds");
        let peer_addr = format!("127.0.0.1:{}", session.port);

        let pulled = pull_book_from_lan_peer(&peer_addr, &session.pin).expect("pulls ok");
        assert_eq!(pulled, initial);

        assert!(pull_book_from_lan_peer(&peer_addr, "000000").is_err());

        let pushed = String::from(r#"{"title":"Lan Book Revised","parts":[]}"#);
        push_book_to_lan_peer(&peer_addr, &session.pin, &pushed).expect("pushes ok");

        let queued = poll_lan_incoming_sync().expect("queued incoming sync");
        assert_eq!(queued, pushed);

        stop_lan_sync_host();
    }
}
