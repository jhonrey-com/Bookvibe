# Official File Extension & Media Type Registration Guide

Bookvibe defines six official, double-clickable file extensions engineered on UTF-8 JSON with deterministic `"magic": "BOOKVIBE_V1"` header detection and formal JSON Schema validation (`schemas/bookvibe-extensions.schema.json`).

---

## 1. Local & Per-OS Execution (Automatic Zero-Admin Registration)

When you run the native Bookvibe desktop executable (`bookvibe.exe`, `Bookvibe.app`, or `bookvibe` AppImage/binary), Bookvibe automatically ensures OS associations exist for the active user:

- **Windows**: Writes per-user ProgIDs (`Bookvibe.Project.1`, `Bookvibe.CompactProject.1`, `Bookvibe.Manuscript.1`, `Bookvibe.Bible.1`, `Bookvibe.Scene.1`, `Bookvibe.Style.1`) under `HKEY_CURRENT_USER\Software\Classes` (zero UAC elevation required) and notifies Windows Explorer (`SHChangeNotify`).
- **macOS**: Declared directly in `Info.plist` via `CFBundleDocumentTypes` and `UTExportedTypeDeclarations` (`org.bookvibe.*`, conforming to `public.json`).
- **Linux**: Installs `packaging/bookvibe-mime.xml` to `~/.local/share/mime/packages/bookvibe.xml` and `~/.local/share/applications/bookvibe.desktop`, then refreshes the XDG MIME database.

---

## 2. Official IANA RFC 6838 Vendor Media Type Templates

Use the templates below to submit official global registration requests to the IANA Media Types Registry at <https://www.iana.org/form/media-types> under the **Vendor Tree (`vnd.`)** (no IETF RFC required; vendor tree registrations are open to open-source maintainers):

### Template A: `application/vnd.bookvibe.project+json` (`.bookvibe`, `.bvibe`)
- **Type name**: `application`
- **Subtype name**: `vnd.bookvibe.project+json`
- **Required parameters**: None
- **Optional parameters**: None
- **Encoding considerations**: Binary (UTF-8 encoded JSON as per RFC 8259)
- **Security considerations**: Files are strictly declarative JSON data parsed without code execution, macros, or external script evaluation. Parsers must guard against oversized payloads and prototype-pollution keys (`__proto__`, `constructor`).
- **Interoperability considerations**: UTF-8 JSON conforming to `schemas/bookvibe-extensions.schema.json` with `"magic": "BOOKVIBE_V1"`.
- **Published specification**: `https://github.com/jhonrey-com/Bookvibe/blob/main/schemas/bookvibe-extensions.schema.json`
- **Applications that use this media type**: Bookvibe Desktop Studio
- **File extension(s)**: `bookvibe`, `bvibe`
- **Macintosh file type code(s) / UTI**: `org.bookvibe.project`, `org.bookvibe.compact-project` (conforms to `public.json`)

### Template B: `application/vnd.bookvibe.manuscript+json` (`.bvbook`)
- **Subtype name**: `vnd.bookvibe.manuscript+json`
- **File extension(s)**: `bvbook`
- **UTI**: `org.bookvibe.manuscript` (conforms to `public.json`)
- **Magic header**: `"magic": "BOOKVIBE_V1"` + `"extension": ".bvbook"`

### Template C: `application/vnd.bookvibe.bible+json` (`.bvbible`)
- **Subtype name**: `vnd.bookvibe.bible+json`
- **File extension(s)**: `bvbible`
- **UTI**: `org.bookvibe.bible` (conforms to `public.json`)
- **Magic header**: `"magic": "BOOKVIBE_V1"` + `"extension": ".bvbible"`

### Template D: `application/vnd.bookvibe.scene+json` (`.bvscene`)
- **Subtype name**: `vnd.bookvibe.scene+json`
- **File extension(s)**: `bvscene`
- **UTI**: `org.bookvibe.scene` (conforms to `public.json`)
- **Magic header**: `"magic": "BOOKVIBE_V1"` + `"extension": ".bvscene"`

### Template E: `application/vnd.bookvibe.style+json` (`.bvstyle`)
- **Subtype name**: `vnd.bookvibe.style+json`
- **File extension(s)**: `bvstyle`
- **UTI**: `org.bookvibe.style` (conforms to `public.json`)
- **Magic header**: `"magic": "BOOKVIBE_V1"` + `"extension": ".bvstyle"`

---

## 3. Public Registry Submissions Checklist

1. **IANA Vendor Tree**: Submit the five `+json` media types via <https://www.iana.org/form/media-types>. Approval typically completes in 2–3 weeks with a permanent IANA registry entry.
2. **FreeDesktop `shared-mime-info`**: Open a Merge Request on `gitlab.freedesktop.org/xdg/shared-mime-info` incorporating the entries from `packaging/bookvibe-mime.xml` so Linux distributions recognize all 6 extensions natively.
3. **GitHub Linguist**: `.gitattributes` already sets `linguist-language=JSON` for Bookvibe repositories. Once public GitHub usage grows, open a PR to `github-linguist/linguist` (`lib/linguist/languages.yml`) adding `.bookvibe`, `.bvibe`, `.bvbook`, `.bvbible`, `.bvscene`, and `.bvstyle`.
4. **Public Extension Directories & Wikidata**: Submit format items (`Q`-entities) to Wikidata and FileInfo.com referencing the published IANA MIME type and JSON Schema URL.
