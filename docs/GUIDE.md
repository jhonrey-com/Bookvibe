# Bookvibe Reference Guide

This guide explains every icon, file extension, proofreading symbol, and extension permission in Bookvibe using direct definitions.

---

## 1. Icons & Tooltips

Bookvibe uses minimalist icon buttons throughout the topbar, studio tabs, editor toolbar, and modal tabs to keep writing surfaces clear.

### Custom Hover & Click-to-Expand Help
- **Hover or focus** any button to open a compact tooltip showing its name, shortcut, and 1-line summary.
- **Click inside the tooltip card** (or press `?` while a button has keyboard focus) to expand full step-by-step details and notes.
- Click outside or press `Escape` to close an expanded help card.

### Topbar Icons (All Unique)
| Icon | Name | Action |
| :--- | :--- | :--- |
| Left sidebar frame | **Manuscript Binder** | Toggles the Parts, Chapters, and Scenes tree (slides in as a drawer on compact screens). |
| Books on shelf | **Library & Author Identity** | Manage multiple books and set a per-book Pen Name, handwritten/typed Signature, and ECDSA Author Key. |
| Overlapping figures | **Collaborate Offline** | Manage co-authors and proofreaders, sync over same-Wi-Fi PIN pairing, or exchange files via Bluetooth / Nearby Share. |
| Folder | **Open File** | Opens `.bookvibe`, `.bvibe`, `.bvbook`, `.bvbible`, `.bvscene`, `.bvstyle`, or installs `.bvext` extension bundles. |
| Disk + Format dropdown | **Save / Export Default** | Saves immediately using the extension selected in the dropdown beside it (persists across restarts). |
| Interlocking module | **Extensions & Formats** | Manages Integrated toolkits, External `.bvext` plugins with permission consent, Data Audit Log, and OS shell file registration. |
| Gear cog | **Settings & Fonts** | Installs device/extension `.ttf`/`.otf`/`.woff`/`.woff2` fonts, adjusts editor spacing, manages Imprint/ISBN/Stage, and imports `.docx` or Google Docs `.html`. |
| Lifebuoy / Question | **Help & Guided Tour** | Opens the built-in manual, unique Icon Directory legend, keyboard reference, and animated section walkthrough replay. |
| Right sidebar frame | **Scene Inspector** | Toggles active scene metadata, proofread marks summary, Story Bible mentions, snapshots, and proofreader notes across every workspace view. |

### Main Workspace Switcher Icons
| Icon | Workspace | Purpose |
| :--- | :--- | :--- |
| Ink quill nib & line | **Manuscript** | Draft prose, proofread with editorial marks, read Split Reference, or compare Revision Diffs. |
| 2×2 card grid | **Corkboard** | Arrange scene synopsis index cards and drag scenes between chapters. |
| Bulleted lines | **Outline** | Filterable tabular ledger showing timeline, POV, location, status, word targets, and reading time. |
| Open codex + ribbon | **Story Bible** | Characters, locations, lore, custom categories, custom fields, and reference images. |
| Linked nodes | **Story Graph** | Live interactive map linking characters, plot beats, scenes, locations, and custom nodes with Compact / Standard / Detailed views and port drag-to-connect. |
| Serif `T` | **Typeset & Cover** | Interior page preview with custom fonts, Front/Back/Spine/Flaps Cover Studio with SVG/PNG layers, and EPUB/PDF export. |

### Editor Mode Icons
| Icon | Mode | Behavior |
| :--- | :--- | :--- |
| Document sheet with pencil | **Draft** | Distraction-free prose writing canvas (*Obsidian*, *Parchment*, or *Ivory* sheets). |
| Marked page + check | **Proofread** | Interactive editorial markup sheet supporting strikeout, caret insert, transpose, stet, comments, and Clean Preview. |
| Divided window | **Split View** | Side-by-side reference pane for any scene or Story Bible entry. |
| Split `+` / `−` sheets | **Revision Diff** | Word-level comparison between live text and any saved Revision Snapshot. |

### Publishing & Modal Sub-Tabs
- **Page Margins (`page-margins`)**: Book interior trim size, typeface, numerals, drop caps, and running headers.
- **Book Cover (`cover`)**: Front, Back, Spine, Dust Jacket Flaps, and SVG/PNG drag-and-drop layers.
- **Wax Seal (`seal`)**: Publish checklist, ECDSA Author Key signing, and release exports.
- **ID Badge (`badge-id`)**, **Wi-Fi Waves (`wifi`)**, **Bluetooth (`bluetooth`)**: Credits, LAN PIN sync, and local file exchange tabs.
- **Stacked Layers (`layers`)**, **Shield (`shield`)**, **Code File (`file-code`)**: Integrated extensions, `.bvext` sandbox, and official file format specs.

---

## 2. File Extensions & Default Export Dropdown

Every native Bookvibe file stores JSON wrapped in `"magic": "BOOKVIBE_V1"` so you can inspect or back up your files in plain UTF-8 without lock-in.

| Format | Default Role | When to Choose It |
| :--- | :--- | :--- |
| `.bookvibe` | **Master Project** | Default format. Preserves manuscript, Story Bible, Story Graph, cover layout, snapshots, proofread marks, and Author Key public seal. |
| `.bvibe` | **Compact Project** | Short-alias equivalent of `.bookvibe`. |
| `.bvbook` | **Manuscript Package** | Portable parts, chapters, scenes, front matter, cover, and credits without worldbuilding databases. |
| `.bvbible` | **Story Bible DB** | Imports/merges shared Characters, Locations, Lore, and Custom Categories across sequels in a series. |
| `.bvscene` | **Standalone Scene** | Shares or archives one single chapter scene, its annotations, proofread marks, and snapshots. |
| `.bvstyle` | **Typeset Preset** | Applies book trim size, font family, drop caps, smart quotes, margins, and paper theme to another book. |
| `.epub` | **EPUB 3 eBook** | Release eBook archive embedding the cover PNG, copyright/credits page, and reflowable XHTML chapters. |
| `.md` | **Markdown Manuscript** | YAML front matter + clean Markdown headings and `* * *` scene breaks. |
| `.html` | **Standalone Web Book** | Self-contained HTML reading edition with serif styling for offline browsers. |
| `.txt` | **Plain Text Manuscript** | Clean UTF-8 text without formatting markers. |

Select any format in the topbar **Save dropdown** (`.bookvibe`, `.epub`, `.md`, etc.) to make it the default output whenever you click Save.

---

## 3. Proofreading Marks Reference

In **Proofread** mode, select any word, phrase, or sentence on the page (or use **Quick Mark by Phrase** in the right ledger) and click one of the standard editorial marks:

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

### Author Approval Safety
- Clicking **Accept** (or **Accept All**) automatically saves an immutable **Revision Snapshot** before modifying prose.
- Clicking **Clean Preview** lets you read the page as if every open mark were already accepted.

---

## 4. Extensions, Permissions & Data Sandbox

Bookvibe separates extensions into **Integrated** toolkits and **External (`.bvext`)** community plugins.

### Integrated Extensions
1. **Editorial Proofing Toolkit (`core.editorial-proofing`)**: Scans active scene text locally for repeated consecutive words, extra spaces, `--`, and weak intensifiers, proposing reviewable proofread marks.
2. **Typographic Punctuation Cleanup (`core.typo-cleanup`)**: Converts straight quotes, double hyphens, and ellipses after creating a safety snapshot.
3. **Readability & Pacing Ledger (`core.readability-ledger`)**: Computes word/sentence averages, dialogue percentage, and Flesch-Kincaid grade locally.
4. **Print Trim Preset Pack (`core.print-presets`)**: Applies `6" × 9"`, `5" × 8"`, or `A5` book geometry presets.

### External Extensions (`.bvext`) & Explicit Permission Consent
When installing an external `.bvext` file (via **Extensions -> External Sandbox** or drag-and-drop), Bookvibe displays a mandatory **Permission Review** screen showing:
- Exact author, version, and SHA-256 fingerprint.
- **Data Usage Statement** written by the extension.
- **Individual Permission Checkboxes** you can deny before or after installation:
  - `read:active-scene`: Read only the scene open in the editor.
  - `read:manuscript`: Read chapters and draft text in the active book.
  - `read:bible`: Read Story Bible entries in the active book.
  - `propose:proofread-marks`: Add reviewable marks only (cannot overwrite prose).
  - `apply:text-transform`: Run built-in cleanup transforms (always creates a snapshot first).
  - `add:export-preset`: Update trim/font/paper settings.
- **Data Access Audit Log**: Records every time an extension reads scene data or runs a transform.

### Blocked Capabilities (Hard Sandbox Guarantees)
External `.bvext` files contain declarative JSON rules and presets—never executable JavaScript. Bookvibe blocks:
- Network / internet requests
- Local disk or folder scanning
- Access to cryptographic `privateKeyJwk` author signing keys
- Access to other books in your Library

### Authoring a `.bvext` External Plugin
```json
{
  "magic": "BOOKVIBE_EXT_V1",
  "id": "ext.example-house-style",
  "name": "Example House Style",
  "version": "1.0.0",
  "author": "Editorial Press",
  "description": "Flags straight ellipses and US spelling variants as proofread marks.",
  "kind": "external",
  "permissions": ["read:active-scene", "propose:proofread-marks"],
  "dataUsageSummary": "Reads active scene text only to add reviewable proofread marks.",
  "rules": [
    {
      "id": "rule-grey",
      "label": "gray -> grey",
      "pattern": "\\bgray\\b",
      "flags": "g",
      "markKind": "substitute",
      "replacement": "grey",
      "note": "House style prefers \"grey\"."
    }
  ]
}
```
You can download a working sample `.bvext` template directly inside **Extensions -> External Sandbox**.

---

## 5. Offline Collaboration & Author Keys

- **Multi-Book Library & Author Keys**: Store multiple manuscripts locally. Each book carries its own **Pen Name**, typed/drawn **Signature**, and local ECDSA P-256 **Author Key**. Private keys are stripped from exported files (`.bookvibe`, `.bvbook`, `.epub`) and never exposed during LAN sync.
- **Same-Wi-Fi LAN Sync**: Start a temporary local host bounded to your private Wi-Fi network with a 6-digit pairing PIN. Conflicting remote edits never overwrite local prose silently; older conflicts are stored inside scene Snapshots.
- **Bluetooth / Nearby Share**: Save a `.bookvibe` package and launch your operating system transfer dialog with zero internet connection.
