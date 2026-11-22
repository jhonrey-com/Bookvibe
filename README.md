# Bookvibe

Open-source desktop book writing, story bible, and EPUB/PDF typesetting app. Runs natively in one click without setup, requires no accounts or network services, and opens directly from double-clickable file extensions.

## Features

- **One-Click Execution**: Standalone native desktop binaries for Windows (`.exe` / `.msi`), macOS (`.dmg` / `.app`), and Linux (`.AppImage` / `.deb`), plus one-click launchers (`Start-Bookvibe.bat`, `Start-Bookvibe.command`, `start-bookvibe.sh`).
- **Manuscript Hierarchy**: Organize books into Parts, Chapters, and Scenes with drag-and-drop reordering, Corkboard index cards, and an architectural Outline ledger.
- **Studio Editor**: Distraction-free Zen mode, Typewriter vertical centering, selectable paper sheets (*Obsidian Ink*, *Warm Parchment*, *Classic Ivory*), Split-Screen reference pane, immutable Snapshots with word-level diffing, and a built-in Writing Sprint timer.
- **Story Bible & Worldbuilding**: Structured Characters, Locations, and Lore & Items databases with automatic boundary-safe mention indexing across every scene.
- **Typesetting & Export**: Live paginated book preview with trim sizes (`5" × 8"`, `5.5" × 8.5"`, `6" × 9"`, `A5`), first-paragraph drop caps, chapter numeral styles, smart quotes/dashes, and native one-click export to **EPUB 3 (`.epub`)**, **Print-Ready PDF**, and **Markdown (`.md`)**.
- **Human Writing Focus**: No AI features, no telemetry, and full local file ownership.

## Official File Extensions

Every Bookvibe file begins with `"magic": "BOOKVIBE_V1"` and can be opened directly by double-clicking it in Windows Explorer, macOS Finder, or Linux Files:

| Extension | Format Name | Official MIME Type | Apple UTI | Behavior on Open |
| :--- | :--- | :--- | :--- | :--- |
| `.bookvibe` | Bookvibe Master Project | `application/vnd.bookvibe.project+json` | `org.bookvibe.project` | Opens complete project (manuscript, snapshots, story bible, typography). |
| `.bvibe` | Bookvibe Compact Project | `application/vnd.bookvibe.project+json` | `org.bookvibe.compact-project` | Short-alias project container; identical to `.bookvibe`. |
| `.bvbook` | Bookvibe Manuscript Package | `application/vnd.bookvibe.manuscript+json` | `org.bookvibe.manuscript` | Opens manuscript hierarchy & book metadata directly in the Editor. |
| `.bvbible` | Bookvibe Story Bible DB | `application/vnd.bookvibe.bible+json` | `org.bookvibe.bible` | Imports or merges Characters, Locations, and Lore across books. |
| `.bvscene` | Bookvibe Standalone Scene | `application/vnd.bookvibe.scene+json` | `org.bookvibe.scene` | Opens an individual scene draft and snapshots into the Editor. |
| `.bvstyle` | Bookvibe Typeset Preset | `application/vnd.bookvibe.style+json` | `org.bookvibe.style` | Applies trim size, margins, typography, and drop-cap rules. |

See [docs/OFFICIAL-EXTENSION-REGISTRATION.md](docs/OFFICIAL-EXTENSION-REGISTRATION.md) for the IANA RFC 6838 MIME templates, FreeDesktop `shared-mime-info` rules, Windows ProgID registry spec, and JSON Schema definitions.

## Quick Start

### Option A: Double-Click Launcher
- **Windows**: Double-click `Start-Bookvibe.bat` (or drag any `.bookvibe` / `.bvscene` file onto it).
- **macOS**: Double-click `Start-Bookvibe.command`.
- **Linux**: Run `./start-bookvibe.sh` (or pass a file path: `./start-bookvibe.sh examples/the-salt-cartographer.bookvibe`).

### Option B: Developer Build
```bash
npm install
npm run typecheck
npm test
npm run tauri:dev
```

To build a standalone portable executable:
```bash
npm run tauri:build
```

## Keyboard Shortcuts

- `Ctrl/Cmd + S`: Save & create quick revision checkpoint
- `Ctrl/Cmd + O`: Open any Bookvibe extension file (`.bookvibe`, `.bvibe`, `.bvbook`, `.bvbible`, `.bvscene`, `.bvstyle`)
- `Ctrl/Cmd + Shift + F`: Toggle Zen Focus mode
- `Ctrl/Cmd + B`: Bold Markdown span
- `Ctrl/Cmd + I`: Italic Markdown span

## License

Released under the [MIT License](LICENSE).
