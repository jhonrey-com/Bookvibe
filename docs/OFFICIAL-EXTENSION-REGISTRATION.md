# Official File Extension & Media Type Registration Guide

Quillvibe defines six official, double-clickable file extensions built on the protected `QVBX` binary container (`schemas/quillvibe-extensions.schema.json`).

---

## 1. Local & Per-OS Execution (Automatic Zero-Admin Registration)

When you run the native Quillvibe desktop executable (`quillvibe.exe`, `Quillvibe.app`, or `quillvibe` AppImage/binary), Quillvibe automatically registers OS associations for the active user:

- **Windows**: Writes per-user ProgIDs (`Quillvibe.Project.2`, `Quillvibe.CompactProject.2`, `Quillvibe.Manuscript.2`, `Quillvibe.Bible.2`, `Quillvibe.Scene.2`, `Quillvibe.Style.2`) under `HKEY_CURRENT_USER\Software\Classes` (zero UAC elevation required) and notifies Windows Explorer (`SHChangeNotify`).
- **macOS**: Declared directly in `Info.plist` via `CFBundleDocumentTypes` and `UTExportedTypeDeclarations` (`app.quillvibe.*`).
- **Linux**: Installs `packaging/quillvibe-mime.xml` to `~/.local/share/mime/packages/quillvibe.xml` and `~/.local/share/applications/quillvibe.desktop`, then refreshes the XDG MIME database.

Legacy `.bookvibe` / `.bv*` extensions are **not** registered for OS double-click opening; users can import legacy files inside **Settings -> Publishing, Commercial & Migration -> Import**.

---

## 2. Official IANA RFC 6838 Vendor Media Type Templates

### Template A: `application/vnd.quillvibe.project` (`.quillvibe`, `.qvibe`)
- **Type name**: `application`
- **Subtype name**: `vnd.quillvibe.project`
- **Encoding considerations**: Binary (`QVBX` encrypted and authenticated container)
- **Published specification**: `https://github.com/jhonrey-com/Quillvibe/blob/main/schemas/quillvibe-extensions.schema.json`
- **Applications that use this media type**: Quillvibe Desktop Studio
- **File extension(s)**: `quillvibe`, `qvibe`
- **Macintosh UTI**: `app.quillvibe.project`, `app.quillvibe.compact-project`

### Template B: `application/vnd.quillvibe.manuscript` (`.qvbook`)
- **Subtype name**: `vnd.quillvibe.manuscript`
- **File extension(s)**: `qvbook`
- **UTI**: `app.quillvibe.manuscript`
- **Magic header**: `QVBX` binary container

### Template C: `application/vnd.quillvibe.bible` (`.qvbible`)
- **Subtype name**: `vnd.quillvibe.bible`
- **File extension(s)**: `qvbible`
- **UTI**: `app.quillvibe.bible`
- **Magic header**: `QVBX` binary container

### Template D: `application/vnd.quillvibe.scene` (`.qvscene`)
- **Subtype name**: `vnd.quillvibe.scene`
- **File extension(s)**: `qvscene`
- **UTI**: `app.quillvibe.scene`
- **Magic header**: `QVBX` binary container

### Template E: `application/vnd.quillvibe.style` (`.qvstyle`)
- **Subtype name**: `vnd.quillvibe.style`
- **File extension(s)**: `qvstyle`
- **UTI**: `app.quillvibe.style`
- **Magic header**: `QVBX` binary container

---

## 3. Public Registry Submissions Checklist

1. **IANA Vendor Tree**: Submit the five media types via <https://www.iana.org/form/media-types>.
2. **FreeDesktop `shared-mime-info`**: Incorporate `packaging/quillvibe-mime.xml`.
3. **GitHub Linguist**: `.gitattributes` marks `*.quillvibe` / `*.qv*` as `binary`.
