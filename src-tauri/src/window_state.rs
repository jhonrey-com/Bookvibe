use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

const WINDOW_STATE_FILENAME: &str = "window-state.json";
const BACKUPS_DIR_NAME: &str = "backups";
const BACKUP_MIN_INTERVAL_SECS: u64 = 300;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MonitorWorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WindowStateRecord {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    pub scale_factor: f64,
}

impl Default for WindowStateRecord {
    fn default() -> Self {
        Self {
            x: 64,
            y: 48,
            width: 1440,
            height: 900,
            maximized: true,
            scale_factor: 1.0,
        }
    }
}

/// Validates and clamps a persisted window geometry against connected displays
/// so high-DPI changes or disconnected monitors never launch an off-screen window.
pub fn clamp_window_to_monitors(
    mut rec: WindowStateRecord,
    monitors: &[MonitorWorkArea],
) -> WindowStateRecord {
    rec.width = rec.width.clamp(640, 7680);
    rec.height = rec.height.clamp(520, 4320);
    if !rec.scale_factor.is_finite() || rec.scale_factor < 0.5 || rec.scale_factor > 5.0 {
        rec.scale_factor = 1.0;
    }

    if monitors.is_empty() {
        return rec;
    }

    let title_grab_h = 48_i64;
    let min_visible_w = 140_i64;
    let rec_right = rec.x as i64 + rec.width as i64;
    let rec_bottom = rec.y as i64 + title_grab_h;

    let intersects_any = monitors.iter().any(|m| {
        let m_right = m.x as i64 + m.width as i64;
        let m_bottom = m.y as i64 + m.height as i64;
        let overlap_x = (rec_right.min(m_right) - (rec.x as i64).max(m.x as i64)) >= min_visible_w;
        let overlap_y = (rec_bottom.min(m_bottom) - (rec.y as i64).max(m.y as i64)) >= 20;
        overlap_x && overlap_y
    });

    if !intersects_any {
        let primary = monitors[0];
        let clamped_w = rec.width.min(primary.width.max(640));
        let clamped_h = rec.height.min(primary.height.max(520));
        rec.width = clamped_w.max(640);
        rec.height = clamped_h.max(520);
        rec.x = primary.x + ((primary.width.saturating_sub(rec.width)) / 2) as i32;
        rec.y = primary.y + ((primary.height.saturating_sub(rec.height)) / 2) as i32;
    }

    rec
}

pub fn load_window_state(app_data_dir: &Path) -> Option<WindowStateRecord> {
    let raw = fs::read_to_string(app_data_dir.join(WINDOW_STATE_FILENAME)).ok()?;
    serde_json::from_str::<WindowStateRecord>(&raw).ok()
}

pub fn save_window_state(app_data_dir: &Path, rec: &WindowStateRecord) -> Result<(), String> {
    fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Failed creating app data directory: {e}"))?;
    let target = app_data_dir.join(WINDOW_STATE_FILENAME);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let tmp = app_data_dir.join(format!(".window-state.{}.{}.tmp", std::process::id(), nanos));
    let json = serde_json::to_string_pretty(rec)
        .map_err(|e| format!("Failed serializing window state: {e}"))?;
    fs::write(&tmp, json.as_bytes()).map_err(|e| format!("Failed writing window state temp: {e}"))?;
    fs::rename(&tmp, target).map_err(|e| format!("Failed committing window state: {e}"))?;
    Ok(())
}

/// Writes throttled rolling library backups into `app_data_dir/backups/` and retains
/// at most `max_keep` newest snapshots.
pub fn create_rolling_backup(
    app_data_dir: &Path,
    filename_prefix: &str,
    payload: &[u8],
    max_keep: usize,
) -> Result<bool, String> {
    if payload.is_empty() || max_keep == 0 {
        return Ok(false);
    }
    let dir = app_data_dir.join(BACKUPS_DIR_NAME);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed creating backup directory: {e}"))?;

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut existing: Vec<(String, std::path::PathBuf)> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed listing backups: {e}"))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(filename_prefix) && name.ends_with(".json") {
                Some((name, entry.path()))
            } else {
                None
            }
        })
        .collect();
    existing.sort_by(|a, b| b.0.cmp(&a.0));

    if let Some((newest_name, _)) = existing.first() {
        let stem = newest_name
            .trim_start_matches(filename_prefix)
            .trim_start_matches('-')
            .trim_end_matches(".json");
        if let Ok(prev_ts) = stem.parse::<u64>() {
            if now_secs.saturating_sub(prev_ts) < BACKUP_MIN_INTERVAL_SECS {
                return Ok(false);
            }
        }
    }

    let backup_path = dir.join(format!("{filename_prefix}-{now_secs:012}.json"));
    fs::write(&backup_path, payload).map_err(|e| format!("Failed writing rolling backup: {e}"))?;
    existing.insert(0, (backup_path.file_name().unwrap().to_string_lossy().into_owned(), backup_path));

    for (_, stale) in existing.into_iter().skip(max_keep) {
        let _ = fs::remove_file(stale);
    }
    Ok(true)
}

pub fn count_rolling_backups(app_data_dir: &Path) -> usize {
    let dir = app_data_dir.join(BACKUPS_DIR_NAME);
    fs::read_dir(&dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                .count()
        })
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamps_offscreen_window_back_onto_primary_display() {
        let monitors = [MonitorWorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }];
        let offscreen = WindowStateRecord {
            x: 3200,
            y: 120,
            width: 1280,
            height: 820,
            maximized: false,
            scale_factor: 1.25,
        };
        let clamped = clamp_window_to_monitors(offscreen, &monitors);
        assert!(clamped.x >= 0 && clamped.x + (clamped.width as i32) <= 1920);
        assert!(clamped.y >= 0 && clamped.y + (clamped.height as i32) <= 1080);
    }

    #[test]
    fn enforces_rolling_backup_retention_limit() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(1);
        let temp_dir = std::env::temp_dir().join(format!("qv-backup-test-{stamp}"));
        let backups_dir = temp_dir.join(BACKUPS_DIR_NAME);
        fs::create_dir_all(&backups_dir).unwrap();
        for ts in [100_u64, 500, 900, 1400, 1900, 2400] {
            fs::write(
                backups_dir.join(format!("library-backup-{ts:012}.json")),
                b"{}",
            )
            .unwrap();
        }
        let written = create_rolling_backup(&temp_dir, "library-backup", b"{\"ok\":true}", 5).unwrap();
        assert!(written);
        assert_eq!(count_rolling_backups(&temp_dir), 5);
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
