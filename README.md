<p align="center">
  <img src="assets/banners/quillvibe-header.svg" alt="Quillvibe — Open-source book writing, proofreading, worldbuilding, cover studio, and typesetting app" width="100%" />
</p>

**Quillvibe** is a free, open-source book writing app built for authors and writers. You can write chapters, keep character and world notes, mark up drafts while proofreading, design book covers, and export print-ready `.pdf` and `.epub` books—all in one place without creating an account. It opens in **Ivory Light** with three **Workspace Layouts** (**Focused**, **Editorial**, and **Full Studio**), works offline, saves books in Quillvibe's protected `.qv` format, and is published under **`jhonrey.com`**.

> **Try Quillvibe in Your Browser:** <a href="https://quillvibe.jhonrey.com/start" target="_blank" rel="noopener noreferrer"><strong>Open <code>https://quillvibe.jhonrey.com/start</code></strong></a>  
> **Free Book Writing Course:** <a href="https://quillvibe.jhonrey.com/course" target="_blank" rel="noopener noreferrer"><strong>Quillvibe Academy (10 Modules, 28 Lessons)</strong></a>  
> **Help Center, FAQ & Error Codes:** <a href="https://quillvibe.jhonrey.com/help" target="_blank" rel="noopener noreferrer"><strong><code>https://quillvibe.jhonrey.com/help</code></strong></a>  
> **Download Desktop App (`v2.3.0` — Windows, Mac & Linux):** <a href="https://github.com/jhonrey-com/Quillvibe/releases/latest" target="_blank" rel="noopener noreferrer"><strong>GitHub Releases</strong></a>  
> **Contact, Feedback & Support:** Email <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>quillvibe@jhonrey.com</strong></a>

> [!NOTE]
> **Note About Security Warnings When Installing on Windows, Mac, or Linux**  
> When you download and open the desktop installer, your computer may show a warning saying the app is from an unrecognized or unverified publisher. This happens because Quillvibe is a new, independent, open-source project that is still being actively updated and improved, and it does not yet carry a paid commercial app-store certificate.
>
> **Prefer not to install anything?** You can use the <a href="https://quillvibe.jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>website version at quillvibe.jhonrey.com</strong></a> directly in your browser. It has fewer features than the installed desktop app (desktop-only tools include automatic disk saving, stacked book tabs, multiple windows, fullscreen focus mode, and Wi-Fi/Bluetooth sharing), so remember to click **Save** to download a `.qv` copy of your book when you finish a browser session.
>
> **Questions, Ideas, Bugs, or Security Concerns?** Send any inquiries, suggestions, corrections, error reports, or security concerns directly to <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>quillvibe@jhonrey.com</strong></a> (see also <a href="SECURITY.md" target="_blank" rel="noopener noreferrer">SECURITY.md</a>).

<p align="center">
  <img src="assets/banners/quillvibe-workspace.svg" alt="Quillvibe studio: Draft & Proofread, Organize Cards & Bible, Live Story Graph, Offline Sync, Typeset & Full Cover Wrap" width="100%" />
</p>

---

## Table of Contents

1. [Why Keep Everything in One Place](#1-why-keep-everything-in-one-place)
2. [How to Use in Your Browser or Install on Desktop](#2-how-to-use-in-your-browser-or-install-on-desktop)
3. [Guides by Workspace Layout (Focused, Editorial, Full Studio)](#3-guides-by-workspace-layout-focused-editorial-full-studio)
4. [All Workspaces, Sprint Timer & Controls Help](#4-all-workspaces-sprint-timer--controls-help)
5. [Custom Fonts & Book Cover Studio](#5-custom-fonts--book-cover-studio)
6. [Quillvibe File Formats, Password Locks & Author Keys](#6-quillvibe-file-formats-password-locks--author-keys)
7. [Extensions & Add-ons](#7-extensions--add-ons)
8. [Keyboard Shortcuts](#8-keyboard-shortcuts)
9. [Contact, FAQ, Security & Contributing](#9-contact-faq-security--contributing)

---

## 1. Why Keep Everything in One Place

Many writers end up juggling several separate programs—one for writing chapters, another for outlines, another for character notes, another for cover design, and another to turn drafts into an eBook or print PDF. Quillvibe keeps all of those steps together in one local book file:

- **No account and no setup**: Open a blank book or sample project right away. Your `.qv` file stays on your own device and can be locked with a password.
- **Comfortable for quick notes or full series**: Write freely without distracting red underlines (spellcheck is off by default and can be turned on in Settings), use `Ctrl+Z` / `Ctrl+Y` undo and redo across every screen, and keep multiple books under different pen names.
- **Built-in proofreading marks**: Mark up drafts with 15 traditional proofreading symbols right on the page, preview the clean result, and accept changes with automatic backup snapshots.
- **Ready for publishing**: Add your publisher name, ISBN, copyright seal, custom fonts (`.ttf`, `.otf`, `.woff`, `.woff2`), front/spine/back book covers, Origin Author Keys, and verified co-author access.

---

## 2. How to Use in Your Browser or Install on Desktop

### Option A: Use the Website Version (No Download Needed)
Visit <a href="https://quillvibe.jhonrey.com/" target="_blank" rel="noopener noreferrer"><strong>https://quillvibe.jhonrey.com/</strong></a> (new visitors start at `/start`; returning writers go straight to `/write`) to write, add images with text wrap & background removal, organize notes, proofread, design covers, and export `.qv`, `.pdf`, `.epub`, or `.md` files right in your web browser.
- This is the easiest way to try Quillvibe without installing anything or dealing with desktop security prompts.
- The browser version has fewer features than the installed desktop app. Remember to click **Save** to download a `.qv` backup file to your computer when you finish writing.

### Option B: Install the Desktop App (Windows, Mac & Linux)
Download the latest installer from <a href="https://github.com/jhonrey-com/Quillvibe/releases/latest" target="_blank" rel="noopener noreferrer"><strong>GitHub Releases (<code>v2.3.0</code>)</strong></a> (published under **`jhonrey.com`**):
- **Windows:** `.msi` or `-setup.exe`
- **Mac (Apple Silicon & Intel):** Universal `.dmg`
- **Linux:** `.AppImage`, `.deb`, or `.rpm`

Because Quillvibe is a new open-source app still being actively updated and improved, Windows, Mac, or Linux may show a warning before opening the installer. If you prefer to avoid that prompt, you can use the website version above instead.

Desktop builds add automatic saving to your computer, stacked book tabs for working on a series in one window, unlimited separate windows, `F11` fullscreen focus mode with a clock/timer bar, Wi-Fi and Bluetooth book sharing, and double-click opening for `.qv`, `.qvbible`, `.qvscene`, and `.qvstyle` files.

### Option C: Terminal Installers

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/jhonrey-com/Quillvibe/main/scripts/install.ps1 | iex
```
*(Or Winget manifest `packaging/winget/jhonrey.Quillvibe.yaml`.)*

**macOS & Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/jhonrey-com/Quillvibe/main/scripts/install.sh | sh
```
*(Or Homebrew Cask via `packaging/homebrew/quillvibe.rb`.)*

### Option D: One-Click Repo Launchers & Source Build
- **Windows / macOS / Linux repo launchers:** `Start-Quillvibe.bat`, `Start-Quillvibe.command`, or `./start-quillvibe.sh`
- Requirements from source: Node.js 20+ (and Rust toolchain for `npm run tauri:build`)

```bash
git clone https://github.com/jhonrey-com/Quillvibe.git
cd Quillvibe
npm install

# Start browser UI preview at http://localhost:1420
npm run dev

# Or run / bundle the native desktop app
npm run tauri:dev
npm run tauri:build
```

---

## 3. Guides by Workspace Layout (Focused, Editorial, Full Studio)

Switch layouts anytime in **Settings -> Workspace & Editor** or by clicking the **Workspace** button in the bottom-left bar. Changing layouts only shows or hides panels—it never deletes any of your work.

### Focused — Clean Page for Drafting
1. Open Quillvibe. The Welcome screen lets you start a blank book, open the sample book, open a `.qv` file, or read the built-in writing course at `/course`.
2. Write directly on **Ivory**, **Parchment**, or **Obsidian** paper with simple formatting (`Ctrl/Cmd+B`, `Ctrl/Cmd+I`, headings, quotes, scene breaks).
3. Pick your preferred save format (`.qv`, `.pdf`, `.epub`, `.md`, `.qvscene`) and click **Save**.

### Editorial — Outlining, Proofreading & Interior Print Layout
Switch to **Editorial** layout to add **Corkboard** scene cards, **Outline** view, **Proofread** markup (15 copyediting symbols with Clean Preview and revision snapshots), and **Interior Typeset** for print and eBook layout.

### Full Studio — Story Bible, Story Graph, Cover Studio & Collaboration
1. **Story Bible & Story Graph**: Keep character, location, and lore notes linked to your scenes, and map plot connections visually.
2. **Book Cover Studio & Author Seals**: Design front, spine, back, and jacket flaps; keep multiple books in **Library**; record your **Origin Author & Device Key**; and seal your **Work Copyright**.
3. **Co-Authors & Imports**: Pair co-authors using verified device tokens in **Collaborate**, or import `.docx`, `.html`, `.rtf`, `.md`, `.txt`, and older `.quillvibe`/`.bookvibe` files in **Settings -> Publishing & Archive**.

---

## 4. All Workspaces, Sprint Timer & Controls Help

Press `F1` or click **Help (`?`)** inside the app to search every control, button, and icon, or read **[docs/FAQ-AND-CONTROLS.md](docs/FAQ-AND-CONTROLS.md)**.

---

## 5. Custom Fonts & Book Cover Studio

- **Settings -> Typefaces & Fonts**: Add your own `.ttf`, `.otf`, `.woff`, or `.woff2` fonts for drafting, book interiors, and covers.
- **Studio -> Book Cover Studio**: Build Front, Back, Spine, and Dust Jacket Flaps with shapes, text layers, gradients, alignment guides, and PNG/EPUB export.

---

## 6. Quillvibe File Formats, Password Locks & Author Keys

Native Quillvibe files use a protected binary format that only Quillvibe reads, with optional password locking so private drafts stay safe.

| Extension | What It Saves | Double-Click Action (Desktop App) |
| :--- | :--- | :--- |
| **`.qv`** | Complete Book Workspace | Opens your manuscript, Story Bible, Story Graph, cover design, proofreading marks, snapshots, Author Key, and Copyright Seal. |
| **`.qvbible`** | Story Bible Notes | Merges Characters, Locations, Lore, and custom categories into the open book. |
| **`.qvscene`** | Single Scene Draft | Opens or imports one scene with its snapshots and proofreading marks. |
| **`.qvstyle`** | Typeset & Paper Style | Applies trim size, font, drop caps, smart quotes, margins, and paper theme. |

Older `.quillvibe`, `.qvibe`, `.qvbook`, `.bookvibe`, and `.bv*` files do not open by double-clicking, but you can still import them anytime from **Settings -> Publishing & Archive** or the Welcome screen.

More detail: [docs/OFFICIAL-EXTENSION-REGISTRATION.md](docs/OFFICIAL-EXTENSION-REGISTRATION.md) and [docs/GUIDE.md](docs/GUIDE.md).

---

## 7. Extensions & Add-ons

Quillvibe keeps built-in toolkits separate from optional `.qvext` community add-ons. External add-ons cannot access the internet, your disk, or your author keys, and always ask for your permission before installing. Read **[docs/DEVELOPER-EXTENSIONS.md](docs/DEVELOPER-EXTENSIONS.md)**.

---

## 8. Keyboard Shortcuts

| Keys | Command |
| :--- | :--- |
| `Ctrl / Cmd + Z` / `Y` | Undo / Redo across Manuscript, Corkboard, Outline, Bible, Graph, and Cover Studio |
| `Ctrl / Cmd + S` | Save Revision Snapshot in Manuscript view; export default format in other views |
| `Ctrl / Cmd + O` | Open any `.qv`, `.qvbible`, `.qvscene`, `.qvstyle`, or `.qvext` file |
| `Ctrl / Cmd + B` / `I` | Bold / Italic formatting around selected text |
| `Ctrl / Cmd + Shift + N` *(Desktop)* | Open current book in a new desktop window |
| `Ctrl / Cmd + W` *(Desktop)* | Close the active book tab (when multiple tabs are open) |
| `Ctrl / Cmd + Shift + F` | Toggle Zen Focus mode |
| `F11` *(Desktop App)* | Toggle fullscreen focus mode with movable clock, sprint timer, word count, and alarm |
| `F1` | Open Help & Icon Guide |
| `Esc` | Close pop-up windows, menus, tours, or exit Zen Focus |

---

## 9. Contact, FAQ, Security & Contributing

- **Questions, Suggestions, Corrections, Bugs, or Security Concerns:** Email <a href="mailto:quillvibe@jhonrey.com" target="_blank" rel="noopener noreferrer"><strong>quillvibe@jhonrey.com</strong></a> directly.
- **Online Help Center, FAQ & Error Codes:** Visit <a href="https://quillvibe.jhonrey.com/help" target="_blank" rel="noopener noreferrer"><strong>https://quillvibe.jhonrey.com/help</strong></a>.
- **Security Policy:** See <a href="SECURITY.md" target="_blank" rel="noopener noreferrer"><strong>SECURITY.md</strong></a>.
- **Complete UI & FAQ Reference:** Read <a href="docs/FAQ-AND-CONTROLS.md" target="_blank" rel="noopener noreferrer"><strong>docs/FAQ-AND-CONTROLS.md</strong></a>.
- **Project Wiki & Roadmap:** Browse the <a href="https://github.com/jhonrey-com/Quillvibe/wiki" target="_blank" rel="noopener noreferrer"><strong>Quillvibe GitHub Wiki</strong></a>.
- **Contributing:** Read <a href="CONTRIBUTING.md" target="_blank" rel="noopener noreferrer"><strong>CONTRIBUTING.md</strong></a> before opening pull requests.

## License

Released under the <a href="LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>.
