# Security & Quality Policy

## Supported Versions

| Version | Status |
| :--- | :--- |
| `1.3.x` | Supported (active web & desktop releases) |
| `< 1.3.0` | Upgrade to latest release |

---

## Reporting Security or Quality Vulnerabilities

If you discover a security vulnerability, unsafe file parser behavior, extension sandbox bypass, or data-loss defect in Bookvibe:

- **Direct Email:** **bookvibe@jhonrey.com** *(replies are answered directly by the maintainer from `contact@jhonrey.com`)*
- Please include steps to reproduce, the file extension or workspace affected (`.bookvibe`, `.bvext`, `.docx` importer, LAN sync, desktop binary, or browser web studio), and the Bookvibe version.
- Do not open public GitHub issues for unpatched security vulnerabilities until a fix has been reviewed and published.

---

## Architecture & Quality Standards

- **Local-First Ownership:** Bookvibe collects zero telemetry, requires no account, and never transmits manuscript data outside your device unless you initiate local Wi-Fi PIN or Bluetooth transfer.
- **No Active Script Execution:** `.bv*` documents are UTF-8 JSON archives parsed cleanly with prototype-pollution key filtering. External `.bvext` extensions are declarative JSON only, validated with SHA-256 digests and consent-gated permissions.
- **Input Sanitization:** Imported SVG graphics, Word XML, HTML, and user prose strings pass through deterministic sanitizers without `innerHTML`, `eval`, or `new Function`.
- **Desktop Sandbox (Tauri v2):** Native builds enforce Content Security Policy (`default-src 'self'`), scoped IPC commands, and loopback/private-LAN address checks on peer sync.
