mod export;
mod file_assoc;
mod lan_sync;
mod window_state;

use export::{build_epub_bytes, sanitize_filename, EpubExportPayload};
use file_assoc::{
    find_spec_by_extension, get_association_status, is_importable_legacy_path,
    is_supported_quillvibe_path, register_os_file_associations, AssociationReport,
    LEGACY_IMPORT_EXTENSIONS, QUILLVIBE_EXTENSION_SPECS,
};
use lan_sync::{
    get_lan_sync_status, launch_os_bluetooth_share, poll_lan_incoming_sync,
    pull_book_from_lan_peer, push_book_to_lan_peer, start_lan_sync_host, stop_lan_sync_host,
    update_lan_sync_host_book, LanSessionInfo,
};
use serde::Serialize;
use std::collections::hash_map::RandomState;
use std::fs;
use std::hash::{BuildHasher, Hasher};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

static WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(1);

const DEFAULT_PROJECT_FILENAME: &str = "current-project.qv";
const PREV_QUILLVIBE_PROJECT_FILENAME: &str = "current-project.quillvibe";
const LEGACY_PROJECT_FILENAME: &str = "current-project.bookvibe";
const LIBRARY_FILENAME: &str = "quillvibe-library.json";
const LEGACY_LIBRARY_FILENAME: &str = "bookvibe-library.json";

const B64_ALPHA: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(B64_ALPHA[((n >> 18) & 0x3f) as usize] as char);
        out.push(B64_ALPHA[((n >> 12) & 0x3f) as usize] as char);
        out.push(if chunk.len() > 1 {
            B64_ALPHA[((n >> 6) & 0x3f) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            B64_ALPHA[(n & 0x3f) as usize] as char
        } else {
            '='
        });
    }
    out
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    fn val(b: u8) -> Option<u32> {
        match b {
            b'A'..=b'Z' => Some((b - b'A') as u32),
            b'a'..=b'z' => Some((b - b'a' + 26) as u32),
            b'0'..=b'9' => Some((b - b'0' + 52) as u32),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let clean: Vec<u8> = input.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    if clean.is_empty() {
        return Ok(Vec::new());
    }
    if clean.len() % 4 != 0 {
        return Err(String::from("Invalid base64 payload length."));
    }
    let mut out = Vec::with_capacity((clean.len() / 4) * 3);
    for chunk in clean.chunks_exact(4) {
        let a = val(chunk[0]).ok_or_else(|| String::from("Invalid base64 character."))?;
        let b = val(chunk[1]).ok_or_else(|| String::from("Invalid base64 character."))?;
        let c = if chunk[2] == b'=' {
            0
        } else {
            val(chunk[2]).ok_or_else(|| String::from("Invalid base64 character."))?
        };
        let d = if chunk[3] == b'=' {
            0
        } else {
            val(chunk[3]).ok_or_else(|| String::from("Invalid base64 character."))?
        };
        let n = (a << 18) | (b << 12) | (c << 6) | d;
        out.push(((n >> 16) & 0xff) as u8);
        if chunk[2] != b'=' {
            out.push(((n >> 8) & 0xff) as u8);
        }
        if chunk[3] != b'=' {
            out.push((n & 0xff) as u8);
        }
    }
    Ok(out)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFilePayload {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub content: String,
    pub content_base64: String,
    pub is_binary: bool,
}

#[derive(Default)]
pub struct StartupFileState {
    pending: Mutex<Option<OpenedFilePayload>>,
}

fn read_validated_quillvibe_file(
    path: &Path,
    allow_legacy_import: bool,
) -> Result<OpenedFilePayload, String> {
    let supported_native = is_supported_quillvibe_path(path);
    let supported_legacy = allow_legacy_import && is_importable_legacy_path(path);
    if !supported_native && !supported_legacy {
        return Err(String::from(
            "Unsupported file extension. Only .qv, .qvbible, .qvscene, .qvstyle, and .qvdesign files open directly in Quillvibe.",
        ));
    }

    let bytes = fs::read(path).map_err(|e| format!("Failed reading file: {e}"))?;
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled.qv")
        .to_string();
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_ascii_lowercase()))
        .unwrap_or_else(|| String::from(".qv"));

    let is_qvbx = bytes.starts_with(b"QVBX");
    if is_qvbx {
        return Ok(OpenedFilePayload {
            path: path.to_string_lossy().into_owned(),
            filename,
            extension,
            content: String::new(),
            content_base64: encode_base64(&bytes),
            is_binary: true,
        });
    }

    let content =
        String::from_utf8(bytes).map_err(|_| String::from("Damaged or unrecognized binary Quillvibe file."))?;

    Ok(OpenedFilePayload {
        path: path.to_string_lossy().into_owned(),
        filename,
        extension,
        content,
        content_base64: String::new(),
        is_binary: false,
    })
}

fn write_atomic_bytes(target: &Path, payload: &[u8]) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed creating directory: {e}"))?;
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let tmp_name = format!(
        ".{}.{}.{}.tmp",
        target
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("quillvibe"),
        std::process::id(),
        nanos
    );
    let tmp_path = target.with_file_name(tmp_name);
    fs::write(&tmp_path, payload).map_err(|e| format!("Failed writing temp file: {e}"))?;
    fs::rename(&tmp_path, target).map_err(|e| format!("Failed committing atomic save: {e}"))?;
    Ok(())
}

fn default_project_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    Ok(dir.join(DEFAULT_PROJECT_FILENAME))
}

#[tauri::command]
fn get_startup_opened_file(state: State<'_, StartupFileState>) -> Option<OpenedFilePayload> {
    let mut guard = state.pending.lock().ok()?;
    guard.take()
}

#[tauri::command]
fn load_default_project(app: AppHandle) -> Result<Option<String>, String> {
    let primary = default_project_path(&app)?;
    let path = if primary.exists() {
        primary
    } else if primary.with_file_name(PREV_QUILLVIBE_PROJECT_FILENAME).exists() {
        primary.with_file_name(PREV_QUILLVIBE_PROJECT_FILENAME)
    } else {
        primary.with_file_name(LEGACY_PROJECT_FILENAME)
    };
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Cannot read saved project: {e}"))?;
    Ok(Some(content))
}

#[tauri::command]
fn save_default_project(app: AppHandle, payload: String) -> Result<(), String> {
    let path = default_project_path(&app)?;
    write_atomic_bytes(&path, payload.as_bytes())
}

#[tauri::command]
fn load_book_library(app: AppHandle) -> Result<Option<String>, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    let primary = dir.join(LIBRARY_FILENAME);
    let path = if primary.exists() {
        primary
    } else {
        dir.join(LEGACY_LIBRARY_FILENAME)
    };
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Cannot read library: {e}"))?;
    Ok(Some(content))
}

#[tauri::command]
fn save_book_library(app: AppHandle, payload: String) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    let bytes = payload.as_bytes();
    write_atomic_bytes(&dir.join(LIBRARY_FILENAME), bytes)?;
    let _ = window_state::create_rolling_backup(&dir, "library-backup", bytes, 5);
    Ok(())
}

#[tauri::command]
fn open_quillvibe_file_dialog() -> Result<Option<OpenedFilePayload>, String> {
    let exts: Vec<&str> = QUILLVIBE_EXTENSION_SPECS.iter().map(|s| s.bare_ext).collect();
    let picked = rfd::FileDialog::new()
        .set_title("Open Quillvibe File")
        .add_filter("All Quillvibe Formats (.qv, .qvbible, .qvscene, .qvstyle, .qvdesign)", &exts)
        .add_filter("Quillvibe Book Workspace (.qv)", &["qv"])
        .add_filter("Quillvibe Story Bible (.qvbible)", &["qvbible"])
        .add_filter("Quillvibe Scene Draft (.qvscene)", &["qvscene"])
        .add_filter("Quillvibe Typeset Style (.qvstyle)", &["qvstyle"])
        .add_filter("Quillvibe Cover Design (.qvdesign)", &["qvdesign"])
        .pick_file();

    match picked {
        Some(path) => read_validated_quillvibe_file(&path, false).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn import_legacy_book_dialog() -> Result<Option<OpenedFilePayload>, String> {
    let picked = rfd::FileDialog::new()
        .set_title("Import Previous / Legacy Book Archive")
        .add_filter("Previous Book Archive (.quillvibe, .bookvibe, .bv*)", LEGACY_IMPORT_EXTENSIONS)
        .pick_file();

    match picked {
        Some(path) => read_validated_quillvibe_file(&path, true).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_quillvibe_file_dialog(
    payload: Option<String>,
    payload_base64: Option<String>,
    suggested_name: String,
    extension: String,
    description: String,
) -> Result<Option<String>, String> {
    let spec = find_spec_by_extension(&extension)
        .ok_or_else(|| String::from("Extension is not in the official Quillvibe allowlist."))?;
    let safe_base = sanitize_filename(&suggested_name, "quillvibe-export");
    let file_name = format!("{safe_base}{}", spec.dot_ext);
    let label = if description.trim().is_empty() {
        spec.name
    } else {
        description.trim()
    };

    let bytes = if let Some(b64) = payload_base64 {
        decode_base64(&b64)?
    } else if let Some(txt) = payload {
        txt.into_bytes()
    } else {
        return Err(String::from("Missing payload to write."));
    };

    let picked = rfd::FileDialog::new()
        .set_title(&format!("Save {}", spec.name))
        .set_file_name(&file_name)
        .add_filter(label, &[spec.bare_ext])
        .save_file();

    match picked {
        Some(mut path) => {
            if path.extension().and_then(|e| e.to_str()) != Some(spec.bare_ext) {
                path.set_extension(spec.bare_ext);
            }
            write_atomic_bytes(&path, &bytes)?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn export_epub_file(payload: EpubExportPayload, suggested_name: String) -> Result<Option<String>, String> {
    let epub_bytes = build_epub_bytes(&payload)?;
    let safe_base = sanitize_filename(&suggested_name, "manuscript");
    let picked = rfd::FileDialog::new()
        .set_title("Export EPUB 3 Book")
        .set_file_name(&format!("{safe_base}.epub"))
        .add_filter("EPUB 3 eBook", &["epub"])
        .save_file();

    match picked {
        Some(mut path) => {
            if path.extension().and_then(|e| e.to_str()) != Some("epub") {
                path.set_extension("epub");
            }
            write_atomic_bytes(&path, &epub_bytes)?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn export_markdown_file(content: String, suggested_name: String) -> Result<Option<String>, String> {
    let safe_base = sanitize_filename(&suggested_name, "manuscript");
    let picked = rfd::FileDialog::new()
        .set_title("Export Markdown Manuscript")
        .set_file_name(&format!("{safe_base}.md"))
        .add_filter("Markdown Manuscript", &["md"])
        .save_file();

    match picked {
        Some(mut path) => {
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                path.set_extension("md");
            }
            write_atomic_bytes(&path, content.as_bytes())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn export_generic_file(
    payload_text: Option<String>,
    payload_base64: Option<String>,
    suggested_name: String,
    extension: String,
    description: String,
) -> Result<Option<String>, String> {
    let clean_ext = extension.trim().trim_start_matches('.').to_ascii_lowercase();
    let allowed = ["pdf", "epub", "docx", "md", "html", "txt", "rtf", "png", "svg", "json", "canvas", "qvext", "qvdesign"];
    if !allowed.contains(&clean_ext.as_str()) {
        return Err(format!("Unsupported export extension: .{clean_ext}"));
    }

    let bytes = if let Some(b64) = payload_base64 {
        decode_base64(&b64)?
    } else if let Some(txt) = payload_text {
        txt.into_bytes()
    } else {
        return Err(String::from("Missing export data."));
    };

    let safe_base = sanitize_filename(&suggested_name, "quillvibe-export");
    let label = if description.trim().is_empty() {
        clean_ext.as_str()
    } else {
        description.trim()
    };

    let picked = rfd::FileDialog::new()
        .set_title(&format!("Export {label}"))
        .set_file_name(&format!("{safe_base}.{clean_ext}"))
        .add_filter(label, &[clean_ext.as_str()])
        .save_file();

    match picked {
        Some(mut path) => {
            if path.extension().and_then(|e| e.to_str()).map(|s| s.to_ascii_lowercase()).as_deref() != Some(clean_ext.as_str()) {
                path.set_extension(&clean_ext);
            }
            write_atomic_bytes(&path, &bytes)?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn register_file_associations() -> Result<AssociationReport, String> {
    register_os_file_associations()
}

#[tauri::command]
fn get_file_association_status() -> AssociationReport {
    get_association_status()
}

#[tauri::command]
fn start_lan_sync_host_cmd(
    book_json: String,
    host_name: String,
    port: Option<u16>,
) -> Result<LanSessionInfo, String> {
    start_lan_sync_host(book_json, host_name, port)
}

#[tauri::command]
fn update_lan_sync_host_book_cmd(book_json: String) -> Result<bool, String> {
    update_lan_sync_host_book(book_json)
}

#[tauri::command]
fn stop_lan_sync_host_cmd() {
    stop_lan_sync_host();
}

#[tauri::command]
fn get_lan_sync_status_cmd() -> Option<LanSessionInfo> {
    get_lan_sync_status()
}

#[tauri::command]
fn poll_lan_incoming_sync_cmd() -> Option<String> {
    poll_lan_incoming_sync()
}

#[tauri::command]
fn pull_book_from_lan_peer_cmd(peer_addr: String, pin: String) -> Result<String, String> {
    pull_book_from_lan_peer(&peer_addr, &pin)
}

#[tauri::command]
fn push_book_to_lan_peer_cmd(
    peer_addr: String,
    pin: String,
    book_json: String,
) -> Result<String, String> {
    push_book_to_lan_peer(&peer_addr, &pin, &book_json)
}

#[tauri::command]
fn launch_os_bluetooth_share_cmd(
    file_path: Option<String>,
    mode: Option<String>,
) -> Result<String, String> {
    launch_os_bluetooth_share(file_path, mode)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopWindowBounds {
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale_factor: f64,
}

#[tauri::command]
fn list_desktop_window_bounds(app: AppHandle) -> Vec<DesktopWindowBounds> {
    let mut entries: Vec<(bool, DesktopWindowBounds)> = Vec::new();
    for (label, win) in app.webview_windows() {
        let scale = win.scale_factor().unwrap_or(1.0).max(0.5);
        let focused = win.is_focused().unwrap_or(false);
        if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
            entries.push((
                focused,
                DesktopWindowBounds {
                    label,
                    x: (pos.x as f64) / scale,
                    y: (pos.y as f64) / scale,
                    width: (size.width as f64) / scale,
                    height: (size.height as f64) / scale,
                    scale_factor: scale,
                },
            ));
        }
    }
    entries.sort_by_key(|(focused, _)| std::cmp::Reverse(*focused));
    entries.into_iter().map(|(_, b)| b).collect()
}

#[tauri::command]
fn focus_desktop_window(app: AppHandle, label: String) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn move_desktop_window(app: AppHandle, label: Option<String>, x: f64, y: f64) -> Result<(), String> {
    let target_label = label.unwrap_or_else(|| "main".to_string());
    if let Some(win) = app.get_webview_window(&target_label) {
        if win.is_maximized().unwrap_or(false) {
            let _ = win.unmaximize();
        }
        let _ = win.set_position(tauri::LogicalPosition::new(x, y));
    }
    Ok(())
}

#[tauri::command]
fn close_desktop_window_by_label(app: AppHandle, label: String) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.hide();
        let _ = win.close();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn open_book_in_new_window(
    app: AppHandle,
    book_id: Option<String>,
    title: Option<String>,
    maximized: Option<bool>,
    focused: Option<bool>,
    pos_x: Option<f64>,
    pos_y: Option<f64>,
) -> Result<String, String> {
    let idx = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("quillvibe-win-{idx}");
    let clean_book_id: String = book_id
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(80)
        .collect();
    let clean_title = title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Quillvibe");
    let encoded_book = serde_json::to_string(&clean_book_id).unwrap_or_else(|_| String::from("\"\""));
    let init_script = format!(
        "window.__QUILLVIBE_INITIAL_BOOK_ID__ = {encoded_book}; window.__QUILLVIBE_SKIP_SPLASH__ = true;"
    );

    let should_maximize = maximized.unwrap_or(true);
    let should_focus = focused.unwrap_or(true);
    let has_explicit_pos =
        !should_maximize && matches!((pos_x, pos_y), (Some(px), Some(py)) if px.is_finite() && py.is_finite());
    let mut builder = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::App("desktop.html".into()),
    )
    .title(clean_title)
    .inner_size(1280.0, 840.0)
    .min_inner_size(640.0, 520.0)
    .maximized(should_maximize)
    .resizable(true)
    .decorations(false)
    .visible(!has_explicit_pos)
    .focused(should_focus)
    .background_color(tauri::window::Color(246, 244, 239, 255))
    .initialization_script(&init_script);

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon).unwrap_or_else(|_| {
            tauri::WebviewWindowBuilder::new(
                &app,
                &label,
                tauri::WebviewUrl::App("desktop.html".into()),
            )
            .title(clean_title)
            .inner_size(1280.0, 840.0)
            .min_inner_size(640.0, 520.0)
            .maximized(should_maximize)
            .resizable(true)
            .decorations(false)
            .visible(!has_explicit_pos)
            .focused(should_focus)
            .background_color(tauri::window::Color(246, 244, 239, 255))
            .initialization_script(&init_script)
        });
    }

    if let (true, Some(px), Some(py)) = (has_explicit_pos, pos_x, pos_y) {
        builder = builder.position(px, py);
    }

    let win = builder
        .build()
        .map_err(|e| format!("Could not open new desktop window: {e}"))?;
    if let (true, Some(px), Some(py)) = (has_explicit_pos, pos_x, pos_y) {
        let _ = win.set_position(tauri::LogicalPosition::new(px, py));
    }
    let _ = win.show();
    if should_focus {
        let _ = win.set_focus();
    }

    Ok(label)
}

fn find_startup_file_path_from_args() -> Option<PathBuf> {
    for arg in std::env::args_os().skip(1) {
        let candidate = PathBuf::from(&arg);
        if candidate.is_file() && is_supported_quillvibe_path(&candidate) {
            return Some(candidate);
        }
    }
    None
}

fn find_startup_file_from_args() -> Option<OpenedFilePayload> {
    let candidate = find_startup_file_path_from_args()?;
    read_validated_quillvibe_file(&candidate, false).ok()
}

fn instance_lock_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    let base = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("APPDATA"))
        .map(PathBuf::from);
    #[cfg(target_os = "macos")]
    let base = std::env::var_os("HOME")
        .map(|h| PathBuf::from(h).join("Library").join("Application Support"));
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")));
    let dir = base
        .unwrap_or_else(std::env::temp_dir)
        .join("com.jhonrey.quillvibe");
    let _ = fs::create_dir_all(&dir);
    dir.join("quillvibe-single-instance.lock")
}

fn try_forward_file_to_running_instance(file_path: &Path) -> bool {
    let lock_path = instance_lock_path();
    let Ok(raw) = fs::read_to_string(&lock_path) else {
        return false;
    };
    let mut lines = raw.lines();
    let Some(port_str) = lines.next() else { return false };
    let Some(token) = lines.next() else { return false };
    let Ok(port) = port_str.trim().parse::<u16>() else { return false };
    if token.trim().len() < 16 {
        return false;
    }
    let addr = format!("127.0.0.1:{port}");
    let Ok(mut stream) = TcpStream::connect_timeout(
        &addr.parse().unwrap(),
        Duration::from_millis(350),
    ) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(800)));
    let payload = format!("{}\n{}\n", token.trim(), file_path.to_string_lossy());
    if stream.write_all(payload.as_bytes()).is_err() {
        return false;
    }
    let mut resp = String::new();
    let mut reader = BufReader::new(stream);
    if reader.by_ref().take(1024).read_line(&mut resp).is_ok() && resp.trim() == "OK" {
        return true;
    }
    false
}

fn start_single_instance_listener(app: AppHandle) {
    let Ok(listener) = TcpListener::bind("127.0.0.1:0") else {
        return;
    };
    let Ok(local_addr) = listener.local_addr() else {
        return;
    };
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut hasher = RandomState::new().build_hasher();
    hasher.write_u128(nanos);
    hasher.write_u32(std::process::id());
    let rand_mix = hasher.finish();
    let token = format!("qv{:x}{:x}{:x}", std::process::id(), nanos, rand_mix);
    let lock_path = instance_lock_path();
    let _ = fs::write(&lock_path, format!("{}\n{}\n", local_addr.port(), token));
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&lock_path, fs::Permissions::from_mode(0o600));
    }

    std::thread::spawn(move || {
        for conn in listener.incoming().flatten() {
            let _ = conn.set_read_timeout(Some(Duration::from_millis(1200)));
            let mut reader = BufReader::new(conn);
            let mut recv_token = String::new();
            let mut recv_path = String::new();
            if reader.by_ref().take(1024).read_line(&mut recv_token).is_err()
                || reader.by_ref().take(4096).read_line(&mut recv_path).is_err()
            {
                continue;
            }
            if recv_token.trim() != token {
                continue;
            }
            let mut stream = reader.into_inner();
            let candidate = PathBuf::from(recv_path.trim());
            if candidate.is_file() && is_supported_quillvibe_path(&candidate) {
                if let Ok(loaded) = read_validated_quillvibe_file(&candidate, false) {
                    let _ = stream.write_all(b"OK\n");
                    if let Some(first_win) = app.webview_windows().values().next() {
                        let _ = first_win.unminimize();
                        let _ = first_win.show();
                        let _ = first_win.set_focus();
                        let _ = first_win.emit("quillvibe://open-file", loaded);
                    }
                    continue;
                }
            }
            let _ = stream.write_all(b"ERR\n");
        }
    });
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRuntimeInfo {
    pub os: String,
    pub arch: String,
    pub version: String,
    pub data_dir: String,
    pub crash_log_path: String,
    pub backup_count: usize,
    pub window_count: usize,
}

fn crash_log_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    let base = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("APPDATA"))
        .map(PathBuf::from);
    #[cfg(target_os = "macos")]
    let base = std::env::var_os("HOME")
        .map(|h| PathBuf::from(h).join("Library").join("Logs"));
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")));
    base.unwrap_or_else(std::env::temp_dir).join("com.jhonrey.quillvibe")
}

fn install_crash_logger() {
    let dir = crash_log_dir();
    let _ = fs::create_dir_all(&dir);
    let log_path = dir.join("quillvibe-crash.log");
    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let msg = format!("[{ts}] panic: {info}\n");
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
            let _ = f.write_all(msg.as_bytes());
        }
        prev_hook(info);
    }));
}

#[tauri::command]
fn get_desktop_runtime_info(app: AppHandle) -> DesktopRuntimeInfo {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| crash_log_dir());
    let backup_count = window_state::count_rolling_backups(&data_dir);
    let crash_path = crash_log_dir().join("quillvibe-crash.log");
    DesktopRuntimeInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir: data_dir.to_string_lossy().into_owned(),
        crash_log_path: crash_path.to_string_lossy().into_owned(),
        backup_count,
        window_count: app.webview_windows().len(),
    }
}

fn restore_main_window_state(app: &AppHandle) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let Some(saved) = window_state::load_window_state(&dir) else {
        return;
    };

    let monitors: Vec<window_state::MonitorWorkArea> = win
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            let scale = m.scale_factor().max(0.5);
            window_state::MonitorWorkArea {
                x: ((pos.x as f64) / scale).round() as i32,
                y: ((pos.y as f64) / scale).round() as i32,
                width: ((size.width as f64) / scale).round() as u32,
                height: ((size.height as f64) / scale).round() as u32,
            }
        })
        .collect();

    let safe = window_state::clamp_window_to_monitors(saved, &monitors);
    if safe.maximized {
        let _ = win.maximize();
    } else {
        let _ = win.unmaximize();
        let _ = win.set_size(tauri::LogicalSize::new(safe.width as f64, safe.height as f64));
        let _ = win.set_position(tauri::LogicalPosition::new(safe.x as f64, safe.y as f64));
    }
}

fn persist_window_geometry(win: &tauri::Window) {
    if win.label() != "main" {
        return;
    }
    let Ok(dir) = win.app_handle().path().app_data_dir() else {
        return;
    };
    let maximized = win.is_maximized().unwrap_or(true);
    let scale = win.scale_factor().unwrap_or(1.0).max(0.5);
    let prev = window_state::load_window_state(&dir).unwrap_or_default();

    if maximized {
        let next = window_state::WindowStateRecord {
            maximized: true,
            scale_factor: scale,
            ..prev
        };
        let _ = window_state::save_window_state(&dir, &next);
        return;
    }

    if let (Ok(pos), Ok(size)) = (win.outer_position(), win.inner_size()) {
        let logical_w = ((size.width as f64) / scale).round() as u32;
        let logical_h = ((size.height as f64) / scale).round() as u32;
        if logical_w < 400 || logical_h < 300 {
            return;
        }
        let next = window_state::WindowStateRecord {
            x: ((pos.x as f64) / scale).round() as i32,
            y: ((pos.y as f64) / scale).round() as i32,
            width: logical_w,
            height: logical_h,
            maximized: false,
            scale_factor: scale,
        };
        let _ = window_state::save_window_state(&dir, &next);
    }
}

#[cfg(target_os = "macos")]
fn install_native_os_menu(app: &AppHandle) {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
    if let (Ok(file_sub), Ok(edit_sub), Ok(view_sub), Ok(win_sub), Ok(help_sub)) = (
        SubmenuBuilder::new(app, "File")
            .item(&MenuItemBuilder::with_id("new-window", "New Window").accelerator("CmdOrCtrl+Shift+N").build(app).unwrap())
            .item(&MenuItemBuilder::with_id("open-file", "Open Quillvibe File…").accelerator("CmdOrCtrl+O").build(app).unwrap())
            .item(&MenuItemBuilder::with_id("save-snapshot", "Save Revision Snapshot").accelerator("CmdOrCtrl+S").build(app).unwrap())
            .item(&MenuItemBuilder::with_id("export-default", "Export Default Format").build(app).unwrap())
            .separator()
            .item(&MenuItemBuilder::with_id("settings", "Settings…").accelerator("CmdOrCtrl+,").build(app).unwrap())
            .separator()
            .item(&PredefinedMenuItem::quit(app, None).unwrap())
            .build(),
        SubmenuBuilder::new(app, "Edit")
            .item(&MenuItemBuilder::with_id("undo", "Undo").accelerator("CmdOrCtrl+Z").build(app).unwrap())
            .item(&MenuItemBuilder::with_id("redo", "Redo").accelerator("CmdOrCtrl+Shift+Z").build(app).unwrap())
            .separator()
            .item(&PredefinedMenuItem::cut(app, None).unwrap())
            .item(&PredefinedMenuItem::copy(app, None).unwrap())
            .item(&PredefinedMenuItem::paste(app, None).unwrap())
            .item(&PredefinedMenuItem::select_all(app, None).unwrap())
            .build(),
        SubmenuBuilder::new(app, "View")
            .item(&MenuItemBuilder::with_id("toggle-binder", "Toggle Manuscript Binder").build(app).unwrap())
            .item(&MenuItemBuilder::with_id("toggle-inspector", "Toggle Scene Inspector").build(app).unwrap())
            .item(&MenuItemBuilder::with_id("extensions", "Extensions & Formats").build(app).unwrap())
            .separator()
            .item(&MenuItemBuilder::with_id("toggle-fullscreen", "Toggle Immersive Fullscreen").build(app).unwrap())
            .build(),
        SubmenuBuilder::new(app, "Window")
            .item(&MenuItemBuilder::with_id("combine-windows", "Combine All Windows Here").build(app).unwrap())
            .item(&PredefinedMenuItem::minimize(app, None).unwrap())
            .item(&PredefinedMenuItem::close_window(app, None).unwrap())
            .build(),
        SubmenuBuilder::new(app, "Help")
            .item(&MenuItemBuilder::with_id("manual", "Manual & Reference").build(app).unwrap())
            .item(&MenuItemBuilder::with_id("course", "Book Writing Course").build(app).unwrap())
            .build(),
    ) {
        if let Ok(menu) = MenuBuilder::new(app)
            .items(&[&file_sub, &edit_sub, &view_sub, &win_sub, &help_sub])
            .build()
        {
            let _ = app.set_menu(menu);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_crash_logger();

    if let Some(startup_path) = find_startup_file_path_from_args() {
        if try_forward_file_to_running_instance(&startup_path) {
            return;
        }
    }

    let initial_file = find_startup_file_from_args();

    // Auto-register official extensions in the active user profile on compiled desktop runs
    if !cfg!(debug_assertions) {
        let _ = register_os_file_associations();
    }

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            restore_main_window_state(handle);
            #[cfg(target_os = "macos")]
            install_native_os_menu(handle);
            start_single_instance_listener(handle.clone());
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.clone();
            if let Some(win) = app
                .webview_windows()
                .into_values()
                .find(|w| w.is_focused().unwrap_or(false))
                .or_else(|| app.webview_windows().into_values().next())
            {
                let _ = win.emit("quillvibe://menu-action", id);
            }
        })
        .on_window_event(|win, event| match event {
            tauri::WindowEvent::Moved(_)
            | tauri::WindowEvent::Resized(_)
            | tauri::WindowEvent::CloseRequested { .. } => {
                persist_window_geometry(win);
            }
            _ => {}
        })
        .manage(StartupFileState {
            pending: Mutex::new(initial_file),
        })
        .invoke_handler(tauri::generate_handler![
            get_startup_opened_file,
            get_desktop_runtime_info,
            load_default_project,
            save_default_project,
            load_book_library,
            save_book_library,
            open_quillvibe_file_dialog,
            import_legacy_book_dialog,
            save_quillvibe_file_dialog,
            export_epub_file,
            export_markdown_file,
            export_generic_file,
            register_file_associations,
            get_file_association_status,
            start_lan_sync_host_cmd,
            update_lan_sync_host_book_cmd,
            stop_lan_sync_host_cmd,
            get_lan_sync_status_cmd,
            poll_lan_incoming_sync_cmd,
            pull_book_from_lan_peer_cmd,
            push_book_to_lan_peer_cmd,
            launch_os_bluetooth_share_cmd,
            list_desktop_window_bounds,
            focus_desktop_window,
            move_desktop_window,
            close_desktop_window_by_label,
            open_book_in_new_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running Quillvibe");
}
