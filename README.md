<p align="center">
  <img src="assets/banners/bookvibe-header.svg" alt="Bookvibe — Open-source book writing, proofreading, worldbuilding, and typesetting studio" width="100%" />
</p>

Bookvibe is a cross-platform book writing application built so writers can draft notes, organize manuscripts, edit with traditional proofreading marks, manage story bibles and relationship graphs, install custom fonts, design print covers, and export release-ready books from one local workspace. It runs offline with zero account sign-ins, stores work in plain UTF-8 files you control, and syncs manuscripts directly across computers on your Wi-Fi or Bluetooth connection.

> **Use Directly in Browser (No Install Required):** **[Launch Bookvibe Web Studio (`jhonrey-com.github.io/Bookvibe`)](https://jhonrey-com.github.io/Bookvibe/)**  
> **Desktop Releases (`v1.3.0` — Windows `.msi`/`.exe`, macOS Universal `.dmg`, Linux `.AppImage`/`.deb`):** **[Download From GitHub Releases](https://github.com/jhonrey-com/Bookvibe/releases/latest)**

<p align="center">
  <img src="assets/banners/bookvibe-workspace.svg" alt="Bookvibe five-stage studio: Draft & Proofread, Organize Cards & Bible, Live Story Graph, Offline LAN Sync, Typeset & Full Cover Wrap" width="100%" />
</p>

---

## Table of Contents

1. [Why Keep Everything in One Workspace](#1-why-keep-everything-in-one-workspace)
2. [How to Install, Run in Browser & Launch Bookvibe](#2-how-to-install-run-in-browser--launch-bookvibe)
3. [Guides by Writing Level (Basic, Intermediate, Commercial)](#3-guides-by-writing-level-basic-intermediate-commercial)
4. [All Studio Workspaces, Bottom Sprint Controls & Icon Legend](#4-all-studio-workspaces-bottom-sprint-controls--icon-legend)
5. [Custom Fonts, Cover Wrap Studio & Migration](#5-custom-fonts-cover-wrap-studio--migration)
6. [File Formats & Double-Click Support](#6-file-formats--double-click-support)
7. [Extensions, Permissions & Developer Add-ons](#7-extensions-permissions--developer-add-ons)
8. [Keyboard Shortcuts](#8-keyboard-shortcuts)
9. [FAQ, Controls Reference & Contributing](#9-faq-controls-reference--contributing)

---

## 1. Why Keep Everything in One Workspace

Many writers split work across five programs: a text editor for Markdown notes, spreadsheets for outlines, whiteboard apps for plot graphs, image editors for covers, and conversion scripts for EPUB files. Bookvibe replaces that chain with integrated tools sharing one local project file:

- **Zero setup & zero lock-in**: Open an example or blank project right away. Every `.bookvibe` file is plain UTF-8 JSON with human-readable scenes and a public format schema.
- **Works cleanly for small notes or multi-volume books**: Treat it as a quiet Markdown scratchpad (`Ctrl+B`, `Ctrl+I`, `.md` export) or manage an entire catalog under separate pen names.
- **Real proofreading workflow**: Instead of overwriting prose blindly, apply 15 copyediting marks on the page, toggle *Clean Preview*, and accept edits with automatic snapshot backups.
- **Commercial publishing basics built in**: Configure imprint metadata, ISBN, editorial stage, custom device fonts (`.ttf`, `.otf`, `.woff`, `.woff2`), full jacket cover wraps (front, spine, back, and flaps), and ECDSA Author Key signatures.

---

## 2. How to Install, Run in Browser & Launch Bookvibe

### Option A: Open Immediately in Any Browser (GitHub Pages)
Visit **[https://jhonrey-com.github.io/Bookvibe/](https://jhonrey-com.github.io/Bookvibe/)** to write, organize Story Bibles, proofread, design covers, and export `.bookvibe` / `.epub` / `.md` files immediately with zero setup.

### Option B: Desktop Installers (Frameless Native App)
Download from **[GitHub Releases (`v1.3.0`)](https://github.com/jhonrey-com/Bookvibe/releases/latest)** (uses a custom frameless obsidian titlebar with drag/minimize/maximize/close instead of default OS bars):
- **Windows:** `.msi` or `.exe`
- **macOS:** Universal `.dmg` (Apple Silicon & Intel)
- **Linux:** `.AppImage` or `.deb`

### Option C: Terminal Installers

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/jhonrey-com/Bookvibe/main/scripts/install.ps1 | iex
```
*(Or Winget manifest `packaging/winget/jhonrey.Bookvibe.yaml`.)*

**macOS & Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/jhonrey-com/Bookvibe/main/scripts/install.sh | sh
```
*(Or Homebrew Cask via `packaging/homebrew/bookvibe.rb`.)*

### Option D: One-Click Repo Launchers & Source Build
- **Windows / macOS / Linux repo launchers:** `Start-Bookvibe.bat`, `Start-Bookvibe.command`, or `./start-bookvibe.sh`
- Requirements from source: Node.js 20+ (and Rust toolchain for `npm run tauri:build`)

```bash
git clone https://github.com/jhonrey-com/Bookvibe.git
cd Bookvibe
npm install

# Start browser UI preview at http://localhost:1420
npm run dev

# Or run / bundle the native desktop app
npm run tauri:dev
npm run tauri:build
```

---

## 3. Guides by Writing Level (Basic, Intermediate, Commercial)

### Level 1 — Basic: Quick Notes, Journal Scenes & Markdown Builder
You do not need chapters, story bibles, or cover art just to take notes or draft essays.
1. Open Bookvibe. On your first visit, a short splash transition leads into an optional pointer tour you can follow step by step or skip in one click (`Skip All` / `Skip Section`).
2. Click inside **Manuscript** (`Draft` mode) and type directly on **Obsidian**, **Parchment**, or **Ivory** paper.
3. Use `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, `H2`, blockquote `❝`, or `* * *` buttons to format clean Markdown.
4. Change the topbar Save format dropdown to **`.md` (Markdown)** or **`.bvscene` (Single Scene)** and click Save (`Ctrl+S` in non-editor views exports directly; in Editor `Ctrl+S` captures a revision snapshot).
5. Drag any `.md` or `.txt` note onto the window to start a structured project from plain text.

### Level 2 — Intermediate: Series Worldbuilding, Proofing & Live Story Graph
When stories expand beyond a single draft:
1. **Parts, Chapters & Scenes**: Manage hierarchy in the left **Binder** drawer, split long scenes at the cursor (`split-scene`), and track word targets per scene and sprint session.
2. **Corkboard & Outline**: Switch to **Corkboard** to rearrange index cards between chapters or **Outline** to filter scenes by status, POV character, timeline, or reading minutes.
3. **Story Bible**: Keep structured cards for Characters, Locations, Lore, plus your own custom categories (Magic Rules, Ships, Historical Eras). Drag images into cards and add custom key/value traits.
4. **Live Story Graph**:
   - Drag any card and connected lines and labels move live with it.
   - Hover a card to reveal edge **Port Dots** (`●`), then drag a dot onto another card to wire a link in one gesture.
   - Switch right inside the graph toolbar between **Compact**, **Standard**, and **Detailed** card density, **Curved / Step / Straight** line routing, **Columns / Radial / Flow** layouts, 24px **Grid Snap**, search highlighting, and clean **SVG export**.
5. **Proofread Mode**: Select any sentence on the proof sheet to strike out (`₰`), propose insertions (`∧`), replace words (`⇄`), transpose neighbors (`tr`), mark *let stand* (`stet`), or leave author queries (`AQ`). Toggle **Clean Preview** before accepting changes.

### Level 3 — Professional: Multi-Book Catalog, Custom Fonts, Migration & Press Releases
For independent publishers, co-author teams, and full print production:
1. **Multi-Book Library & ECDSA Author Keys**: Click **Library** in the topbar to keep multiple manuscripts, switch active projects, set per-book **Pen Names**, draw ink **Signatures**, and sign editions locally with an ECDSA P-256 **Author Key**.
2. **Migrate From Word & Google Docs**: Open **Settings -> Publishing & Migration** (or drop a file on the window) to import `.docx` (Word), `.html` (Google Docs Web Export), `.rtf`, `.md`, or `.txt` manuscripts cleanly into Bookvibe chapters.
3. **Co-Authors & Offline LAN / Bluetooth Sync**: Add credited editors, proofreaders, and co-authors in **Collaborate**. Exchange revisions over the same router with a 6-digit PIN LAN session or save/merge signed `.bookvibe` packages over Bluetooth with zero internet connection.
4. **Editorial Handoff Report**: Export a clean Markdown **Editorial Handoff Sheet** summarizing ISBN, imprint, stage, open proof marks, chapter word counts, and collaborator credits.

---

## 4. All Studio Workspaces, Bottom Sprint Controls & Icon Legend

Every toolbar button and section tab in Bookvibe uses its own dedicated icon so controls never look ambiguous. Press `F1` or click **Help (`?`)** inside the app to search every slider, lever, dropdown, icon, and section live, or read **[docs/FAQ-AND-CONTROLS.md](docs/FAQ-AND-CONTROLS.md)**.

### Bottom Status Bar & Sprint Controls
- **Metrics Ledger (Bottom Left):** Scene words/characters, Chapter words, Book progress against target, estimated print pages (`~250` w/p), and reading time.
- **Sprint Duration (`15m` / `25m` / `45m`, Bottom Right):** Selects timed sprint minutes, resets the countdown, and zeroes session word delta (`+0w`).
- **`Start` / `Pause` (Bottom Right):** Starts or freezes the countdown while counting newly drafted words.
- **`Reset` (Bottom Right):** Clears any running sprint back to the full chosen interval and zeroes `+0w`.

### Top Header Controls
- **Binder (`panel-left`)**: Toggle left manuscript tree (overlays cleanly on tablet/narrow windows).
- **Library (`library`)**: Switch books, edit pen names, draw signatures, and manage Author Keys.
- **Collaborate (`collab`)**: Manage co-authors, proofreaders, LAN PIN sync, and Bluetooth file exchange.
- **Open (`folder`)**: Open Bookvibe files (`.bookvibe`, `.bvibe`, `.bvbook`, `.bvbible`, `.bvscene`, `.bvstyle`) or `.bvext` add-ons.
- **Save + Extension Selector (`save`)**: Export immediately in the selected file format.
- **Extensions (`extensions`)**: Enable integrated toolkits, install `.bvext` files with explicit permission review, view audit logs, or register OS shell extensions.
- **Settings (`settings`)**: Install custom fonts, customize editor spacing/density, set Imprint/ISBN/Stage, import `.docx`/Google Docs, and inspect developer info.
- **Help (`help`)**: Open built-in Icon Legend, beginner-to-pro guides, and replay first-visit animated tours.
- **Inspector (`panel-right`)**: Toggle right-hand Scene Inspector across every view without losing cursor position.

### Main View Switcher & Sub-Tabs
- **Manuscript (`quill`)**: Houses **Draft (`draft-sheet`)**, **Proofread (`proofread`)**, **Split View (`split`)**, and **Revision Diff (`diff`)**.
- **Corkboard (`corkboard`)** · **Outline (`outline`)** · **Story Bible (`bible`)** · **Story Graph (`graph`)**
- **Typeset & Cover (`typeset`)**: Houses **Interior Typeset (`page-margins`)**, **Cover Studio (`cover`)**, and **Publish & Author Seal (`seal`)**.

---

## 5. Custom Fonts, Cover Wrap Studio & Migration

### Installing Device & Extension Fonts
Open **Settings -> Typefaces & Fonts**:
- Drag-and-drop or browse local **`.ttf`**, **`.otf`**, **`.woff`**, or **`.woff2`** files from your computer (verified by binary magic-byte inspection).
- Use **Pick Installed OS Font** in supported Chromium/desktop contexts, or install curated font packs via `.bvext` extensions.
- Apply installed fonts separately to your **Draft paper sheet**, your paginated **Book Interior Typeset** (plus HTML/EPUB exports), and your **Cover typography**.

### Front, Back, Spine & Dust Jacket Cover Studio
Open **Typeset & Cover -> Cover Studio**:
- Switch between **Front**, **Back**, **Spine**, **Full Print Wrap**, and **Dust Jacket (with Flaps)**.
- Drop sanitized **`.svg` artwork** (including Canva/Illustrator exports with scripts stripped automatically) or transparent **`.png` / `.webp`** graphics directly onto any cover face, plus one-click built-in book ornaments.
- Adjust position by dragging, resize/rotate/fade layers in the Layer Inspector, toggle the back-cover ISBN barcode box, and export **1200×1920 Front Cover PNG** or **Full Print Wrap PNG**.

---

## 6. File Formats & Double-Click Support

Every Bookvibe document wraps readable JSON in `"magic": "BOOKVIBE_V1"` paired with matching MIME types (`packaging/bookvibe-mime.xml`, Windows `.reg` helpers, macOS UTIs in `src-tauri/Info.plist`):

| Extension | Role | Double-Click Action |
| :--- | :--- | :--- |
| **`.bookvibe`** | Complete Book Archive | Opens entire manuscript, Story Bible, Graph, cover wrap, marks, snapshots, and public key seal. |
| **`.bvibe`** | Compact Project Alias | Identical schema to `.bookvibe` with a shorter filename extension. |
| **`.bvbook`** | Manuscript Package | Opens manuscript parts, chapters, scenes, front matter, credits, and cover without worldbuilding DBs. |
| **`.bvbible`** | Story Bible Database | Merges Characters, Locations, Lore, and Custom Categories into the open book or starts a series companion. |
| **`.bvscene`** | Single Scene Draft | Opens or imports one scene along with snapshots and proofreading marks. |
| **`.bvstyle`** | Typeset & Paper Style | Applies trim size, font stack, drop caps, smart quotes, margins, and paper theme cleanly. |

More detail: [docs/OFFICIAL-EXTENSION-REGISTRATION.md](docs/OFFICIAL-EXTENSION-REGISTRATION.md) and [docs/GUIDE.md](docs/GUIDE.md).

---

## 7. Extensions, Permissions & Developer Add-ons

Bookvibe distinguishes between **Integrated** toolkits shipped with the app and external **`.bvext`** community add-ons:
- Integrated modules include Editorial Proofing, Typographic Punctuation Cleanup, Readability & Pacing Ledger, Print Trim Presets, and Editorial Font Packs.
- External `.bvext` add-ons are declarative JSON manifests validated with SHA-256 fingerprints, sandboxed against network calls or filesystem access, and gated behind checkbox consent (`read:active-scene`, `propose:proofread-marks`, `apply:text-transform`, `read:manuscript`, `read:bible`, `add:export-preset`, `add:font-pack`).
- Every extension invocation is recorded in the local **Data Access Audit Log**.

Developers building new add-ons can read the full specification in **[docs/DEVELOPER-EXTENSIONS.md](docs/DEVELOPER-EXTENSIONS.md)**.

---

## 8. Keyboard Shortcuts

| Keys | Command |
| :--- | :--- |
| `Ctrl / Cmd + S` | Save Revision Snapshot in Manuscript view; export default format in other views |
| `Ctrl / Cmd + O` | Open any `.bookvibe`, `.bv*`, or `.bvext` file |
| `Ctrl / Cmd + B` / `I` | Bold / Italic Markdown wrapping around selection |
| `Ctrl / Cmd + Shift + F` | Toggle Zen Focus mode |
| `F1` | Open the Help manual & Icon Legend |
| `Esc` | Close modal overlays, exit active walkthrough tour, or exit Zen Focus |

---

## 9. FAQ, Controls Reference & Contributing

- **Complete UI & FAQ Reference:** Read **[docs/FAQ-AND-CONTROLS.md](docs/FAQ-AND-CONTROLS.md)** for full answers on every slider, lever, dropdown (`15m`/`25m`/`45m`), sprint `Start` / `Reset`, custom fonts, cover design, and offline sync.
- **Contributions:** Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** before submitting pull requests:
  - **Fork & branch first**: Keep commits off `main` in forks; work in dedicated topic branches.
  - **Run local checks**: Ensure `npm run typecheck`, `npm test`, and `npm run build` succeed cleanly after your last edit.
  - **Build provenance**: Bookvibe packages and sample documents embed quiet origin verification marks belonging to **`jhonrey.com`** (`bookvibe@jhonrey.com`). Forks retain MIT rights while cleanly preserving upstream attribution.

## License

Released under the [MIT License](LICENSE).
