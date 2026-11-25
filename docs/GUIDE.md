# Quillvibe Reference Guide (`v3.0.0`)

A clear guide to every workspace, toolbar icon, image layout control, file format, proofreading mark, and desktop feature in Quillvibe.

> For interactive search, screenshots, and error code lookup (`QV-101`–`QV-504`), visit <a href="https://quillvibe.jhonrey.com/help" target="_blank" rel="noopener noreferrer"><strong>https://quillvibe.jhonrey.com/help</strong></a> or press `F1` inside the app.

---

## 1. Icons, Tooltips & Top Navigation Bar

Quillvibe uses a centered 3-column top navigation bar so the active workspace switcher stays balanced on both website and desktop windows.

### Custom Hover & Click-to-Expand Help
- **Hover or focus** any button to see its name, shortcut, and 1-line summary.
- **Click inside the tooltip card** (or press `?` while focused) to expand step-by-step instructions.
- Click outside or press `Escape` to close an expanded tooltip.

### Topbar Icons
| Icon | Name | Action |
| :--- | :--- | :--- |
| Left sidebar frame | **Manuscript Binder** | Smoothly expands or collapses Parts, Chapters, and Scenes (with animated Part/Chapter accordions). |
| Center switcher | **Workspace Switcher** | Switches between **Manuscript**, **Corkboard**, **Outline**, **Story Bible**, **Story Graph**, and **Studio** according to your Workspace Layout (**Focused**, **Editorial**, or **Full Studio**). |
| Moon / Sun | **Theme Switcher** | Cycles **Match Device (System)**, **Ivory Light**, **Warm Parchment**, and **Obsidian Dark**. |
| Books on shelf | **Library & Author Identity** | Manage multiple books, open in tab/window, delete safely with exact-name confirmation, and manage Pen Name, Signature, Origin Device Key (`QVK-`/`QVD-`), and Work Copyright Seal (`QVC-`). |
| Overlapping figures | **Collaborate & Permissions** | Pair verified co-authors (`QVCA1.`), set role permissions, and sync over Self-Hosted HTTPS (plus Wi-Fi PIN & Bluetooth on desktop). |
| Folder | **Open File** | Opens `.qv`, `.qvbible`, `.qvscene`, `.qvstyle`, or `.qvext` files (in a new tab on desktop). |
| Disk + Format dropdown | **Save / Export Default** | Exports using the selected format (`.qv`, `.pdf`, `.epub`, `.md`, `.html`, `.txt`, `.qvbible`, `.qvscene`, `.qvstyle`) with a live progress pill. |
| Interlocking module | **Extensions & Formats** | Manages built-in toolkits, sandboxed `.qvext` add-ons, and the data access audit log. |
| Sliders | **Settings & Preferences** | Configure Theme (including Match Device), Workspace Layout, Smooth Animations, Spellcheck, Custom Fonts, Commercial Metadata, Legacy Imports, and **Migrate to Another Writing Tool** exports. |
| Question mark (`?`) | **Help, Course & Manual** | Opens the full in-app manual plus quick buttons for **Open Full Course Page** and **Open Help & FAQ Page** (opens in a new browser tab on web, or a dedicated tab on desktop). |
| Right sidebar frame | **Scene Inspector** | Smoothly toggles scene metadata, proofreading summary, Story Bible mentions, snapshots, and reviewer notes. |

---

## 2. Manuscript Image Studio (Text Wrap, Snap-to-Grid & Background Remover)

Writers can place illustrations and photos directly inside any book scene:

- **Add Images:** Drag and drop PNG, JPEG, WebP, or GIF files directly onto the paper sheet, or click the **Insert Image** button in the editor bar (or right-click -> **Insert Image into Scene**).
- **Automatic Text Wrap Reflow:** Pick **Wrap Left**, **Wrap Right**, **Top & Bottom**, **Inline Center**, or **Behind Text**, or drag an image across paragraphs to automatically relocate and reflow surrounding prose.
- **Snap-to-Grid & Alignment Guides:** Resize from the corner handle or drag to position with a `12px` snap grid and magnetic alignment hairlines to margins, page center, and other placed images.
- **Offline Background Remover:** Click **Remove Background** to remove solid or light backgrounds locally on your device, fine-tune the **Edge** tolerance slider, or click **Restore Original** anytime.
- **Mobile Support:** Touch sliders and wrap controls work on mobile screens (desktop web or the installed desktop app is recommended for finer drag-and-snap placement).

---

## 3. File Extensions, Protected `QVBX` Container & Migrating Out

Every native Quillvibe file stores encrypted and authenticated `QVBX` binary data so external tools cannot silently alter contents or swap a locked pen-name Author Key.

| Format | Role | Notes |
| :--- | :--- | :--- |
| `.qv` | **Book Workspace** | Default whole-book format containing manuscript, images, Story Bible, Story Graph, cover wrap, snapshots, proofread marks, Origin Key, and Copyright Seal. |
| `.pdf` | **Print Interior PDF** | Trim-sized print interior PDF with margins, running headers, credits, and page numbers. |
| `.qvbible` | **Story Bible Database** | Merges Characters, Locations, Lore, and Custom Categories across sequels in a series. |
| `.qvscene` | **Standalone Scene** | Opens or shares one single scene with its images, snapshots, and proofreading marks. |
| `.qvstyle` | **Typeset Preset** | Applies book trim size, font family, drop caps, smart quotes, margins, and paper theme. |
| `.epub` | **EPUB 3 eBook** | Release eBook archive embedding the cover PNG, copyright/credits, and reflowable chapters. |
| `.md` / `.rtf` / `.json` | **Portable Migration Exports** | Export from **Settings -> Publishing & Archive -> Migrate to Another Writing Tool** when moving a project to another writing program. |

Legacy `.quillvibe`, `.qvibe`, `.qvbook`, `.bookvibe`, and `.bv*` archives are imported explicitly inside **Settings -> Publishing & Archive -> Import Legacy Archive**.

---

## 4. Proofreading Marks Reference

In **Editorial** or **Full Studio** layout, switch to **Proofread** mode, select any word or sentence, and right-click to apply any of 15 standard editorial marks:

| Symbol | Name | Meaning |
| :--- | :--- | :--- |
| `₰` | **Cross Out / Delete** | Removes unnecessary words or sentences. |
| `∧` | **Caret Insert** | Proposes inserted words or punctuation at the cursor. |
| `⇄` | **Replace / Substitute** | Crosses out selected phrasing and shows proposed wording beside it. |
| `AQ` | **Margin Comment** | Author query or copyeditor note without changing text. |
| `★` | **Highlight Passage** | Shades a sentence for pacing, fact-checking, or continuity review. |
| `tr` | **Transpose** | Swaps the order of adjacent words or letters. |
| `¶` | **New Paragraph** | Splits continuous text into a fresh paragraph. |
| `no ¶` | **Run-In Paragraph** | Joins separated paragraphs into one block. |
| `⏝` | **Close Up Space** | Removes extra whitespace inside the selection. |
| `#` | **Insert Space** | Inserts a missing space between words. |
| `≡` | **Capitalize (CAPS)** | Proposes uppercase letters. |
| `lc` | **Lowercase (lc)** | Converts uppercase letters back to lowercase. |
| `ital` | **Set Italic** | Wraps selection in `*italic*` emphasis. |
| `bf` | **Set Bold** | Wraps selection in `**bold**` weight. |
| `stet` | **Stet (Let Stand)** | Keeps original text unchanged over prior edits. |

---

## 5. Desktop Stacked Tabs, Multi-Window Sync & Single-Instance Opening

- **Empty New Tab & New Window:** Clicking **`+`** on the top tab strip or pressing `Ctrl+Shift+N` opens a clean **New Tab** book picker showing recent local books instead of pre-selecting an open book.
- **Tab Drag State Machine (Reorder, Tear-Off & Window Merging):** Drag tabs left or right to reorder with neighbor animations; pull a tab vertically outside the strip (`32px`) to detach it into its own window; drag a single-tab window cleanly by its tab; or drop over another Quillvibe window's tab strip to merge at the pointed slot.
- **Conflict-Safe Live Sync:** Opening the same book in two windows displays a notice dialog and syncs edits automatically across open copies using monotonic revision checks and atomic per-book disk saves.
- **Single-Instance File Tabs:** Double-clicking a `.qv`, `.qvbible`, `.qvscene`, or `.qvstyle` file while Quillvibe is already running focuses the window and opens the file in a new tab.

---

## 6. Book Cover Studio & Dual-Mode Story Graph (`v3.0.0`)

- **Offline Book Cover Studio:** Zoom between `10%` and `500%` (`Ctrl+Wheel`), pan with `Space+Drag` or middle-mouse, resize and rotate via 8-point handles (`Shift` snaps rotation in 15-degree steps), marquee-select or `Shift+Click` multiple layers, group with `Ctrl+G`, double-click text on canvas for inline editing, snap to 5px magnetic guides and equal-spacing badges (hold `Ctrl` to bypass), and export `PNG` (1x/2x/3x or transparent), `JPEG`, `Vector SVG`, or `Print PDF`.
- **Dual-Mode Story Graph:** Switch cleanly between **Spatial Storyboard** (Act Group frames, 90-degree obstacle-avoiding elbow connectors with draggable middle handles, double-click canvas node add, 4-side directional ports, Minimap) and **Force Graph** (adjustable simulation forces, 1/2/3-hop isolation, shortest narrative path tracer). Write `[[Entity Links]]` and `#tags` in Markdown notes to wire connections live, or import/export standard `.canvas` JSON, PNG, and SVG files.
