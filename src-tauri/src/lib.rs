mod export;
mod file_assoc;
mod lan_sync;

use export::{build_epub_bytes, sanitize_filename, EpubExportPayload};
use file_assoc::{
    find_spec_by_extension, get_association_status, is_supported_bookvibe_path,
    register_os_file_associations, AssociationReport, BOOKVIBE_EXTENSION_SPECS,
};
use lan_sync::{
    get_lan_sync_status, launch_os_bluetooth_share, poll_lan_incoming_sync,
    pull_book_from_lan_peer, push_book_to_lan_peer, start_lan_sync_host, stop_lan_sync_host,
    update_lan_sync_host_book, LanSessionInfo,
};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

const MAX_PROJECT_BYTES: u64 = 50 * 1024 * 1024;
const DEFAULT_PROJECT_FILENAME: &str = "current-project.bookvibe";
const LIBRARY_FILENAME: &str = "bookvibe-library.json";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFilePayload {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub content: String,
}

#[derive(Default)]
pub struct StartupFileState {
    pending: Mutex<Option<OpenedFilePayload>>,
}

fn read_validated_bookvibe_file(path: &Path) -> Result<OpenedFilePayload, String> {
    if !is_supported_bookvibe_path(path) {
        return Err(String::from("Unsupported file extension for Bookvibe."));
    }
    let meta = fs::metadata(path).map_err(|e| format!("Cannot inspect file: {e}"))?;
    if meta.len() > MAX_PROJECT_BYTES {
        return Err(String::from("File exceeds 50 MB safety limit."));
    }
    let content = fs::read_to_string(path).map_err(|e| format!("Failed reading UTF-8 file: {e}"))?;
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled.bookvibe")
        .to_string();
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_ascii_lowercase()))
        .unwrap_or_else(|| String::from(".bookvibe"));

    Ok(OpenedFilePayload {
        path: path.to_string_lossy().into_owned(),
        filename,
        extension,
        content,
    })
}

fn write_atomic_utf8(target: &Path, payload: &str) -> Result<(), String> {
    if payload.len() as u64 > MAX_PROJECT_BYTES {
        return Err(String::from("Payload exceeds 50 MB limit."));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed creating directory: {e}"))?;
    }
    let tmp_name = format!(
        ".{}.tmp",
        target
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("bookvibe")
    );
    let tmp_path = target.with_file_name(tmp_name);
    fs::write(&tmp_path, payload.as_bytes()).map_err(|e| format!("Failed writing temp file: {e}"))?;
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
    let path = default_project_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let meta = fs::metadata(&path).map_err(|e| format!("Cannot stat saved project: {e}"))?;
    if meta.len() > MAX_PROJECT_BYTES {
        return Err(String::from("Saved project exceeds size limit."));
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Cannot read saved project: {e}"))?;
    Ok(Some(content))
}

#[tauri::command]
fn save_default_project(app: AppHandle, payload: String) -> Result<(), String> {
    let path = default_project_path(&app)?;
    write_atomic_utf8(&path, &payload)
}

#[tauri::command]
fn load_book_library(app: AppHandle) -> Result<Option<String>, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    let path = dir.join(LIBRARY_FILENAME);
    if !path.exists() {
        return Ok(None);
    }
    let meta = fs::metadata(&path).map_err(|e| format!("Cannot stat library: {e}"))?;
    if meta.len() > MAX_PROJECT_BYTES {
        return Err(String::from("Library exceeds size limit."));
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
    write_atomic_utf8(&dir.join(LIBRARY_FILENAME), &payload)
}

#[tauri::command]
fn open_bookvibe_file_dialog() -> Result<Option<OpenedFilePayload>, String> {
    let exts: Vec<&str> = BOOKVIBE_EXTENSION_SPECS.iter().map(|s| s.bare_ext).collect();
    let picked = rfd::FileDialog::new()
        .set_title("Open Bookvibe File")
        .add_filter("All Bookvibe Formats", &exts)
        .add_filter("Bookvibe Master Project (.bookvibe, .bvibe)", &["bookvibe", "bvibe"])
        .add_filter("Bookvibe Manuscript (.bvbook)", &["bvbook"])
        .add_filter("Bookvibe Story Bible (.bvbible)", &["bvbible"])
        .add_filter("Bookvibe Scene Draft (.bvscene)", &["bvscene"])
        .add_filter("Bookvibe Typeset Style (.bvstyle)", &["bvstyle"])
        .pick_file();

    match picked {
        Some(path) => read_validated_bookvibe_file(&path).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_bookvibe_file_dialog(
    payload: String,
    suggested_name: String,
    extension: String,
    description: String,
) -> Result<Option<String>, String> {
    let spec = find_spec_by_extension(&extension)
        .ok_or_else(|| String::from("Extension is not in the official Bookvibe allowlist."))?;
    let safe_base = sanitize_filename(&suggested_name, "bookvibe-export");
    let file_name = format!("{safe_base}{}", spec.dot_ext);
    let label = if description.trim().is_empty() {
        spec.name
    } else {
        description.trim()
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
            write_atomic_utf8(&path, &payload)?;
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
            fs::write(&path, &epub_bytes).map_err(|e| format!("Failed saving EPUB: {e}"))?;
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
            write_atomic_utf8(&path, &content)?;
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

fn find_startup_file_from_args() -> Option<OpenedFilePayload> {
    for arg in std::env::args_os().skip(1) {
        let candidate = PathBuf::from(&arg);
        if candidate.is_file() && is_supported_bookvibe_path(&candidate) {
            if let Ok(loaded) = read_validated_bookvibe_file(&candidate) {
                return Some(loaded);
            }
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_file = find_startup_file_from_args();

    // Auto-register official extensions in the active user profile on compiled desktop runs
    if !cfg!(debug_assertions) {
        let _ = register_os_file_associations();
    }

    tauri::Builder::default()
        .manage(StartupFileState {
            pending: Mutex::new(initial_file),
        })
        .invoke_handler(tauri::generate_handler![
            get_startup_opened_file,
            load_default_project,
            save_default_project,
            load_book_library,
            save_book_library,
            open_bookvibe_file_dialog,
            save_bookvibe_file_dialog,
            export_epub_file,
            export_markdown_file,
            register_file_associations,
            get_file_association_status,
            start_lan_sync_host_cmd,
            update_lan_sync_host_book_cmd,
            stop_lan_sync_host_cmd,
            get_lan_sync_status_cmd,
            poll_lan_incoming_sync_cmd,
            pull_book_from_lan_peer_cmd,
            push_book_to_lan_peer_cmd,
            launch_os_bluetooth_share_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running Bookvibe");
}
