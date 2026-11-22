use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Copy)]
pub struct ExtensionSpec {
    pub dot_ext: &'static str,
    pub bare_ext: &'static str,
    pub prog_id: &'static str,
    pub name: &'static str,
    pub mime_type: &'static str,
    pub uti: &'static str,
}

pub const BOOKVIBE_EXTENSION_SPECS: &[ExtensionSpec] = &[
    ExtensionSpec {
        dot_ext: ".bookvibe",
        bare_ext: "bookvibe",
        prog_id: "Bookvibe.Project.1",
        name: "Bookvibe Master Project",
        mime_type: "application/vnd.bookvibe.project+json",
        uti: "org.bookvibe.project",
    },
    ExtensionSpec {
        dot_ext: ".bvibe",
        bare_ext: "bvibe",
        prog_id: "Bookvibe.CompactProject.1",
        name: "Bookvibe Compact Project",
        mime_type: "application/vnd.bookvibe.project+json",
        uti: "org.bookvibe.compact-project",
    },
    ExtensionSpec {
        dot_ext: ".bvbook",
        bare_ext: "bvbook",
        prog_id: "Bookvibe.Manuscript.1",
        name: "Bookvibe Manuscript Package",
        mime_type: "application/vnd.bookvibe.manuscript+json",
        uti: "org.bookvibe.manuscript",
    },
    ExtensionSpec {
        dot_ext: ".bvbible",
        bare_ext: "bvbible",
        prog_id: "Bookvibe.Bible.1",
        name: "Bookvibe Story Bible Database",
        mime_type: "application/vnd.bookvibe.bible+json",
        uti: "org.bookvibe.bible",
    },
    ExtensionSpec {
        dot_ext: ".bvscene",
        bare_ext: "bvscene",
        prog_id: "Bookvibe.Scene.1",
        name: "Bookvibe Standalone Scene Draft",
        mime_type: "application/vnd.bookvibe.scene+json",
        uti: "org.bookvibe.scene",
    },
    ExtensionSpec {
        dot_ext: ".bvstyle",
        bare_ext: "bvstyle",
        prog_id: "Bookvibe.Style.1",
        name: "Bookvibe Typeset Preset",
        mime_type: "application/vnd.bookvibe.style+json",
        uti: "org.bookvibe.style",
    },
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionAssocStatus {
    pub extension: String,
    pub name: String,
    pub mime_type: String,
    pub uti: String,
    pub prog_id: String,
    pub registered: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssociationReport {
    pub platform: String,
    pub executable_path: String,
    pub scope: String,
    pub all_registered: bool,
    pub items: Vec<ExtensionAssocStatus>,
}

pub fn find_spec_by_extension(ext: &str) -> Option<&'static ExtensionSpec> {
    let normalized = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    BOOKVIBE_EXTENSION_SPECS
        .iter()
        .find(|spec| spec.bare_ext == normalized)
}

pub fn is_supported_bookvibe_path(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .and_then(find_spec_by_extension)
        .is_some()
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn generate_freedesktop_mime_xml() -> String {
    let mut xml = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<mime-info xmlns=\"http://www.freedesktop.org/standards/shared-mime-info\">\n",
    );
    for spec in BOOKVIBE_EXTENSION_SPECS {
        xml.push_str(&format!(
            "  <mime-type type=\"{}\">\n    <comment>{}</comment>\n    <sub-class-of type=\"application/json\"/>\n    <magic priority=\"80\">\n      <match type=\"string\" offset=\"0:256\" value='\"magic\": \"BOOKVIBE_V1\"'>\n        <match type=\"string\" offset=\"0:512\" value='\"extension\": \"{}\"'/>\n      </match>\n    </magic>\n    <glob pattern=\"*{}\"/>\n  </mime-type>\n",
            spec.mime_type, spec.name, spec.dot_ext, spec.dot_ext
        ));
    }
    xml.push_str("</mime-info>\n");
    xml
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub fn generate_linux_desktop_entry(exe_path: &str) -> String {
    let mime_list: Vec<&str> = BOOKVIBE_EXTENSION_SPECS.iter().map(|s| s.mime_type).collect();
    format!(
        "[Desktop Entry]\nType=Application\nName=Bookvibe\nComment=Book writing, worldbuilding, and typesetting studio\nExec=\"{}\" %u\nTerminal=false\nCategories=Office;Publishing;TextEditor;\nMimeType={};\n",
        exe_path.replace('"', "\\\""),
        mime_list.join(";")
    )
}

#[cfg(target_os = "windows")]
mod platform {
    use super::*;
    use std::ffi::c_void;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    const SHCNE_ASSOCCHANGED: i32 = 0x0800_0000;
    const SHCNF_IDLIST: u32 = 0x0000;

    #[link(name = "shell32")]
    extern "system" {
        fn SHChangeNotify(
            w_event_id: i32,
            u_flags: u32,
            dw_item1: *const c_void,
            dw_item2: *const c_void,
        );
    }

    pub fn register(exe_path: &str) -> Result<AssociationReport, String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let classes = hkcu
            .create_subkey("Software\\Classes")
            .map_err(|e| format!("Failed opening HKCU\\Software\\Classes: {e}"))?
            .0;

        let command_line = format!("\"{}\" \"%1\"", exe_path);
        let icon_value = format!("\"{}\",0", exe_path);

        for spec in BOOKVIBE_EXTENSION_SPECS {
            let ext_key = classes
                .create_subkey(spec.dot_ext)
                .map_err(|e| format!("Failed registering extension {}: {e}", spec.dot_ext))?
                .0;
            ext_key
                .set_value("", &spec.prog_id)
                .map_err(|e| format!("Failed setting ProgID for {}: {e}", spec.dot_ext))?;
            ext_key
                .set_value("Content Type", &spec.mime_type)
                .map_err(|e| format!("Failed setting Content Type for {}: {e}", spec.dot_ext))?;
            ext_key
                .set_value("PerceivedType", &"document")
                .map_err(|e| format!("Failed setting PerceivedType for {}: {e}", spec.dot_ext))?;

            let prog_key = classes
                .create_subkey(spec.prog_id)
                .map_err(|e| format!("Failed creating ProgID {}: {e}", spec.prog_id))?
                .0;
            prog_key
                .set_value("", &spec.name)
                .map_err(|e| format!("Failed naming ProgID {}: {e}", spec.prog_id))?;

            let icon_key = prog_key
                .create_subkey("DefaultIcon")
                .map_err(|e| format!("Failed creating DefaultIcon for {}: {e}", spec.prog_id))?
                .0;
            icon_key
                .set_value("", &icon_value)
                .map_err(|e| format!("Failed setting DefaultIcon for {}: {e}", spec.prog_id))?;

            let cmd_key = prog_key
                .create_subkey("shell\\open\\command")
                .map_err(|e| format!("Failed creating open command for {}: {e}", spec.prog_id))?
                .0;
            cmd_key
                .set_value("", &command_line)
                .map_err(|e| format!("Failed setting open command for {}: {e}", spec.prog_id))?;
        }

        unsafe {
            SHChangeNotify(
                SHCNE_ASSOCCHANGED,
                SHCNF_IDLIST,
                std::ptr::null(),
                std::ptr::null(),
            );
        }

        Ok(status(exe_path))
    }

    pub fn status(exe_path: &str) -> AssociationReport {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let classes_opt = hkcu.open_subkey_with_flags("Software\\Classes", KEY_READ);

        let mut items = Vec::with_capacity(BOOKVIBE_EXTENSION_SPECS.len());
        let mut all_ok = true;

        for spec in BOOKVIBE_EXTENSION_SPECS {
            let mut registered = false;
            let mut detail = String::from("Not yet registered in HKCU\\Software\\Classes");

            if let Ok(ref classes) = classes_opt {
                if let Ok(ext_key) = classes.open_subkey_with_flags(spec.dot_ext, KEY_READ) {
                    let mapped_prog: String = ext_key.get_value("").unwrap_or_default();
                    if mapped_prog == spec.prog_id {
                        let cmd_path = format!("{}\\shell\\open\\command", spec.prog_id);
                        if let Ok(cmd_key) = classes.open_subkey_with_flags(&cmd_path, KEY_READ) {
                            let cmd_val: String = cmd_key.get_value("").unwrap_or_default();
                            if !cmd_val.is_empty() {
                                registered = true;
                                detail = format!("HKCU\\Software\\Classes\\{} -> {}", spec.dot_ext, cmd_val);
                            }
                        }
                    } else if !mapped_prog.is_empty() {
                        detail = format!("Mapped to {}", mapped_prog);
                    }
                }
            }

            if !registered {
                all_ok = false;
            }

            items.push(ExtensionAssocStatus {
                extension: spec.dot_ext.to_string(),
                name: spec.name.to_string(),
                mime_type: spec.mime_type.to_string(),
                uti: spec.uti.to_string(),
                prog_id: spec.prog_id.to_string(),
                registered,
                detail,
            });
        }

        let _ = KEY_WRITE;
        AssociationReport {
            platform: "windows".to_string(),
            executable_path: exe_path.to_string(),
            scope: "HKEY_CURRENT_USER\\Software\\Classes (Zero-Admin)".to_string(),
            all_registered: all_ok,
            items,
        }
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    fn xdg_data_home() -> PathBuf {
        if let Ok(val) = std::env::var("XDG_DATA_HOME") {
            if !val.trim().is_empty() {
                return PathBuf::from(val);
            }
        }
        let home = std::env::var("HOME").unwrap_or_else(|_| String::from("."));
        PathBuf::from(home).join(".local").join("share")
    }

    pub fn register(exe_path: &str) -> Result<AssociationReport, String> {
        let data_dir = xdg_data_home();
        let mime_dir = data_dir.join("mime").join("packages");
        let apps_dir = data_dir.join("applications");
        fs::create_dir_all(&mime_dir).map_err(|e| format!("Failed creating mime dir: {e}"))?;
        fs::create_dir_all(&apps_dir).map_err(|e| format!("Failed creating applications dir: {e}"))?;

        let mime_xml_path = mime_dir.join("bookvibe.xml");
        let desktop_path = apps_dir.join("bookvibe.desktop");

        fs::write(&mime_xml_path, generate_freedesktop_mime_xml())
            .map_err(|e| format!("Failed writing {}: {e}", mime_xml_path.display()))?;
        fs::write(&desktop_path, generate_linux_desktop_entry(exe_path))
            .map_err(|e| format!("Failed writing {}: {e}", desktop_path.display()))?;

        let mime_root = data_dir.join("mime");
        let _ = Command::new("update-mime-database").arg(&mime_root).status();
        let _ = Command::new("update-desktop-database").arg(&apps_dir).status();

        Ok(status(exe_path))
    }

    pub fn status(exe_path: &str) -> AssociationReport {
        let data_dir = xdg_data_home();
        let mime_exists = data_dir.join("mime").join("packages").join("bookvibe.xml").exists();
        let desktop_exists = data_dir.join("applications").join("bookvibe.desktop").exists();
        let ok = mime_exists && desktop_exists;

        let items = BOOKVIBE_EXTENSION_SPECS
            .iter()
            .map(|spec| ExtensionAssocStatus {
                extension: spec.dot_ext.to_string(),
                name: spec.name.to_string(),
                mime_type: spec.mime_type.to_string(),
                uti: spec.uti.to_string(),
                prog_id: spec.prog_id.to_string(),
                registered: ok,
                detail: if ok {
                    "Registered in ~/.local/share/mime/packages/bookvibe.xml".to_string()
                } else {
                    "Pending XDG MIME registration".to_string()
                },
            })
            .collect();

        AssociationReport {
            platform: "linux".to_string(),
            executable_path: exe_path.to_string(),
            scope: "~/.local/share/mime & ~/.local/share/applications".to_string(),
            all_registered: ok,
            items,
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;

    pub fn register(exe_path: &str) -> Result<AssociationReport, String> {
        Ok(status(exe_path))
    }

    pub fn status(exe_path: &str) -> AssociationReport {
        let bundled = exe_path.contains(".app/Contents/MacOS");
        let items = BOOKVIBE_EXTENSION_SPECS
            .iter()
            .map(|spec| ExtensionAssocStatus {
                extension: spec.dot_ext.to_string(),
                name: spec.name.to_string(),
                mime_type: spec.mime_type.to_string(),
                uti: spec.uti.to_string(),
                prog_id: spec.prog_id.to_string(),
                registered: bundled,
                detail: if bundled {
                    format!("Declared via bundle Info.plist UTI {}", spec.uti)
                } else {
                    "Bundle as Bookvibe.app to activate LaunchServices UTIs".to_string()
                },
            })
            .collect();

        AssociationReport {
            platform: "macos".to_string(),
            executable_path: exe_path.to_string(),
            scope: "Info.plist CFBundleDocumentTypes / UTExportedTypeDeclarations".to_string(),
            all_registered: bundled,
            items,
        }
    }
}

pub fn current_exe_string() -> String {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| String::from("bookvibe"))
}

pub fn register_os_file_associations() -> Result<AssociationReport, String> {
    let exe = current_exe_string();
    platform::register(&exe)
}

pub fn get_association_status() -> AssociationReport {
    let exe = current_exe_string();
    platform::status(&exe)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_all_six_official_extensions() {
        assert_eq!(BOOKVIBE_EXTENSION_SPECS.len(), 6);
        for ext in ["bookvibe", ".bvibe", "BVBOOK", ".bvbible", "bvscene", ".bvstyle"] {
            assert!(find_spec_by_extension(ext).is_some(), "missing spec for {ext}");
        }
        assert!(find_spec_by_extension(".txt").is_none());
        assert!(is_supported_bookvibe_path(Path::new("draft.bvscene")));
        assert!(!is_supported_bookvibe_path(Path::new("notes.md")));
    }

    #[test]
    fn generates_valid_freedesktop_mime_xml_and_desktop_entry() {
        let xml = generate_freedesktop_mime_xml();
        assert!(xml.contains("application/vnd.bookvibe.project+json"));
        assert!(xml.contains("BOOKVIBE_V1"));
        assert!(xml.contains("*.bvstyle"));

        let desktop = generate_linux_desktop_entry("/opt/bookvibe/bookvibe");
        assert!(desktop.contains("Exec=\"/opt/bookvibe/bookvibe\" %u"));
        assert!(desktop.contains("application/vnd.bookvibe.scene+json"));
    }
}
