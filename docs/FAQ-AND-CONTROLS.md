# Bookvibe Controls, Sliders, Levers & FAQ Reference

Plain guide to every button, dropdown, slider, lever switch, section, and workflow in Bookvibe so anyone searching online finds clear answers immediately.

---

## 1. Frequently Asked Questions

### How do I run Bookvibe without installing anything?
Open the live web studio at **`https://bookvibe.jhonrey.com/`**. No account or login is needed—everything runs directly in your browser. Click **Save** before closing so your `.bookvibe` file is saved safely on your computer rather than only inside temporary browser storage.

### How do I install Bookvibe as a desktop app?
Download the installer for your OS from **`https://github.com/jhonrey-com/Bookvibe/releases/latest`**:
- **Windows:** `.msi` installer or NSIS `.exe`
- **macOS:** Universal `.dmg` (Apple Silicon & Intel)
- **Linux:** `.AppImage` or `.deb`

Desktop installers automatically save projects to disk on your device, use a custom frameless obsidian titlebar, and register `.bookvibe`, `.bvibe`, `.bvbook`, `.bvbible`, `.bvscene`, and `.bvstyle` double-click associations plus local Wi-Fi PIN sync.

### What works in the browser (`https://bookvibe.jhonrey.com/`) vs. desktop executables?
Writing, proofreading, Corkboard, Outline, Story Bible, Story Graph, Typeset & Cover Studio, mobile layout, EPUB/Markdown/HTML/Print PDF export, co-author credits, and importing/exporting `.bookvibe` files all work directly in desktop and mobile browsers. Features that require direct operating-system APIs — **Same-Wi-Fi LAN TCP Sync**, launching **Windows Bluetooth File Transfer (`fsquirt.exe`) / macOS Bluetooth File Exchange / Linux `bluetooth-sendto`**, **OS double-click file-type registration**, and **automatic background saving to disk** — require installing a native desktop binary and are clearly marked **Desktop Executable Only** in browser mode.

### Does Bookvibe send my manuscript to any server or AI service?
No. Bookvibe has no telemetry, no cloud database, and no generative AI code. Your manuscripts, pen-name signatures, Author Keys, and custom device fonts remain on your computer.

### How do I change fonts or upload my own `.ttf` / `.otf` / `.woff2` file?
Click **Settings** (sliders icon in the upper-right header) -> **Typefaces & Fonts**, then drag a font file into the dashed dropzone or click **Choose Device Font**. Once listed, click **Use in Draft** to apply it to your writing canvas or **Use in Book Typeset** for interior spreads and EPUB exports.

---

## 2. Bottom Status Bar & Sprint Timer Controls (`15m`, `Start`, `Reset`)

Located along the bottom edge of the workspace:

| Control | Position | What It Does |
| :--- | :--- | :--- |
| **Words / Chars / Pages Ledger** | Bottom left | Live count of `Scene Nw (Nc)`, `Ch Nw`, `Book Nw / Target`, estimated trade pages (`~Np` at ~250 words/page), and estimated reading minutes. |
| **Sprint Duration Dropdown (`15m` / `25m` / `45m`)** | Bottom right (beside clock icon) | Picks how many minutes the writing sprint timer runs (`15m`, `25m`, or `45m`). Changing it pauses any running clock, resets the timer to the selected length, and zeroes `+0w`. |
| **`Start` / `Pause` Button** | Bottom right (center button) | Starts or pauses the writing sprint countdown while tracking net new words drafted during the session (`+Nw`). When running, the button displays `Pause`. |
| **`Reset` Button** | Bottom right (far right button) | Stops the active timer, restores the full countdown for the currently selected duration (`15m`, `25m`, or `45m`), and zeroes the sprint delta back to `+0w`. |

---

## 3. Top Header Bar & Frameless Desktop Controls

- **Top-Left Transparent Bookvibe Emblem:** Displays the sculpted layered open-folio Bookvibe emblem directly on the top header strip with zero surrounding border box. On desktop builds, drag empty topbar space to move the window or double-click to maximize/restore.
- **Manuscript Binder Toggle (left panel icon):** Shows or hides the Parts, Chapters, and Scenes tree on the left (slides in as an overlay drawer on tablets and smaller windows).
- **Book Title Input & `Saved` Indicator:** Renames the active book inline; fixed-width `Saving...` / `Saved` readout never shifts buttons horizontally.
- **Center Studio Switcher (Liquid Glass Pill Bar):**
  - **Manuscript (quill):** Draft writing sheet, Proofread markup, Split View, and Revision Diff.
  - **Corkboard (2×2 cards):** Visual synopsis index cards with scene drag ordering.
  - **Outline (bullet rows):** Filterable status/POV/timeline progress table.
  - **Story Bible (open codex):** Characters, Locations, Lore, custom tabs, portraits, and traits.
  - **Story Graph (linked nodes):** Interactive node canvas with live edge drags and port handles.
  - **Typeset (serif `T`):** Book interior layout preview, full cover wrap designer, and Author Key signing.
- **Upper-Right Utility Icons:**
  - **Library (`books`):** Manage multiple books, pen names, drawn ink signatures, and ECDSA Author Keys.
  - **Collaborate (`people`):** Assign co-author/proofreader credits, pair over same-Wi-Fi PIN, or export files for Bluetooth/Nearby Share.
  - **Open (`folder` / `Ctrl+O`):** Open any `.bookvibe`, `.bv*`, `.bvext`, `.docx`, `.html`, `.rtf`, `.md`, or `.txt` file.
  - **Save + Extension Selector (`disk + dropdown` / `Ctrl+S`):** Pick `.bookvibe`, `.epub`, `.md`, `.html`, `.txt`, or `.bv*` as your default save format.
  - **Extensions (`puzzle`):** Enable integrated proofing/cleanup/font toolkits, inspect sandboxed `.bvext` permissions, view Audit Log, or register OS extensions.
  - **Settings (`sliders`):** Install custom fonts, tune draft typography sliders, configure Imprint/ISBN/Stage, migrate external docs, or enable Developer mode.
  - **Help (`?` / `F1`):** Opens the searchable manual, interactive Icon Legend, Controls & Sliders guide, and section walkthrough replay.
  - **Scene Inspector Toggle (right panel icon):** Toggles the right inspector across every studio workspace without losing editor scroll or cursor state.
  - **Desktop Window Chrome (`−`, `□`, `×`):** Appears in compiled desktop releases on Windows, macOS, and Linux because Bookvibe renders its own frameless titlebar instead of default OS frames.

---

## 4. Sliders, Levers & Custom Checkmarks Behavior

- **Rest state:** All sliders, binary toggle levers (`bv-lever`), and checkboxes render cleanly flat inside dark obsidian hairlines (`#08080a` / `#323642`) with monochrome ivory thumbs and knobs.
- **Active interaction state:** Pressing or dragging a slider thumb, flipping a lever switch, or clicking a checkbox smoothly engages the centered Liquid Glass refraction lens and specular rim until you release the pointer.
- **Reduced Motion (`prefers-reduced-motion: reduce` or Settings -> Motion -> Reduced Motion):** Disables transition lifts while preserving exact contrast and layout geometry.

### Where Every Slider & Lever Lives
- **Typeset -> Interior:** Trim Size dropdown, Typeface dropdown, Chapter Numerals dropdown, **Body Size (9–14 pt) slider**, **Line Spacing (1.3–1.9) slider**, plus lever switches for **First-Paragraph Drop Caps**, **Smart Curly Quotes & Em-Dashes**, and **Running Page Headers**.
- **Typeset -> Cover Studio:** Design View dropdown (`Front`, `Back`, `Spine`, `Full Print Wrap`, `Dust Jacket Flaps`), Template dropdown, Cover Typography dropdown, **Bg Artwork Dimming (0–85%) slider**, **Graphic Layer Scale / Rotation / Opacity sliders**, **Front Text Size slider**, and lever switches for **Visible on Front Cover** and **Show ISBN Barcode Box**.
- **Settings -> Workspace & Editor:** **Editor Font Size (13–28 px) slider**, **Line Height (1.3–2.2) slider**, **Paper Sheet Width (540–980 px) slider**, **Auto-Save Interval (150–2000 ms) slider**, UI Density dropdown, Motion dropdown, and **First-Visit Tour lever**.
- **Settings -> Developer Tools:** **Developer Mode lever** and `jhonrey.com` provenance verification badge.
- **Help -> Guided Walkthrough:** **First-Visit Tour lever** and **Replay Section Walkthrough** button.
