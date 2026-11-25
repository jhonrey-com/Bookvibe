# Quillvibe Reference Guide

This guide explains every icon, file extension, proofreading symbol, and extension permission in Quillvibe using direct definitions.

---

## 1. Icons & Tooltips

Quillvibe uses minimalist icon buttons throughout the topbar, studio tabs, editor toolbar, and modal tabs to keep writing surfaces clear.

### Custom Hover & Click-to-Expand Help
- **Hover or focus** any button to open a compact tooltip showing its name, shortcut, and 1-line summary.
- **Click inside the tooltip card** (or press `?` while a button has keyboard focus) to expand full step-by-step details and notes.
- Click outside or press `Escape` to close an expanded help card.

### Topbar Icons (All Unique)
| Icon | Name | Action |
| :--- | :--- | :--- |
| Left sidebar frame | **Manuscript Binder** | Toggles the Parts, Chapters, and Scenes tree (slides in as a drawer on compact screens). |
| Books on shelf | **Library & Author Identity** | Manage multiple books and set a per-book Pen Name, handwritten/typed Signature, and permanent ECDSA Author Key. |
| Overlapping figures | **Collaborate & Permissions** | Manage co-authors, proofreaders, restrictions, Self-Hosted HTTPS sync (and Wi-Fi PIN / Bluetooth in the desktop app). |
| Folder | **Open File** | Opens `.qv`, `.qvbible`, `.qvscene`, `.qvstyle`, or `.qvext` bundles. |
| Disk + Format dropdown | **Save / Export Default** | Saves immediately using the extension selected in the dropdown beside it. |
| Interlocking module | **Extensions & Formats** | Manages Integrated toolkits, External `.qvext` plugins with permission consent, and Data Audit Log. |
| Gear cog | **Settings & Preferences** | Switch Workspace Tool Level (`Basic`/`Intermediate`/`Advanced`), install fonts, configure Commercial Metadata, and import `.docx`, `.html`, `.md`, or legacy `.bookvibe`. |
| Lifebuoy / Question | **Help & Guided Tour** | Opens the built-in manual, unique Icon Directory legend, keyboard reference, and section walkthrough replay. |
| Right sidebar frame | **Scene Inspector** | Toggles active scene metadata, proofread marks summary, Story Bible mentions, snapshots, and proofreader notes. |

### Main Workspace Switcher Icons
| Icon | Workspace | Purpose |
| :--- | :--- | :--- |
| Ink quill nib & line | **Manuscript** | Draft prose, proofread with editorial marks, read Split Reference, or compare Revision Diffs. |
| 2×2 card grid | **Corkboard** | Arrange scene synopsis index cards and drag scenes between chapters. |
| Bulleted lines | **Outline** | Filterable tabular ledger showing timeline, POV, location, status, word targets, and reading time. |
| Open codex + ribbon | **Story Bible** | Characters, locations, lore, custom categories, custom fields, and reference images. |
| Linked nodes | **Story Graph** | Live interactive map linking characters, plot beats, scenes, locations, and custom nodes. |
| Serif `T` | **Studio (Typeset & Cover)** | Interior page preview with custom fonts, Front/Back/Spine/Flaps Cover Studio, and EPUB/PDF/QVBX export. |

---

## 2. File Extensions & Protected `QVBX` Format

Every native Quillvibe file stores encrypted and authenticated `QVBX` binary data so external tools cannot tamper with contents or swap a locked pen-name Author Key.

| Format | Default Role | When to Choose It |
| :--- | :--- | :--- |
| `.qv` | **Book Workspace** | Default format. Preserves manuscript, Story Bible, Story Graph, cover layout, snapshots, proofread marks, Origin Key, and Copyright Seal. |
| `.pdf` | **Print Interior PDF** | Trim-sized print interior PDF with margins, running headers, credits, and page numbers. |
| `.qvbible` | **Story Bible DB** | Imports/merges shared Characters, Locations, Lore, and Custom Categories across sequels in a series. |
| `.qvscene` | **Standalone Scene** | Shares or archives one single chapter scene, its annotations, proofread marks, and snapshots. |
| `.qvstyle` | **Typeset Preset** | Applies book trim size, font family, drop caps, smart quotes, margins, and paper theme to another book. |
| `.epub` | **EPUB 3 eBook** | Release eBook archive embedding the cover PNG, copyright/credits page, and reflowable XHTML chapters. |
| `.md` | **Markdown Manuscript** | YAML front matter + clean Markdown headings and `* * *` scene breaks. |
| `.html` | **Standalone Web Book** | Self-contained HTML reading edition with serif styling for offline browsers. |
| `.txt` | **Plain Text Manuscript** | Clean UTF-8 text without formatting markers. |

Legacy `.quillvibe`, `.qvibe`, `.qvbook`, `.bookvibe`, and `.bv*` archives are imported explicitly inside **Settings -> Publishing, Commercial & Migration -> Import**.

---

## 3. Proofreading Marks Reference

In **Proofread** mode, select any word, phrase, or sentence on the page and right-click to apply one of the 15 standard editorial marks:

| Symbol | Name | Editorial Meaning |
| :--- | :--- | :--- |
| `₰` | **Cross Out / Delete** | Removes unnecessary words or sentences (*deleatur*). |
| `∧` | **Caret Insert** | Proposes inserted words or punctuation at cursor position. |
| `⇄` | **Replace / Substitute** | Crosses out selected phrasing and shows proposed wording beside it. |
| `AQ` | **Margin Comment** | Author query or copyeditor note anchored to text without changing words. |
| `★` | **Highlight Passage** | Shades a sentence for pacing, fact-checking, or continuity review. |
| `tr` | **Transpose** | Swaps the order of two adjacent words or two letters. |
| `¶` | **New Paragraph** | Splits continuous text into a fresh paragraph. |
| `no ¶` | **Run-In Paragraph** | Joins separated paragraphs into one continuous block. |
| `⏝` | **Close Up Space** | Deletes extra whitespace inside the selection. |
| `#` | **Insert Space** | Inserts a missing space between words. |
| `≡` | **Capitalize (CAPS)** | Proposes uppercase letters. |
| `lc` | **Lowercase (lc)** | Converts uppercase letters back to lowercase. |
| `ital` | **Set Italic** | Wraps selection in `*italic*` emphasis. |
| `bf` | **Set Bold** | Wraps selection in `**bold**` weight. |
| `stet` | **Stet (Let Stand)** | Dotted underline keeping original text unchanged over prior edits. |

---

## 4. Extensions, Permissions & Data Sandbox

Quillvibe separates extensions into **Integrated** toolkits and **External (`.qvext` / `.bvext`)** community plugins. External extensions contain declarative JSON rules and presets—never executable JavaScript—and cannot access the internet, filesystem, or private Author Keys.

---

## 5. Permanent Author Keys, Permissions & Collaboration

- **Forever Pen-Name Author Keys**: Each pen name receives one permanent local ECDSA P-256 Author Key (`QVK-...`). Once created, it cannot be replaced or rotated for that pen name.
- **Collaborator Restrictions**: Assign permissions per collaborator (edit prose, proofread-only, edit Story Bible/Graph, edit Cover/Typeset, export files, manage team).
- **Offline Desktop Sync**: Same-Wi-Fi LAN PIN sync and OS Bluetooth File Transfer are available in the native desktop app; Self-Hosted HTTPS sync works on both desktop and web.
