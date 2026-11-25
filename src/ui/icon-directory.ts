import type { IconName } from './dom';

export interface IconDirectoryEntry {
  icon: IconName;
  name: string;
  location:
    | 'Topbar'
    | 'Workspace Switcher'
    | 'Editor Modes'
    | 'Editor Tools'
    | 'Cover Studio Tools'
    | 'Publishing & Sync';
  shortcut?: string;
  meaning: string;
}

export const ICON_DIRECTORY: readonly IconDirectoryEntry[] = [
  {
    icon: 'panel-left',
    name: 'Manuscript Binder',
    location: 'Topbar',
    meaning: 'Opens or closes the left Parts, Chapters, and Scenes tree (resizable desktop panel or slide-over drawer).',
  },
  {
    icon: 'library',
    name: 'Library & Author Identity',
    location: 'Topbar',
    meaning: 'Manage multiple books, pen names, drawn or typed signatures, and per-book ECDSA Author Keys.',
  },
  {
    icon: 'collab',
    name: 'Offline Collaboration',
    location: 'Topbar',
    meaning: 'Add co-authors and proofreaders, sync over same-Wi-Fi PIN pairing, or exchange files via Bluetooth.',
  },
  {
    icon: 'folder',
    name: 'Open Quillvibe File',
    location: 'Topbar',
    shortcut: 'Ctrl+O',
    meaning: 'Loads protected .qv, .qvbible, .qvscene, .qvstyle files and .qvext extension bundles.',
  },
  {
    icon: 'save',
    name: 'Export Using Default Extension',
    location: 'Topbar',
    shortcut: 'Ctrl+S',
    meaning: 'Exports the active book immediately in the format chosen in the extension dropdown beside it.',
  },
  {
    icon: 'extensions',
    name: 'Extensions & File Formats',
    location: 'Topbar',
    meaning: 'Manage integrated toolkits, install external .qvext plugins with permission consent, and audit data reads.',
  },
  {
    icon: 'settings',
    name: 'Settings, Levels & Appearance',
    location: 'Topbar',
    meaning: 'Switch Basic/Intermediate/Advanced tool levels, Ivory/Parchment/Obsidian themes, spellcheck toggle, custom fonts, and .docx/.html/legacy archive import.',
  },
  {
    icon: 'sliders-tier',
    name: 'Workspace Tool Level',
    location: 'Topbar',
    meaning: 'Located in Settings -> Workspace & Editor (and shown on the bottom-left bar) to switch Basic, Intermediate, and Advanced tools.',
  },
  {
    icon: 'theme-sun',
    name: 'Quick Light / Dark Theme',
    location: 'Topbar',
    meaning: 'Switches between Ivory Light, Warm Parchment, and Obsidian Dark studio surfaces.',
  },
  {
    icon: 'course',
    name: 'Book Writing Course',
    location: 'Topbar',
    meaning: 'Launches the 10-module hands-on course for writing, protecting, and publishing a complete book in Quillvibe.',
  },
  {
    icon: 'help',
    name: 'Help & Manual',
    location: 'Topbar',
    shortcut: 'F1',
    meaning: 'Opens controls search, interactive course, icon legend, and keyboard shortcuts.',
  },
  {
    icon: 'panel-right',
    name: 'Scene Inspector',
    location: 'Topbar',
    meaning: 'Shows or hides scene metadata, open proofread marks, annotations, detected Story Bible links, and snapshots.',
  },
  {
    icon: 'quill',
    name: 'Manuscript View',
    location: 'Workspace Switcher',
    meaning: 'Primary writing studio housing Draft, Proofread, Split Reference, and Revision Diff modes.',
  },
  {
    icon: 'corkboard',
    name: 'Corkboard View',
    location: 'Workspace Switcher',
    meaning: 'Arrange scenes as index cards with synopsis summaries, POV labels, and word target bars.',
  },
  {
    icon: 'outline',
    name: 'Outline Ledger',
    location: 'Workspace Switcher',
    meaning: 'Filterable spreadsheet view tracking timeline, POV, location, revision stage, and word progress.',
  },
  {
    icon: 'bible',
    name: 'Story Bible Codex',
    location: 'Workspace Switcher',
    meaning: 'Structured database for Characters, Locations, Lore, custom categories, custom fields, and reference images.',
  },
  {
    icon: 'graph',
    name: 'Story Graph Canvas',
    location: 'Workspace Switcher',
    meaning: 'Live interactive map linking characters, plot beats, scenes, locations, lore, and custom nodes.',
  },
  {
    icon: 'typeset',
    name: 'Typeset & Cover Studio',
    location: 'Workspace Switcher',
    meaning: 'Book interior page preview, layered front/back/spine cover studio, release checklist, and EPUB/PDF export.',
  },
  {
    icon: 'draft-sheet',
    name: 'Draft Sheet Mode',
    location: 'Editor Modes',
    meaning: 'Clean paper canvas supporting Ivory, Parchment, and Obsidian sheets with right-click formatting.',
  },
  {
    icon: 'proofread',
    name: 'Proofread Markup Mode',
    location: 'Editor Modes',
    meaning: 'Right-click or select text to apply 15 copyediting marks with clean preview and snapshot safety.',
  },
  {
    icon: 'split',
    name: 'Split Reference View',
    location: 'Editor Modes',
    meaning: 'Read a second scene or any Story Bible entry side-by-side next to your draft.',
  },
  {
    icon: 'diff',
    name: 'Revision Diff View',
    location: 'Editor Modes',
    meaning: 'Word-level diff comparing the live scene against any captured Revision Snapshot.',
  },
  {
    icon: 'split-scene',
    name: 'Split Scene at Cursor',
    location: 'Editor Tools',
    meaning: 'Divides the current scene into two scenes starting at the cursor position.',
  },
  {
    icon: 'typewriter',
    name: 'Typewriter Scrolling',
    location: 'Editor Tools',
    meaning: 'Adds vertical padding around active typing lines for centered reading ergonomics.',
  },
  {
    icon: 'zen',
    name: 'Zen Focus Mode',
    location: 'Editor Tools',
    shortcut: 'Ctrl+Shift+F',
    meaning: 'Hides sidebars to leave only the active page.',
  },
  {
    icon: 'camera',
    name: 'Capture Revision Snapshot',
    location: 'Editor Tools',
    shortcut: 'Ctrl+S',
    meaning: 'Stores an immutable copy of current prose in scene snapshots.',
  },
  {
    icon: 'cursor',
    name: 'Select & Transform Tool',
    location: 'Cover Studio Tools',
    meaning: 'Select, drag, resize, align, or right-click cover text, vector shapes, and artwork layers.',
  },
  {
    icon: 'type-tool',
    name: 'Add Cover Text Layer',
    location: 'Cover Studio Tools',
    meaning: 'Insert custom display headings, pull quotes, series badges, or praise blurbs onto any cover face.',
  },
  {
    icon: 'shapes',
    name: 'Vector Shapes Tool',
    location: 'Cover Studio Tools',
    meaning: 'Add geometric rectangles, frames, circles, horizontal/vertical rules, or badges with gradients.',
  },
  {
    icon: 'ornament',
    name: 'SVG Ornaments & Emblems',
    location: 'Cover Studio Tools',
    meaning: 'Insert crisp typographic arches, medallions, press seals, and rule dividers.',
  },
  {
    icon: 'palette',
    name: 'Background & Gradients',
    location: 'Cover Studio Tools',
    meaning: 'Style solid or gradient backdrops and tune background photo brightness, contrast, blur, and dim overlay.',
  },
  {
    icon: 'grid-snap',
    name: 'Grid Overlay Toggle',
    location: 'Cover Studio Tools',
    meaning: 'Display or hide spacing gridlines on the cover canvas.',
  },
  {
    icon: 'magnet',
    name: 'Snap-to-Grid Toggle',
    location: 'Cover Studio Tools',
    meaning: 'Snap dragged cover layers cleanly to grid intervals and magnetic center guides.',
  },
  {
    icon: 'guides',
    name: 'Print Bleed & Trim Guides',
    location: 'Cover Studio Tools',
    meaning: 'Display 0.125" safe-zone margins and spine fold lines across Front, Wrap, and Jacket views.',
  },
  {
    icon: 'align-center',
    name: 'Align Layer Center',
    location: 'Cover Studio Tools',
    meaning: 'Center or align selected cover layers horizontally or vertically.',
  },
  {
    icon: 'lock',
    name: 'Lock Layer Position',
    location: 'Cover Studio Tools',
    meaning: 'Prevent accidental dragging of finished background or frame layers.',
  },
  {
    icon: 'eye',
    name: 'Toggle Layer Visibility',
    location: 'Cover Studio Tools',
    meaning: 'Temporarily hide or show any cover element, shape, text box, or image layer.',
  },
  {
    icon: 'undo',
    name: 'Undo Cover Action',
    location: 'Cover Studio Tools',
    shortcut: 'Ctrl+Z',
    meaning: 'Step backward through Cover Studio edits.',
  },
  {
    icon: 'redo',
    name: 'Redo Cover Action',
    location: 'Cover Studio Tools',
    shortcut: 'Ctrl+Y',
    meaning: 'Re-apply undone Cover Studio edits.',
  },
  {
    icon: 'copy-layer',
    name: 'Duplicate Selected Layer',
    location: 'Cover Studio Tools',
    meaning: 'Clone the active cover shape, text box, or graphic layer with offset.',
  },
  {
    icon: 'page-margins',
    name: 'Interior Typeset Preview',
    location: 'Publishing & Sync',
    meaning: 'Configure trim size, fonts, line spacing, margins, chapter numerals, and drop caps.',
  },
  {
    icon: 'cover',
    name: 'Book Cover Studio',
    location: 'Publishing & Sync',
    meaning: 'Full-featured cover designer with layers stack, vector shapes, snap-to-grid, and print PNG export.',
  },
  {
    icon: 'seal',
    name: 'Publish & Author Seal',
    location: 'Publishing & Sync',
    meaning: 'Sign editions with your Author Key, inspect checklist status, and export EPUB 3 or Print PDF.',
  },
  {
    icon: 'badge-id',
    name: 'Collaborator Credits',
    location: 'Publishing & Sync',
    meaning: 'Assign co-author, proofreader, editor, and beta-reader roles and title-page credit lines.',
  },
  {
    icon: 'wifi',
    name: 'Same-Wi-Fi LAN Sync',
    location: 'Publishing & Sync',
    meaning: 'Exchange manuscripts directly across laptops on the same router using a 6-digit PIN.',
  },
  {
    icon: 'bluetooth',
    name: 'Bluetooth / Nearby Share',
    location: 'Publishing & Sync',
    meaning: 'Save and merge signed .qv files over OS Bluetooth or Nearby Share offline (Desktop App).',
  },
  {
    icon: 'layers',
    name: 'Integrated Extensions',
    location: 'Publishing & Sync',
    meaning: 'Pre-bundled offline toolkits for proofing marks, typography cleanup, readability, and print presets.',
  },
  {
    icon: 'shield',
    name: 'External Extension Sandbox',
    location: 'Publishing & Sync',
    meaning: 'Consent-gated loader for .qvext bundles with per-permission toggles and read audit log.',
  },
  {
    icon: 'file-code',
    name: 'Official Document Formats',
    location: 'Publishing & Sync',
    meaning: 'Overview and OS association status for protected QVBX Quillvibe formats (.qv, .qvbible, .qvscene, .qvstyle).',
  },
  {
    icon: 'server',
    name: 'Enterprise & Website Sync',
    location: 'Publishing & Sync',
    meaning: 'Push and pull manuscripts over TLS to your self-hosted sync server or custom website API.',
  },
  {
    icon: 'window-new',
    name: 'Open New Book Window',
    location: 'Topbar',
    meaning: 'Open a separate desktop window (or browser tab) so multiple books can be edited simultaneously.',
  },
  {
    icon: 'fullscreen',
    name: 'Immersive Fullscreen Mode',
    location: 'Topbar',
    shortcut: 'F11',
    meaning: 'Expand Quillvibe into full-screen mode with optional live clock, writing timer, word goal, and alarm clock.',
  },
  {
    icon: 'alarm',
    name: 'Alarm Clock & Ringtones',
    location: 'Publishing & Sync',
    meaning: 'Schedule a wall-clock time or countdown writing alarm paired with built-in gentle ringtones.',
  },
];
