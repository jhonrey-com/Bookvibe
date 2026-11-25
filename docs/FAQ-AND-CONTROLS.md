# Quillvibe Controls, FAQ & Error Code Reference (`v3.0.0`)

Plain guide to every workspace control, question, and `QV-xxx` error code in Quillvibe.

> Live searchable version with screenshots: <a href="https://quillvibe.jhonrey.com/help" target="_blank" rel="noopener noreferrer"><strong>https://quillvibe.jhonrey.com/help</strong></a> (or <a href="https://quillvibe.jhonrey.com/faq" target="_blank" rel="noopener noreferrer"><strong>/faq</strong></a>)

---

## 1. Frequently Asked Questions

### How do I use Quillvibe without installing anything?
Open <a href="https://quillvibe.jhonrey.com/" target="_blank" rel="noopener noreferrer"><strong>https://quillvibe.jhonrey.com/</strong></a>. New visitors start on `/start`; returning writers go straight to `/write`. No account or sign-in is required. Click **Save** before closing a browser session so your `.qv` copy is stored safely on your computer.

### Why do Windows, Mac, or Linux show a warning when installing the desktop app?
Quillvibe is a new, free, open-source project still being actively updated and improved, and it does not yet carry a paid commercial app-store certificate. Windows builds are signed under `CN=jhonrey.com` (`jhonrey.com-Quillvibe.cer` is attached to each release). If you prefer not to install, you can use the website version at <a href="https://quillvibe.jhonrey.com/" target="_blank" rel="noopener noreferrer">https://quillvibe.jhonrey.com/</a> instead.

### What is the difference between the website version and the desktop app?
Writing, Manuscript Image Studio (text wrap, snap-to-grid, offline background remover), proofreading, Corkboard, Outline, Story Bible, Story Graph, Typeset & Cover Studio, Print PDF / EPUB 3 export, Migrate-Out exports (`.md`, `.rtf`, `.json`), Origin Author Keys (`QVK-`/`QVD-`), Work Copyright Seals (`QVC-`), Verified Co-Author tokens (`QVCA1.`), Self-Hosted HTTPS sync, `/course`, and `/help` all run in both browser and desktop builds.

Desktop installers (<a href="https://github.com/jhonrey-com/Quillvibe/releases/latest" target="_blank" rel="noopener noreferrer">Windows `.msi`/`.exe`, macOS Universal `.dmg`, Linux `.AppImage`/`.deb`/`.rpm`</a>) add automatic saving straight to disk, stacked top book tabs with pointer drag-and-drop & window combining, unlimited multi-window editing with live sync, single-instance double-click opening for `.qv`/`.qvbible`/`.qvscene`/`.qvstyle`, `F11` fullscreen focus HUD with clock/alarm, local Wi-Fi PIN sync, and OS Bluetooth transfer.

### How does the mobile website behave on smaller screens?
On small screens (`<= 768px`), Quillvibe automatically locks to the **Focused** Workspace Layout and hides the bottom `Workspace:` pill so the writing canvas stays uncluttered. You can still insert images, adjust wrap modes, resize with touch sliders, and remove backgrounds on mobile (desktop web or the desktop app is recommended for finer drag-and-snap placement).

### How do I delete a book safely?
Open **Library**, click the trash button beside a book, and type the **exact book title** in the confirmation dialog to enable **Delete Permanently**.

### Can I move my book out of Quillvibe to another writing tool?
Yes. Open **Settings -> Publishing & Archive -> Migrate to Another Writing Tool** (available on both web and desktop) to export an unlocked **Manuscript + Story Bible (`.md`)**, **Rich Text Document (`.rtf`)**, or **Open Portable Archive (`.json`)**.

### Where do I report bugs, suggestions, or security concerns?
Email <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>quillvibe@jhonrey.com</strong></a> directly. If an unexpected error dialog appears, click **Copy Error Report** so the `QV-xxx` error code is included.

---

## 2. Common Error Codes (`QV-101` – `QV-504`)

| Code | Platform | Meaning & Fix |
| :--- | :--- | :--- |
| **`QV-101`** | Web & Desktop | Unsupported or legacy file extension. Import `.quillvibe`/`.bookvibe` via **Settings -> Publishing & Archive -> Import Legacy Archive**. |
| **`QV-102`** | Web & Desktop | Wrong password or damaged password-locked `.qv` archive. Re-enter the exact export password or restore a clean backup. |
| **`QV-103`** | Web & Desktop | Integrity seal mismatch, altered Author Key, or unsafe active script detected in file. Request a clean `.qv` export from the original author. |
| **`QV-104`** | Web & Desktop | File could not be read or parsed (missing payload, >50 MB, or OS lock). Verify the file and retry with `Ctrl+O`. |
| **`QV-201`** | Web & Desktop | Export or Print PDF failed (restricted collaborator role, canceled dialog, or disk space). Check role permissions and retry. |
| **`QV-202`** | Web & Desktop | Image upload or background removal failed. Use PNG/JPEG/WebP under 14 MB, adjust the Edge tolerance slider, or click **Restore Original**. |
| **`QV-301` / `QV-303`** | Desktop | Desktop window creation, focus, tab tear-off, or window merge failed. Retry `Ctrl+Shift+N` or **Tabs Menu -> Combine All Windows Here**. |
| **`QV-302`** | Web & Desktop | LAN Wi-Fi PIN, Bluetooth, or Self-Hosted HTTPS sync failed. Check Wi-Fi network, 6-digit PIN, or HTTPS endpoint. |
| **`QV-401` / `QV-402`** | Web & Desktop | Cover Studio render or export issue (custom font, PNG/JPEG/SVG export, or asset load failure). Re-select a font in Settings or inspect layers in the Layers panel. |
| **`QV-403`** | Web & Desktop | Story Graph `.canvas` JSON import or export failed. Verify the `.canvas` file contains valid `nodes` and `edges` arrays. |
| **`QV-501`** | Web | Browser local storage quota reached (often from large images). Click **Save** to download a `.qv` backup or use the desktop app. |
| **`QV-502` / `QV-503`** | Web & Desktop | Unexpected runtime or background task error. Click **Copy Error Report** and send it to `quillvibe@jhonrey.com`. |
| **`QV-504`** | Desktop | Operating system unrecognized publisher prompt on installer launch. Allow via OS prompt or use the browser version. |

---

## 3. Workspace Layouts, Themes & Animations

- **Workspace Layouts (`Workspace:` pill in bottom status bar on desktop/tablet, or Settings -> Workspace & Editor):**
  - **Focused** — Quiet drafting page and notes only (auto-enforced on small mobile screens).
  - **Editorial** — Adds Corkboard, Outline, Proofread Markup, and Interior Typeset.
  - **Full Studio** — Adds Story Bible, Story Graph, Book Cover Studio, and Collaboration.
- **Themes:** **Match Device (System)**, **Ivory Light**, **Warm Parchment**, and **Obsidian Dark**.
- **Smooth Animations:** Toggle **Enable smooth animations & transitions** in **Settings -> Workspace & Editor** for animated Binder/Inspector drawers, Part/Chapter accordions, menus, and dialogs (automatically respects `prefers-reduced-motion: reduce`).
