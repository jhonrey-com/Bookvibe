type LandingThemeMode = 'ivory' | 'parchment' | 'obsidian';

const THEME_SEQUENCE: LandingThemeMode[] = ['ivory', 'parchment', 'obsidian'];
const THEME_LABELS: Record<LandingThemeMode, string> = {
  ivory: 'Ivory Light',
  parchment: 'Parchment',
  obsidian: 'Obsidian Dark',
};
const THEME_META_COLOR: Record<LandingThemeMode, string> = {
  ivory: '#f6f4ef',
  parchment: '#ebe4d5',
  obsidian: '#121210',
};

const PREVIEWS: Record<string, { src: string; alt: string; caption: string }> = {
  editor: {
    src: '/screenshots/editor-workspace.png',
    alt: 'Quillvibe Manuscript workspace showing Binder, Paper Sheet, and Inspector',
    caption: 'Binder navigation, comfortable paper sheet, and Scene Inspector',
  },
  graph: {
    src: '/screenshots/story-graph.png',
    alt: 'Quillvibe Story Graph with linked narrative nodes',
    caption: 'Dual-mode Storyboard and Force Graph synced with your Story Bible',
  },
  cover: {
    src: '/screenshots/cover-studio.png',
    alt: 'Quillvibe Book Cover Studio with layers and alignment properties',
    caption: 'Front, spine, back, and dust-jacket flap layout with alignment guides',
  },
};

function initThemeMorphSwitcher(): void {
  const btn = document.getElementById('ql-theme-toggle');
  const svg = document.getElementById('ql-theme-morph-svg');
  if (!btn || !svg) return;

  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem('quillvibe.landingTheme');
  } catch {
    saved = null;
  }

  let current: LandingThemeMode =
    saved === 'ivory' || saved === 'parchment' || saved === 'obsidian'
      ? saved
      : prefersDark
        ? 'obsidian'
        : 'ivory';

  const apply = (mode: LandingThemeMode) => {
    current = mode;
    document.documentElement.dataset.theme = mode;
    svg.setAttribute('data-theme-mode', mode);
    btn.setAttribute('aria-label', `Switch Theme (${THEME_LABELS[mode]})`);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = THEME_META_COLOR[mode];
    try {
      window.localStorage.setItem('quillvibe.landingTheme', mode);
    } catch {
      // Ignore storage errors
    }
  };

  apply(current);
  btn.addEventListener('click', () => {
    const idx = THEME_SEQUENCE.indexOf(current);
    const next = THEME_SEQUENCE[(idx + 1) % THEME_SEQUENCE.length];
    apply(next);
  });
}

function initShowcaseTabs(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-preview]'));
  const img = document.getElementById('ql-preview-img') as HTMLImageElement | null;
  const caption = document.getElementById('ql-preview-caption');
  if (!img || buttons.length === 0) return;

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.preview ?? 'editor';
      const entry = PREVIEWS[key] ?? PREVIEWS.editor;
      for (const b of buttons) {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      }
      img.src = entry.src;
      img.alt = entry.alt;
      if (caption) caption.textContent = entry.caption;
    });
  }
}

initThemeMorphSwitcher();
initShowcaseTabs();
