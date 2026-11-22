import type { IconName } from './dom';

export interface IconDirectoryEntry {
  icon: IconName;
  name: string;
  location: 'Topbar' | 'Workspace Switcher' | 'Editor Modes' | 'Editor Tools' | 'Publishing & Sync';
  shortcut?: string;
  meaning: string;
}

export const ICON_DIRECTORY: readonly IconDirectoryEntry[] = [
  {
    icon: 'panel-left',
    name: 'Manuscript Binder',
    location: 'Topbar',
    meaning: 'Opens or closes the left Parts, Chapters, and Scenes tree (overlay drawer on compact screens).',
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
    name: 'Open Bookvibe or Migration File',
    location: 'Topbar',
    shortcut: 'Ctrl+O',
    meaning: 'Loads .bookvibe, .bvibe, .bvbook, .bvbible, .bvscene, .bvstyle files or .bvext extension bundles.',
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
    meaning: 'Manage integrated toolkits, install external .bvext plugins with permission consent, audit data reads, and register OS extensions.',
  },
  {
    icon: 'settings',
    name: 'Settings & Migration Preferences',
    location: 'Topbar',
    meaning: 'Install device fonts (.ttf/.otf/.woff/.woff2), import Word/Google Docs/Markdown files, configure imprint metadata, and enable Developer tools.',
  },
  {
    icon: 'help',
    name: 'Help & Guided Tour',
    location: 'Topbar',
    shortcut: 'F1',
    meaning: 'Opens this full manual, unique icon legend, keyboard reference, and section walkthrough replay.',
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
    meaning: 'Book interior page preview, front/back/spine cover studio, release checklist, and EPUB/PDF export.',
  },
  {
    icon: 'draft-sheet',
    name: 'Draft Sheet Mode',
    location: 'Editor Modes',
    meaning: 'Single distraction-free paper canvas supporting Obsidian, Parchment, and Ivory sheets.',
  },
  {
    icon: 'proofread',
    name: 'Proofread Markup Mode',
    location: 'Editor Modes',
    meaning: 'Apply 15 traditional editorial marks (delete, caret, substitute, stet, transpose, comments) with clean preview.',
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
    icon: 'page-margins',
    name: 'Interior Typeset Preview',
    location: 'Publishing & Sync',
    meaning: 'Configure trim size, fonts, line spacing, margins, chapter numerals, and drop caps.',
  },
  {
    icon: 'cover',
    name: 'Book Cover Studio',
    location: 'Publishing & Sync',
    meaning: 'Design Front, Back, Spine, and Dust Jacket flaps with SVG, transparent image, and layer controls.',
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
    meaning: 'Save and merge signed .bookvibe files over OS Bluetooth or Nearby Share without internet.',
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
    meaning: 'Consent-gated loader for .bvext bundles with per-permission toggles and read audit log.',
  },
  {
    icon: 'file-code',
    name: 'Official Document Formats',
    location: 'Publishing & Sync',
    meaning: 'Overview and OS shell association status for the six Bookvibe JSON document formats.',
  },
];
