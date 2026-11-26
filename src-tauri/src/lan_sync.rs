use serde::Serialize;
use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpListener, TcpStream, UdpSocket};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const MAX_HTTP_HEADER_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanSessionInfo {
    pub host_ip: String,
    pub candidate_ips: Vec<String>,
    pub port: u16,
    pub pin: String,
    pub host_name: String,
    pub active: bool,
    pub incoming_count: usize,
}

struct LanHostInner {
    active: Arc<AtomicBool>,
    host_ip: String,
    candidate_ips: Vec<String>,
    port: u16,
    pin: String,
    host_name: String,
    book_json: Arc<Mutex<String>>,
    incoming_queue: Arc<Mutex<VecDeque<String>>>,
    handle: Option<thread::JoinHandle<()>>,
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
    let mut trimmed = peer_addr.trim();
    if let Some(rest) = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .or_else(|| trimmed.strip_prefix("HTTP://"))
        .or_else(|| trimmed.strip_prefix("HTTPS://"))
    {
        trimmed = rest;
    }
    trimmed = trimmed.trim_end_matches('/');

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

fn is_private_lan_ipv4(ip: Ipv4Addr) -> bool {
    !ip.is_loopback() && !ip.is_link_local() && !ip.is_unspecified() && is_allowed_lan_ipv4(ip)
}

pub fn detect_local_lan_ips() -> Vec<String> {
    let probe_targets = [
        "192.168.1.1:9",
        "192.168.0.1:9",
        "10.0.0.1:9",
        "172.16.0.1:9",
        "192.168.255.254:9",
        "1.1.1.1:80",
        "8.8.8.8:80",
    ];
    let mut private_ips = Vec::new();
    let mut fallback_ips = Vec::new();

    for target in probe_targets {
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect(target).is_ok() {
                if let Ok(local_addr) = socket.local_addr() {
                    if let std::net::IpAddr::V4(v4) = local_addr.ip() {
                        if v4.is_unspecified() || v4.is_loopback() || v4.is_link_local() {
                            continue;
                        }
                        let s = v4.to_string();
                        if is_private_lan_ipv4(v4) {
                            if !private_ips.contains(&s) {
                                private_ips.push(s);
                            }
                        } else if !fallback_ips.contains(&s) {
                            fallback_ips.push(s);
                        }
                    }
                }
            }
        }
    }

    private_ips.extend(fallback_ips);
    private_ips
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
            } else if key == "x-quillvibe-pin" || key == "x-bookvibe-pin" {
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
    let mut candidate_ips = detect_local_lan_ips();
    let host_ip = candidate_ips
        .first()
        .cloned()
        .unwrap_or_else(|| String::from("127.0.0.1"));
    if candidate_ips.is_empty() {
        candidate_ips.push(host_ip.clone());
    }
    let active = Arc::new(AtomicBool::new(true));
    let shared_book = Arc::new(Mutex::new(book_json));
    let incoming_queue = Arc::new(Mutex::new(VecDeque::new()));

    let active_clone = Arc::clone(&active);
    let book_clone = Arc::clone(&shared_book);
    let queue_clone = Arc::clone(&incoming_queue);
    let pin_clone = pin.clone();

    let handle = thread::spawn(move || {
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
        candidate_ips: candidate_ips.clone(),
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
            candidate_ips,
            port: actual_port,
            pin,
            host_name,
            book_json: shared_book,
            incoming_queue,
            handle: Some(handle),
        });
    }

    Ok(info)
}

pub fn update_lan_sync_host_book(book_json: String) -> Result<bool, String> {
    let guard = host_slot()
        .lock()
        .map_err(|_| String::from("Unable to lock active LAN host state."))?;
    let Some(inner) = guard.as_ref() else {
        return Ok(false);
    };
    let mut book_guard = inner
        .book_json
        .lock()
        .map_err(|_| String::from("Unable to lock shared LAN snapshot."))?;
    *book_guard = book_json;
    Ok(true)
}

pub fn stop_lan_sync_host() {
    let prev = {
        let Ok(mut guard) = host_slot().lock() else {
            return;
        };
        guard.take()
    };
    if let Some(mut inner) = prev {
        inner.active.store(false, Ordering::Relaxed);
        if let Some(handle) = inner.handle.take() {
            let _ = handle.join();
        }
    }
}

pub fn get_lan_sync_status() -> Option<LanSessionInfo> {
    let guard = host_slot().lock().ok()?;
    let inner = guard.as_ref()?;
    let incoming_count = inner.incoming_queue.lock().map(|q| q.len()).unwrap_or(0);
    Some(LanSessionInfo {
        host_ip: inner.host_ip.clone(),
        candidate_ips: inner.candidate_ips.clone(),
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
        "GET /api/book HTTP/1.1\r\nHost: {addr}\r\nX-Quillvibe-Pin: {clean_pin}\r\nConnection: close\r\n\r\n"
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
        "POST /api/push HTTP/1.1\r\nHost: {addr}\r\nX-Quillvibe-Pin: {clean_pin}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
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

pub fn launch_os_bluetooth_share(
    file_path: Option<String>,
    mode: Option<String>,
) -> Result<String, String> {
    let receive_mode = mode
        .as_deref()
        .map(|m| m.trim().eq_ignore_ascii_case("receive"))
        .unwrap_or(false);
    let clean_path = file_path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    #[cfg(target_os = "windows")]
    {
        if !receive_mode {
            if let Some(ref p) = clean_path {
                if std::path::Path::new(p).exists() {
                    let _ = Command::new("explorer.exe")
                        .arg(format!("/select,{p}"))
                        .spawn();
                }
            }
        }

        let fsquirt_path = std::env::var_os("SystemRoot")
            .map(|root| {
                std::path::PathBuf::from(root)
                    .join("System32")
                    .join("fsquirt.exe")
            })
            .filter(|candidate| candidate.is_file())
            .unwrap_or_else(|| std::path::PathBuf::from("fsquirt.exe"));

        let flag = if receive_mode { "-receive" } else { "-send" };
        match Command::new(&fsquirt_path).arg(flag).spawn() {
            Ok(_) => {
                if receive_mode {
                    return Ok(String::from(
                        "Opened Windows Bluetooth File Transfer (Receive files). Accept the peer file, then click Pick & Merge Peer File.",
                    ));
                }
                return Ok(String::from(
                    "Opened Windows Bluetooth File Transfer (Send files). Choose a paired device and select your saved .quillvibe file.",
                ));
            }
            Err(_) => {
                let _ = Command::new("cmd")
                    .args(["/C", "start", "", "ms-settings:bluetooth"])
                    .spawn();
                return Ok(String::from(
                    "Opened Windows Bluetooth settings. Share or receive the .quillvibe file via Bluetooth or Nearby Sharing.",
                ));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if !receive_mode {
            if let Some(ref p) = clean_path {
                if Command::new("open")
                    .args(["-a", "Bluetooth File Exchange", p])
                    .spawn()
                    .is_ok()
                {
                    return Ok(String::from(
                        "Opened macOS Bluetooth File Exchange with your saved .qv file.",
                    ));
                }
                let _ = Command::new("open").arg("-R").arg(p).spawn();
                return Ok(String::from(
                    "Revealed sync file in Finder. Right-click -> Share -> Nearby Share or Bluetooth.",
                ));
            }
        }
        if Command::new("open")
            .args(["-a", "Bluetooth File Exchange"])
            .spawn()
            .is_ok()
        {
            return Ok(String::from("Opened macOS Bluetooth File Exchange."));
        }
        let _ = Command::new("open")
            .arg("x-apple.systempreferences:com.apple.BluetoothSettings")
            .spawn();
        return Ok(String::from("Opened macOS Bluetooth preferences."));
    }

    #[cfg(target_os = "linux")]
    {
        if !receive_mode {
            if let Some(ref p) = clean_path {
                if Command::new("bluetooth-sendto").arg(p).spawn().is_ok() {
                    return Ok(String::from("Opened Bluetooth Send dialog with your .quillvibe file."));
                }
                if Command::new("blueman-sendto").arg(p).spawn().is_ok() {
                    return Ok(String::from("Opened Blueman Bluetooth Send dialog with your .quillvibe file."));
                }
                if let Some(parent) = std::path::Path::new(p).parent() {
                    let _ = Command::new("xdg-open").arg(parent).spawn();
                }
                return Ok(String::from(
                    "Opened sync folder. Send the .quillvibe file via Bluetooth or Nearby Share.",
                ));
            }
            if Command::new("bluetooth-sendto").spawn().is_ok()
                || Command::new("blueman-sendto").spawn().is_ok()
            {
                return Ok(String::from("Opened Linux Bluetooth Send dialog."));
            }
        }
        let _ = Command::new("blueman-manager")
            .spawn()
            .or_else(|_| Command::new("gnome-control-center").arg("bluetooth").spawn());
        return Ok(String::from(
            "Opened Bluetooth manager. Receive the .quillvibe file, then click Pick & Merge Peer File.",
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_public_and_metadata_ips() {
        assert!(parse_allowed_lan_addr("127.0.0.1:48000").is_ok());
        assert!(parse_allowed_lan_addr("http://192.168.1.42:48000/").is_ok());
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
    fn loopback_host_pull_update_and_push_round_trip() {
        let initial = String::from(r#"{"title":"Lan Book","parts":[]}"#);
        let session = start_lan_sync_host(initial.clone(), String::from("Desk-A"), None)
            .expect("host binds");
        let peer_addr = format!("127.0.0.1:{}", session.port);

        let pulled = pull_book_from_lan_peer(&peer_addr, &session.pin).expect("pulls ok");
        assert_eq!(pulled, initial);

        let updated = String::from(r#"{"title":"Lan Book v2","parts":[]}"#);
        assert!(update_lan_sync_host_book(updated.clone()).expect("updates host snapshot"));
        let pulled_updated = pull_book_from_lan_peer(&peer_addr, &session.pin).expect("pulls v2");
        assert_eq!(pulled_updated, updated);

        assert!(pull_book_from_lan_peer(&peer_addr, "000000").is_err());

        let pushed = String::from(r#"{"title":"Lan Book Revised","parts":[]}"#);
        push_book_to_lan_peer(&peer_addr, &session.pin, &pushed).expect("pushes ok");

        let queued = poll_lan_incoming_sync().expect("queued incoming sync");
        assert_eq!(queued, pushed);

        stop_lan_sync_host();
        assert!(get_lan_sync_status().is_none());
    }
}
