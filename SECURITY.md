# Security & Quality Policy

## Supported Versions

| Version | Status |
| :--- | :--- |
| `2.0.x` | Supported (active web & desktop releases) |
| `< 2.0.0` | Upgrade to latest release |

---

## Reporting Security or Quality Vulnerabilities

If you discover a security vulnerability, unsafe file parser behavior, extension sandbox bypass, or data-loss defect in Quillvibe:

- **Direct Email:** **quillvibe@jhonrey.com** *(replies are handled by the maintainer)*
- Please include steps to reproduce, the file extension or workspace affected (`.quillvibe`, `.qvext`, `.docx` importer, LAN sync, desktop binary, or browser web studio), and the Quillvibe version.
- Do not open public GitHub issues for unpatched security vulnerabilities until a fix has been reviewed and published.

---

## Architecture & Quality Standards

- **Local-First Ownership:** Quillvibe collects zero telemetry, requires no account, and never transmits manuscript data outside your device unless you initiate local Wi-Fi PIN, Bluetooth, or self-hosted HTTPS sync.
- **Protected QVBX File Containers:** `.quillvibe`, `.qvibe`, `.qvbook`, `.qvbible`, `.qvscene`, and `.qvstyle` files use a proprietary encrypted and authenticated `QVBX` binary format (with optional PBKDF2-SHA-256 password locks) that rejects damaged or externally tampered files, detects pen-name Author Key tampering, and scans payloads for active scripts or executable headers.
- **Input Sanitization:** Imported SVG graphics, Word XML, HTML, legacy `.bookvibe` imports, and user prose strings pass through deterministic sanitizers without `innerHTML`, `eval`, or `new Function`.
- **Desktop Sandbox (Tauri v2):** Native builds enforce Content Security Policy (`default-src 'self'`), scoped IPC commands, and loopback/private-LAN address checks on peer sync.
