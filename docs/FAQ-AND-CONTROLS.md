# Quillvibe Controls, Sliders, Levers & FAQ Reference

Plain guide to every button, dropdown, slider, lever switch, section, and workflow in Quillvibe.

---

## 1. Frequently Asked Questions

### How do I run Quillvibe without installing anything?
Open the live web studio at **`https://quillvibe.jhonrey.com/`**. No account or login is needed—everything runs directly in your browser. Click **Save** before closing so your `.qv` file is saved safely on your computer rather than only inside temporary browser storage.

### How do I install Quillvibe as a desktop app?
Download the installer for your OS from **`https://github.com/jhonrey-com/Quillvibe/releases/latest`** (published under **`jhonrey.com`**):
- **Windows:** `.msi` installer or NSIS `.exe`
- **macOS:** Universal `.dmg` (Apple Silicon & Intel)
- **Linux:** `.AppImage` or `.deb`

Desktop installers open maximized on first launch, include enterprise Minimize/Maximize/Close controls on the Welcome screen, automatically save projects to disk on your device, and register `.qv`, `.qvbible`, `.qvscene`, and `.qvstyle` double-click associations plus local Wi-Fi PIN sync, Bluetooth transfer, multi-window book editing, and `F11` Immersive Fullscreen mode (with movable/collapsible HUD and top-edge screen hover strip).

### What works in the browser (`https://quillvibe.jhonrey.com/`) vs. desktop executables?
Writing (with strict word spellcheck off by default and toggleable in Settings), global `Ctrl+Z` / `Ctrl+Y` undo/redo, proofreading, Corkboard, Outline, Story Bible, Story Graph, Typeset & Cover Studio, mobile layout, real PDF 1.4 export + EPUB/Markdown/HTML, Origin Author & Device Keys (`QVK-`/`QVD-`), Work Copyright Seals (`QVC-`), Verified Multi-Device Co-Author tokens (`QVCA1.`), Self-Hosted HTTPS sync, `/course` Academy lessons, and importing/exporting protected `.qv` files all work directly in desktop and mobile browsers.

Features that require direct operating-system APIs — **Immersive Fullscreen HUD (`F11`)**, **Multi-Window parallel book windows**, **Same-Wi-Fi LAN TCP Sync**, launching **OS Bluetooth File Transfer**, **OS double-click file-type registration**, and **automatic background saving to disk** — are shown only in the native desktop executable and documented in Help and `/course`.

### Does Quillvibe send my manuscript to any server or AI service?
No. Quillvibe has no telemetry, no cloud database, and no generative AI code. Your manuscripts, pen-name signatures, permanent Author Keys, and custom device fonts remain on your computer (unless you explicitly connect your own Self-Hosted HTTPS server in Collaborate).

### How do I change fonts or upload my own `.ttf` / `.otf` / `.woff2` file?
Click **Settings** -> **Typefaces & Fonts**, then drag a font file into the dashed dropzone or click **Choose Device Font**. Once listed, click **Use in Draft** or **Use in Book Typeset**.

---

## 2. Bottom Status Bar & Sprint Timer Controls (`15m`, `Start`, `Reset`)

Located along the bottom edge of the workspace:

| Control | Position | What It Does |
| :--- | :--- | :--- |
| **Level Pill (`Basic` / `Intermediate` / `Advanced`)** | Bottom left | Displays active tool tier; click to jump directly to Settings -> Workspace & Editor to switch levels. |
| **Words / Chars / Pages Ledger** | Bottom left | Live count of `Scene Nw (Nc)`, `Ch Nw`, `Book Nw / Target`, estimated trade pages (`~Np` at ~250 words/page), and reading minutes. |
| **Alarm Button** | Bottom right | Opens the Writing Alarm Clock & synthesized ringtones modal. |
| **Sprint Duration Dropdown (`15m` / `25m` / `45m`)** | Bottom right | Picks sprint length in minutes. |
| **`Start` / `Pause` Button** | Bottom right | Starts or pauses the sprint countdown and tracks net words drafted (`+Nw`). |
| **`Reset` Button** | Bottom right | Stops the active timer and resets the sprint delta back to `+0w`. |

---

## 3. Top Header Bar & Frameless Desktop Controls

- **Top-Left Transparent Quillvibe Emblem:** Displays the sculpted open-folio emblem directly on the top header strip with zero surrounding border box. On desktop builds, drag empty topbar space to move the window or double-click to maximize/restore.
- **Manuscript Binder Toggle (left panel icon):** Shows or hides the Parts, Chapters, and Scenes tree on the left.
- **Book Title Input & `Saved` Indicator:** Renames the active book inline.
- **Center Studio Switcher (Liquid Glass Pill Bar):** Switches between **Manuscript**, **Corkboard**, **Outline**, **Story Bible**, **Graph**, and **Studio** according to the active Tool Tier in Settings.
- **Upper-Right Utility Icons:** Theme switcher, Book Writing Course (`/course`), Library & Permanent Author Key, Collaborate & Permissions, Open File, Save + Extension Selector, Extensions, Settings, Help (`?`), and Scene Inspector toggle (plus New Window, Immersive Fullscreen, and `−`/`□`/`×` window controls in the desktop app).

---

## 4. Sliders, Levers & Custom Checkmarks Behavior

- **Rest state:** All scrollbars, sliders, binary toggle levers (`bv-lever`), and checkboxes match the active **Ivory Light**, **Parchment**, or **Obsidian Dark** theme tokens.
- **Active interaction state:** Pressing or dragging a slider thumb, flipping a lever switch, or clicking a checkbox engages the Liquid Glass refraction lens until you release the pointer.
- **Reduced Motion:** Disables transition lifts while preserving exact contrast and layout geometry.
