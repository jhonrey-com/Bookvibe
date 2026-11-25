# Security & Quality Policy

## Supported Versions

| Version | Status |
| :--- | :--- |
| `2.3.x` | Supported (active website & Windows / macOS / Linux desktop releases) |
| `< 2.3.0` | Upgrade to latest release |

---

## Reporting Security, Bugs, or Malfunctions

If you run into a security issue, unexpected error code (`QV-101`–`QV-504`), file-loading defect, or data-loss bug in Quillvibe:

- **Direct Email:** <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>quillvibe@jhonrey.com</strong></a>
- Include the error code (if shown in the Error Dialog — click **Copy Error Report**), steps to reproduce, the file extension or workspace affected (`.qv`, `.qvbible`, `.qvscene`, `.qvstyle`, `.qvext`, image studio, LAN sync, desktop app, or web studio), and your Quillvibe version.
- Please do not open public GitHub issues for unpatched security vulnerabilities until a fix has been reviewed and published.

---

## Architecture & Safety Standards

- **Local-First Ownership:** Quillvibe collects zero analytics or telemetry, requires no account, and never sends manuscript text off your device unless you start a local Wi-Fi PIN, Bluetooth, or self-hosted HTTPS sync.
- **Protected QVBX Files:** `.qv`, `.qvbible`, `.qvscene`, and `.qvstyle` files use Quillvibe's encrypted and authenticated binary `QVBX` container (with optional password locking) that rejects tampered or damaged files, verifies permanent pen-name Author Keys, and checks payloads for unsafe script or executable content.
- **Safe Input Handling:** Imported `.docx`, `.html`, `.rtf`, `.md`, SVG graphics, images, and legacy `.quillvibe` / `.bookvibe` archives pass through strict sanitizers without `innerHTML`, `eval`, or `new Function`.
- **Desktop Isolation (Tauri v2):** Desktop builds enforce Content Security Policy (`default-src 'self'`), scoped IPC commands, loopback-authenticated single-instance file forwarding, and private-LAN address checks on peer sync.
- **Publisher Note:** Windows desktop binaries are Authenticode-signed under `CN=jhonrey.com` (`jhonrey.com-Quillvibe.cer` is attached to each release). Because Quillvibe is a free open-source project without a paid commercial app-store certificate, Windows, macOS, or Linux may display a standard publisher warning when installing; users who prefer not to install can use <a href="https://quillvibe.jhonrey.com/" target="_blank" rel="noopener noreferrer">https://quillvibe.jhonrey.com/</a> directly in the browser.
