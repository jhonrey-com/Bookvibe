import type { AppActions } from '../core/app-context';
import { QUILLVIBE_EXTENSIONS } from '../core/extensions';
import { CONTROL_REFERENCE_ITEMS } from '../ui/controls-catalog';
import { clearNode, el, icon } from '../ui/dom';
import { QUILLVIBE_ERROR_CATALOG } from '../ui/error-dialog';

export interface HelpFaqArticle {
  id: string;
  category:
    | 'Getting Started'
    | 'Workspaces & Studios'
    | 'Images & Covers'
    | 'File Formats & Migration'
    | 'Desktop Tabs & Windows'
    | 'Website vs Desktop';
  platform: 'both' | 'web' | 'desktop';
  title: string;
  summary: string;
  details: string[];
  keywords: string;
  screenshot?: { src: string; caption: string };
}

export const HELP_FAQ_ARTICLES: readonly HelpFaqArticle[] = [
  {
    id: 'start-welcome',
    category: 'Getting Started',
    platform: 'both',
    title: 'Welcome Screen, Themes & Workspace Layouts',
    summary: 'Open a blank book, explore the sample book, match your device theme, or pick Focused, Editorial, or Full Studio layout.',
    details: [
      'New website visitors open on /start; returning writers go straight to /write.',
      'Themes include Match Device (System), Ivory Light, Warm Parchment, and Obsidian Dark. All four update scrollbars, panels, and paper cleanly.',
      'Workspace Layouts control which tools appear without ever deleting your book data: Focused (quiet drafting sheet), Editorial (adds Corkboard, Outline, Proofread, Typeset), and Full Studio (adds Story Bible, Story Graph, Book Cover Studio, Collaboration).',
      'On small mobile screens, Quillvibe stays in Focused layout for comfortable typing with zero toolbar clutter.',
    ],
    keywords: 'start welcome theme dark light system device layout focused editorial full studio mobile',
    screenshot: {
      src: '/screenshots/editor-workspace.png',
      caption: 'Quillvibe Manuscript workspace showing Binder, Paper Sheet, centered navigation bar, and Inspector.',
    },
  },
  {
    id: 'manuscript-proofread',
    category: 'Workspaces & Studios',
    platform: 'both',
    title: 'Manuscript Editor, Right-Click Proofread Marks & Undo/Redo',
    summary: 'Draft freely with spellcheck off by default, capture snapshots, undo/redo with Ctrl+Z / Ctrl+Y, and apply 15 copyediting symbols.',
    details: [
      'Spellcheck underlines are off by default so writers can draft without interruption. Turn them on anytime in Settings -> Workspace & Editor.',
      'Use Ctrl+Z and Ctrl+Y across Manuscript, Corkboard, Outline, Story Bible, Story Graph, Typeset, and Cover Studio.',
      'In Editorial or Full Studio layout, switch to Proofread mode to highlight any passage and right-click to apply 15 standard copyediting marks (delete, insert caret, transpose, stet, query, and more) with Clean Preview and automatic snapshot backups.',
    ],
    keywords: 'manuscript draft editor spellcheck undo redo ctrl+z proofread marks copyedit snapshot',
  },
  {
    id: 'manuscript-images',
    category: 'Images & Covers',
    platform: 'both',
    title: 'Adding Images Inside Your Book (Snap-to-Grid, Text Wrap & Background Remover)',
    summary: 'Drag and drop photos or illustrations directly onto your scene page, wrap prose around them, snap to grid/guides, or remove backgrounds offline.',
    details: [
      'Drag any PNG, JPEG, or WebP image directly onto the Manuscript paper sheet, or click Insert Image in the editor bar.',
      'Choose how text flows around the image: Inline, Wrap Left, Wrap Right, Top & Bottom, or Behind Text.',
      'Drag images to reposition or pull corner handles to resize with Snap-to-Grid and magnetic Snap-to-Elements alignment guides.',
      'Click Remove Background to strip solid or light backgrounds locally on your device, tune the tolerance slider, or click Restore Original anytime.',
      'Mobile browsers support inserting, resizing, wrapping, and background removal cleanly, though desktop web or the installed desktop app is recommended for fine drag-and-snap placement.',
    ],
    keywords: 'image photo illustration drag drop resize move snap grid text wrap reflow background remover mobile',
  },
  {
    id: 'corkboard-outline-bible-graph',
    category: 'Workspaces & Studios',
    platform: 'both',
    title: 'Corkboard, Outline, Story Bible & Story Graph',
    summary: 'Reorder scenes as index cards, filter pacing, organize characters/locations/lore, and wire exact node connections.',
    details: [
      'Corkboard displays every scene as a draggable synopsis card with word-target progress bars.',
      'Outline provides a filterable table of scenes by status, POV, location, and word count.',
      'Story Bible stores characters, locations, lore, portraits, and custom categories with automatic scene mention detection.',
      'Story Graph connects character and plot cards with crisp left/right edge curves that track nodes as you drag them.',
    ],
    keywords: 'corkboard outline story bible characters locations lore story graph nodes wiring',
    screenshot: {
      src: '/screenshots/story-graph.png',
      caption: 'Story Graph with exact left/right card connections and node editing.',
    },
  },
  {
    id: 'typeset-cover-studio',
    category: 'Images & Covers',
    platform: 'both',
    title: 'Book Cover Studio, Interior Typeset & Real Print PDF / EPUB 3',
    summary: 'Design front, spine, back, and dust-jacket flaps, install custom fonts, and export trim-sized Print PDF and EPUB 3 books.',
    details: [
      'Install your own .ttf, .otf, .woff, or .woff2 fonts in Settings -> Typefaces & Fonts.',
      'Book Cover Studio supports vector shapes, multi-layer text, gradients, filters, layer ordering, corner resize handles, grid snap, and alignment guides.',
      'Interior Typeset previews trim sizes (5x8, 5.5x8.5, 6x9, A5, Royal, Letter), margins, drop caps, running headers, and exports real Print PDF (.pdf) and EPUB 3 (.epub) files.',
    ],
    keywords: 'cover studio typeset pdf epub print trim size font drop cap spine wrap',
    screenshot: {
      src: '/screenshots/cover-studio.png',
      caption: 'Book Cover Studio with layered shapes, corner resize handles, and inspector properties.',
    },
  },
  {
    id: 'formats-keys-migrate',
    category: 'File Formats & Migration',
    platform: 'both',
    title: 'Protected .qv Files, Author Keys, Copyright Seals & Migrating Out',
    summary: 'Save encrypted .qv archives, bind Origin Author Keys and Work Copyright Seals, import legacy files, or migrate to another writing tool.',
    details: [
      'Official Quillvibe formats: .qv (whole book workspace), .qvbible (story bible), .qvscene (single scene), and .qvstyle (typeset preset).',
      'Older .quillvibe, .qvibe, .qvbook, and .bookvibe files can still be imported via Settings -> Publishing & Archive -> Import Legacy Archive.',
      'Origin Author & Device Keys (QVK- / QVD-) record where a manuscript originated; Work Copyright Seals (QVC-) record ownership and territory rights.',
      'Co-authors pair using signed multi-device invite tokens (QVCA1.) created on their own device.',
      'Want to move a book to another writing tool? Open Settings -> Publishing & Archive -> Migrate to Another Writing Tool to export a portable Markdown + Notes bundle (.zip), Standard Manuscript (.md), Rich Text (.rtf), or open JSON archive.',
    ],
    keywords: 'qv qvbible qvscene qvstyle password lock author key copyright seal migrate export another writing tool rtf zip json legacy',
  },
  {
    id: 'desktop-tabs-windows',
    category: 'Desktop Tabs & Windows',
    platform: 'desktop',
    title: 'Desktop Stacked Book Tabs, Unlimited Windows & Live Multi-Window Sync',
    summary: 'Keep series books stacked in tabs, drag tabs to reorder or combine windows, and sync edits safely across open copies.',
    details: [
      'Click + on the top desktop tab bar or press Ctrl+Shift+N to open an empty New Tab book picker showing recent local books.',
      'Drag tabs left/right to reorder, drag a tab downward out of the bar to open it in a new window, or drag a tab over another Quillvibe window to combine them.',
      'Use the tab bar menu -> Combine All Windows Here to merge all open desktop windows into one tabbed window.',
      'If the same book is open in two windows at once, Quillvibe displays a Live Sync notice and mirrors saves automatically using monotonic revision checks so edits never collide.',
      'Double-clicking a .qv, .qvscene, .qvbible, or .qvstyle file while Quillvibe is already running opens it cleanly in a new tab inside your existing window.',
    ],
    keywords: 'tabs windows drag drop combine merge sync new tab empty tab double click single instance',
  },
  {
    id: 'web-vs-desktop',
    category: 'Website vs Desktop',
    platform: 'both',
    title: 'Website Version vs. Installed Desktop App (Windows, Mac & Linux)',
    summary: 'Compare what runs in your browser at quillvibe.jhonrey.com versus the free Windows, Mac, and Linux desktop installers.',
    details: [
      'Website version (https://quillvibe.jhonrey.com): Runs immediately with no download or OS installer prompts. Click Save periodically to download a .qv backup to your device.',
      'Desktop app (Windows .msi/.exe, macOS Universal .dmg, Linux .AppImage/.deb/.rpm): Adds automatic saving straight to disk, stacked book tabs, unlimited multi-window editing, F11 Immersive Fullscreen HUD with clock/alarm, local Wi-Fi PIN sync, Bluetooth transfer, and double-click file opening.',
      'Because Quillvibe is a new open-source project without a paid commercial app-store certificate, Windows/Mac/Linux may display an unrecognized publisher warning on install. You can either allow it or use the browser version instead.',
      'Free Book Writing & Publishing Course (/course): Available on both website and desktop with 10 modules, 28 lessons, screenshots, and interactive checks.',
    ],
    keywords: 'website desktop difference installer warning smartscreen windows mac linux course academy',
  },
];

let helpSearchQuery = '';
let helpCategoryFilter: 'All' | HelpFaqArticle['category'] | 'Common Errors & Codes' | 'Controls & Shortcuts' = 'All';
let helpPlatformFilter: 'all' | 'web' | 'desktop' = 'all';

export function setHelpPageSearch(query?: string): void {
  if (query !== undefined) {
    helpSearchQuery = query.trim();
    if (/^qv-\d+/i.test(helpSearchQuery)) {
      helpCategoryFilter = 'Common Errors & Codes';
    }
  }
}

export function renderHelpPageView(container: HTMLElement, actions: AppActions): void {
  clearNode(container);

  const q = helpSearchQuery.trim().toLowerCase();
  const matchesQuery = (haystack: string) => {
    if (!q) return true;
    const terms = q.split(/\s+/).filter(Boolean);
    const lower = haystack.toLowerCase();
    return terms.every((t) => lower.includes(t));
  };
  const matchesPlatform = (p: 'both' | 'web' | 'desktop') =>
    helpPlatformFilter === 'all' || p === 'both' || p === helpPlatformFilter;

  const filteredArticles = HELP_FAQ_ARTICLES.filter(
    (a) =>
      (helpCategoryFilter === 'All' || helpCategoryFilter === a.category) &&
      matchesPlatform(a.platform) &&
      matchesQuery(`${a.title} ${a.category} ${a.summary} ${a.details.join(' ')} ${a.keywords}`),
  );

  const filteredErrors = QUILLVIBE_ERROR_CATALOG.filter(
    (e) =>
      (helpCategoryFilter === 'All' || helpCategoryFilter === 'Common Errors & Codes') &&
      matchesPlatform(e.platform) &&
      matchesQuery(`${e.code} ${e.title} ${e.category} ${e.cause} ${e.fix}`),
  );

  const filteredControls =
    helpCategoryFilter === 'Controls & Shortcuts' || (helpCategoryFilter === 'All' && q.length >= 2)
      ? CONTROL_REFERENCE_ITEMS.filter((c) =>
          matchesQuery(`${c.name} ${c.category} ${c.controlType} ${c.location} ${c.summary} ${c.howToUse} ${c.keywords}`),
        )
      : [];

  const searchInput = el('input', {
    className: 'bv-input qv-help-search-main',
    attrs: {
      type: 'search',
      placeholder: 'Search guides, features, error codes (e.g. QV-102, image wrap, tabs, migrate, PDF, shortcut)…',
      'aria-label': 'Advanced Help & FAQ Search',
      value: helpSearchQuery,
    },
    on: {
      input: () => {
        helpSearchQuery = searchInput.value;
        renderHelpPageView(container, actions);
        const restored = container.querySelector<HTMLInputElement>('.qv-help-search-main');
        if (restored) {
          restored.focus();
          restored.setSelectionRange(restored.value.length, restored.value.length);
        }
      },
    },
  });

  const categories: Array<typeof helpCategoryFilter> = [
    'All',
    'Getting Started',
    'Workspaces & Studios',
    'Images & Covers',
    'File Formats & Migration',
    'Desktop Tabs & Windows',
    'Website vs Desktop',
    'Common Errors & Codes',
    'Controls & Shortcuts',
  ];

  const catChips = el(
    'div',
    { className: 'qv-help-chip-row' },
    ...categories.map((cat) =>
      el('button', {
        className: `bv-mini-btn${helpCategoryFilter === cat ? ' is-active' : ''}`,
        text: cat,
        attrs: { type: 'button' },
        on: {
          click: () => {
            helpCategoryFilter = cat;
            renderHelpPageView(container, actions);
          },
        },
      }),
    ),
  );

  const platformRow = el(
    'div',
    { className: 'qv-help-platform-row' },
    el('span', { className: 'bv-mono-tag', text: 'Platform:' }),
    ...([
      { id: 'all', label: 'All' },
      { id: 'web', label: 'Website' },
      { id: 'desktop', label: 'Desktop App' },
    ] as const).map((pf) =>
      el('button', {
        className: `bv-mini-btn${helpPlatformFilter === pf.id ? ' is-active' : ''}`,
        text: pf.label,
        attrs: { type: 'button' },
        on: {
          click: () => {
            helpPlatformFilter = pf.id;
            renderHelpPageView(container, actions);
          },
        },
      }),
    ),
    ...(helpSearchQuery || helpCategoryFilter !== 'All' || helpPlatformFilter !== 'all'
      ? [
          el('button', {
            className: 'bv-mini-btn',
            text: 'Reset Filters',
            attrs: { type: 'button' },
            on: {
              click: () => {
                helpSearchQuery = '';
                helpCategoryFilter = 'All';
                helpPlatformFilter = 'all';
                renderHelpPageView(container, actions);
              },
            },
          }),
        ]
      : []),
  );

  const totalHits = filteredArticles.length + filteredErrors.length + filteredControls.length;

  const contentWrap = el('div', { className: 'qv-help-sections' });

  if (totalHits === 0) {
    contentWrap.appendChild(
      el(
        'section',
        { className: 'bv-cork-card' },
        el('strong', { text: `No matches found for “${helpSearchQuery}”` }),
        el('p', {
          className: 'bv-label',
          text: 'Try searching an error code (QV-101 to QV-504), a feature (images, tabs, PDF, cover, migrate), or email quillvibe@jhonrey.com for direct help.',
        }),
      ),
    );
  }

  if (filteredArticles.length > 0) {
    const articlesGrid = el('div', { className: 'qv-help-article-grid' });
    for (const art of filteredArticles) {
      const list = el('ul', { className: 'qv-help-detail-list' });
      for (const line of art.details) {
        list.appendChild(el('li', { text: line }));
      }
      const figure = art.screenshot
        ? el(
            'figure',
            { className: 'qv-help-figure' },
            el('img', {
              attrs: {
                src: art.screenshot.src,
                alt: art.screenshot.caption,
                loading: 'lazy',
              },
            }),
            el('figcaption', { text: art.screenshot.caption }),
          )
        : null;

      articlesGrid.appendChild(
        el(
          'article',
          { className: 'bv-cork-card qv-help-article-card', id: `help-${art.id}` },
          el(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            el('span', { className: 'bv-mono-tag', text: art.category, style: { color: 'var(--accent-amber)' } }),
            el('span', {
              className: 'bv-mono-tag',
              text: art.platform === 'both' ? 'Web & Desktop' : art.platform === 'desktop' ? 'Desktop App' : 'Website',
            }),
          ),
          el('h2', { className: 'qv-help-article-title', text: art.title }),
          el('p', { className: 'qv-help-article-summary', text: art.summary }),
          list,
          figure,
        ),
      );
    }
    contentWrap.appendChild(articlesGrid);
  }

  if (filteredErrors.length > 0) {
    const errGrid = el('div', { className: 'qv-help-error-grid' });
    for (const err of filteredErrors) {
      errGrid.appendChild(
        el(
          'div',
          { className: 'bv-cork-card qv-help-error-card', id: `err-${err.code.toLowerCase()}` },
          el(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
            el(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              el('span', { className: 'qv-error-code-pill', text: err.code }),
              el('strong', { text: err.title, style: { fontSize: '13.5px' } }),
            ),
            el('span', {
              className: 'bv-mono-tag',
              text: `${err.category} · ${err.platform === 'both' ? 'Web & Desktop' : err.platform === 'desktop' ? 'Desktop' : 'Web'}`,
            }),
          ),
          el('p', { className: 'bv-label', text: `Why it happens: ${err.cause}`, style: { margin: '4px 0 0', lineHeight: '1.5' } }),
          el('p', {
            text: `How to fix: ${err.fix}`,
            style: { margin: '4px 0 0', fontSize: '12.5px', lineHeight: '1.5', color: 'var(--text-primary)' },
          }),
        ),
      );
    }
    contentWrap.appendChild(
      el(
        'section',
        { className: 'qv-help-group' },
        el('h2', { className: 'qv-help-group-title', text: `Common Errors, Codes & Troubleshooting (${filteredErrors.length})` }),
        errGrid,
      ),
    );
  }

  if (filteredControls.length > 0) {
    const ctrlGrid = el('div', { className: 'bv-help-control-grid' });
    for (const item of filteredControls) {
      ctrlGrid.appendChild(
        el(
          'div',
          { className: 'bv-help-control-card' },
          el(
            'div',
            { className: 'bv-help-control-head' },
            el('strong', { text: item.name, style: { fontSize: '12.5px' } }),
            el('span', { className: 'bv-control-type-pill', text: item.controlType }),
          ),
          el('div', { className: 'bv-mono-tag', text: `${item.category} · ${item.location}` }),
          el('p', { className: 'bv-label', text: item.summary, style: { margin: '2px 0 0', color: 'var(--text-primary)' } }),
          el('p', { className: 'bv-label', text: item.howToUse, style: { margin: '2px 0 0' } }),
        ),
      );
    }
    contentWrap.appendChild(
      el(
        'section',
        { className: 'qv-help-group' },
        el('h2', { className: 'qv-help-group-title', text: `Controls, Sliders & Buttons (${filteredControls.length})` }),
        ctrlGrid,
      ),
    );
  }

  if (helpCategoryFilter === 'All' && !q) {
    const extTable = el('div', { className: 'bv-two-col' });
    for (const item of QUILLVIBE_EXTENSIONS) {
      extTable.appendChild(
        el(
          'div',
          { className: 'bv-list-card', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } },
          el('strong', { text: `${item.extension} — ${item.name}`, style: { fontSize: '13px' } }),
          el('div', { className: 'bv-label', text: item.purpose }),
        ),
      );
    }
    contentWrap.appendChild(
      el(
        'section',
        { className: 'bv-cork-card' },
        el('span', { className: 'bv-panel-title', text: 'Official Quillvibe File Extensions' }),
        extTable,
      ),
    );
  }

  const page = el(
    'div',
    { className: 'qv-help-page' },
    el(
      'div',
      { className: 'qv-help-page-inner' },
      el(
        'header',
        { className: 'qv-help-hero' },
        el(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' } },
          el(
            'div',
            {},
            el('h1', { className: 'qv-help-title', text: 'Quillvibe Help Center, FAQ & Error Guide' }),
            el('p', {
              className: 'qv-help-subtitle',
              text: 'Complete guide to every Quillvibe workspace, file format, shortcut, and common error code across website and desktop.',
            }),
          ),
          el(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            el(
              'button',
              {
                className: 'bv-btn bv-btn-primary',
                attrs: { type: 'button' },
                on: { click: () => actions.openCoursePage() },
              },
              icon('course', 14),
              'Book Writing Course',
            ),
            el(
              'button',
              {
                className: 'bv-btn',
                attrs: { type: 'button' },
                on: { click: () => actions.setState({ activeView: 'editor' }, true) },
              },
              icon('quill', 14),
              'Back to Writing',
            ),
          ),
        ),
        searchInput,
        catChips,
        platformRow,
        el('div', {
          className: 'bv-mono-tag',
          text: `${totalHits} matching topic(s) · Direct support, bug reports & security: quillvibe@jhonrey.com`,
        }),
      ),
      contentWrap,
      el(
        'footer',
        { className: 'bv-cork-card qv-help-footer' },
        el('strong', { text: 'Need direct help or found an unlisted bug?' }),
        el('p', {
          className: 'bv-label',
          text: 'Send any question, suggestion, correction, malfunction report (with the QV-xxx error code if shown), or security concern directly to quillvibe@jhonrey.com.',
          style: { margin: '4px 0 0' },
        }),
      ),
    ),
  );

  container.appendChild(page);
}
