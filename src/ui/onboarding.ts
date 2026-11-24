import type { AppActions } from '../core/app-context';
import { isTauriRuntime } from '../core/bridge';
import { createEmptyBookProject, upsertBookInLibrary } from '../core/library';
import { syncBrowserPath } from '../core/router';
import type { AppThemeId, StudioViewId, ToolTier } from '../core/types';
import { openInteractiveCourseDrawer } from './course';
import { el, icon, quillvibeLogo } from './dom';

const SPLASH_SEEN_KEY = 'quillvibe.splashSeen.v2';
const LEGACY_SPLASH_KEY = 'bookvibe.splashSeen.v1';
const TOURS_SEEN_KEY = 'quillvibe.toursSeen.v2';
const PREVIEW_BOOK_ID = 'proj-salt-cartographer';

export type SplashEnvironment = 'desktop-app' | 'desktop-web' | 'mobile-web';

export function detectSplashEnvironment(): SplashEnvironment {
  if (isTauriRuntime()) return 'desktop-app';
  if (typeof window !== 'undefined' && window.innerWidth <= 768) return 'mobile-web';
  return 'desktop-web';
}

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const SECTION_TOURS: Record<StudioViewId, TourStep[]> = {
  editor: [
    {
      selector: '.bv-paper-float-nav',
      title: 'Draft, Proofread & Tiers',
      body: 'Start in calm Draft mode, right-click the page for quick formatting or proofread marks, and scale tools anytime in Settings.',
    },
    {
      selector: '.bv-scene-heading',
      title: 'Clean Writing Sheet',
      body: 'Ivory Light sheet is set by default. Rename chapters/scenes inline or drag the vertical <-> borders to resize side panels.',
    },
    {
      selector: '.bv-save-split',
      title: 'Export Local .quillvibe',
      body: 'Export .quillvibe archives, EPUB 3, Markdown, or Print PDFs anytime with zero accounts.',
    },
  ],
  corkboard: [
    {
      selector: '.bv-main-stage',
      title: 'Visual Corkboard',
      body: 'Drag scene cards to reorder chapters, or right-click any card to jump to drafting or change revision status.',
    },
  ],
  outline: [
    {
      selector: '.bv-main-stage',
      title: 'Outline Ledger',
      body: 'Filter scenes live by title, POV, location, or status.',
    },
  ],
  bible: [
    {
      selector: '.bv-main-stage',
      title: 'Story Bible Codex',
      body: 'Manage characters, places, lore, and custom categories with portraits and custom traits.',
    },
  ],
  graph: [
    {
      selector: '.bv-graph-canvas-wrap',
      title: 'Story Graph Canvas',
      body: 'Drag nodes freely, pull port dots to link scenes, or right-click the canvas for layouts.',
    },
  ],
  typeset: [
    {
      selector: '.bv-main-stage',
      title: 'Interior Typeset & Pro Cover Studio',
      body: 'Design multi-layer covers with shapes, gradients, snap-to-grid, and trade trim layouts.',
    },
  ],
  course: [
    {
      selector: '.bv-main-stage',
      title: 'Quillvibe Academy Course',
      body: 'Work through 7 guided modules, 20 hands-on lessons, and interactive knowledge checks at your own pace.',
    },
  ],
};

let activeTourOverlay: {
  outline: HTMLElement;
  card: HTMLElement;
  viewId: StudioViewId;
  stepIdx: number;
} | null = null;

function readSeenTours(): Set<StudioViewId> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(TOURS_SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed as StudioViewId[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenTours(set: Set<StudioViewId>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(TOURS_SEEN_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage limits
  }
}

function markSectionSeen(viewId: StudioViewId): void {
  const seen = readSeenTours();
  seen.add(viewId);
  writeSeenTours(seen);
}

function markAllSectionsSeen(): void {
  writeSeenTours(new Set(['editor', 'corkboard', 'outline', 'bible', 'graph', 'typeset']));
}

export function destroyActiveTour(): void {
  if (!activeTourOverlay) return;
  activeTourOverlay.outline.remove();
  activeTourOverlay.card.remove();
  activeTourOverlay = null;
}

function positionTourStep(): void {
  if (!activeTourOverlay) return;
  const { viewId, stepIdx, outline, card } = activeTourOverlay;
  const steps = SECTION_TOURS[viewId] ?? [];
  const step = steps[stepIdx];
  if (!step) return;

  const target = document.querySelector(step.selector) as HTMLElement | null;
  if (target) {
    const r = target.getBoundingClientRect();
    const pad = 4;
    const x = Math.max(4, Math.round(r.left - pad));
    const y = Math.max(4, Math.round(r.top - pad));
    const w = Math.max(24, Math.min(window.innerWidth - x - 4, Math.round(r.width + pad * 2)));
    const h = Math.max(20, Math.min(window.innerHeight - y - 4, Math.round(r.height + pad * 2)));
    outline.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    outline.style.width = `${w}px`;
    outline.style.height = `${h}px`;
    outline.style.opacity = '1';
  } else {
    outline.style.opacity = '0';
  }

  const titleEl = card.querySelector('.bv-tour-title') as HTMLElement;
  const bodyEl = card.querySelector('.bv-tour-body') as HTMLElement;
  const metaEl = card.querySelector('.bv-tour-step-meta') as HTMLElement;
  const nextBtn = card.querySelector('.bv-tour-next') as HTMLButtonElement;
  if (titleEl) titleEl.textContent = step.title;
  if (bodyEl) bodyEl.textContent = step.body;
  if (metaEl) metaEl.textContent = `${stepIdx + 1} / ${steps.length}`;
  if (nextBtn) nextBtn.textContent = stepIdx + 1 >= steps.length ? 'Done' : 'Next';
}

export function maybeStartSectionTour(
  viewId: StudioViewId,
  actions: AppActions,
  force = false,
): void {
  const state = actions.getState();
  if (!force) {
    if (!state.settings.showOnboardingHints) return;
    if (state.project.id !== PREVIEW_BOOK_ID) return;
  }

  const seen = readSeenTours();
  if (!force && seen.has(viewId)) return;

  const steps = SECTION_TOURS[viewId];
  if (!steps || steps.length === 0) return;

  destroyActiveTour();

  const outline = el('div', { className: 'bv-tour-outline' });

  const skipSectionBtn = el('button', {
    className: 'bv-mini-btn',
    text: 'Skip',
    attrs: { type: 'button' },
    on: {
      click: () => {
        markSectionSeen(viewId);
        destroyActiveTour();
      },
    },
  });

  const skipAllBtn = el('button', {
    className: 'bv-mini-btn',
    text: 'Skip All',
    attrs: { type: 'button' },
    on: {
      click: () => {
        markSectionSeen(viewId);
        actions.updateSettings({ showOnboardingHints: false });
        destroyActiveTour();
      },
    },
  });

  const nextBtn = el('button', {
    className: 'bv-btn bv-btn-primary bv-tour-next',
    text: 'Next',
    attrs: { type: 'button' },
    on: {
      click: () => {
        if (!activeTourOverlay) return;
        const nextIdx = activeTourOverlay.stepIdx + 1;
        if (nextIdx >= steps.length) {
          markSectionSeen(viewId);
          destroyActiveTour();
        } else {
          activeTourOverlay.stepIdx = nextIdx;
          positionTourStep();
        }
      },
    },
  });

  const card = el(
    'aside',
    { className: 'bv-tour-card', attrs: { role: 'status', 'aria-live': 'polite' } },
    el(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
      el('strong', { className: 'bv-tour-title', style: { fontSize: '13px' } }),
      el('span', { className: 'bv-mono-tag bv-tour-step-meta', style: { color: 'var(--accent-amber)' } }),
    ),
    el('p', { className: 'bv-label bv-tour-body', style: { margin: '2px 0 8px' } }),
    el(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
      el('div', { style: { display: 'flex', gap: '6px' } }, skipAllBtn, skipSectionBtn),
      nextBtn,
    ),
  );

  activeTourOverlay = { outline, card, viewId, stepIdx: 0 };
  document.body.append(outline, card);
  requestAnimationFrame(() => positionTourStep());
}

export function replayFullWalkthrough(actions: AppActions): void {
  writeSeenTours(new Set());
  actions.updateSettings({ showOnboardingHints: true });
  maybeStartSectionTour(actions.getState().activeView, actions, true);
}

export function maybeRunFirstLaunchSplash(actions: AppActions, forceShow = false): void {
  const alreadyShown =
    !forceShow &&
    typeof window !== 'undefined' &&
    window.localStorage &&
    (window.localStorage.getItem(SPLASH_SEEN_KEY) === '1' ||
      window.localStorage.getItem(LEGACY_SPLASH_KEY) === '1');

  const isPreview = actions.getState().project.id === PREVIEW_BOOK_ID;

  if (alreadyShown) {
    requestAnimationFrame(() => maybeStartSectionTour(actions.getState().activeView, actions));
    return;
  }

  const env = detectSplashEnvironment();
  let chosenTier: ToolTier = actions.getState().settings.toolTier;
  let chosenTheme: AppThemeId = actions.getState().settings.appTheme;
  let finished = false;

  const finishWithMode = (mode: 'course' | 'blank' | 'preview' | 'skip') => {
    if (finished) return;
    finished = true;
    try {
      window.localStorage.setItem(SPLASH_SEEN_KEY, '1');
    } catch {
      // Ignore storage error
    }

    actions.updateSettings({ toolTier: chosenTier, appTheme: chosenTheme });
    syncBrowserPath('/write', true);

    const reduced =
      actions.getState().settings.reducedMotionOverride === 'reduce' ||
      (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    const applyChoice = () => {
      splash.remove();
      if (mode === 'blank') {
        markAllSectionsSeen();
        const fresh = createEmptyBookProject('Untitled Book', 'Author');
        const lib = upsertBookInLibrary(actions.getState().library, fresh);
        actions.replaceLibrary(lib);
        requestAnimationFrame(() => {
          const prose = document.querySelector('.bv-prose-textarea') as HTMLTextAreaElement | null;
          prose?.focus();
        });
      } else if (mode === 'course') {
        markAllSectionsSeen();
        actions.setState({}, true);
        openInteractiveCourseDrawer(actions, 0);
      } else if (mode === 'preview') {
        actions.setState({}, true);
        maybeStartSectionTour(actions.getState().activeView, actions, true);
      } else {
        actions.setState({}, true);
        markSectionSeen(actions.getState().activeView);
      }
    };

    if (reduced) {
      applyChoice();
      return;
    }

    const emblem = splash.querySelector('.bv-splash-emblem') as HTMLElement | null;
    const targetMark = document.querySelector('.bv-logo-mark') as HTMLElement | null;
    if (emblem && targetMark) {
      const from = emblem.getBoundingClientRect();
      const to = targetMark.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const scale = Math.max(0.28, to.width / Math.max(1, from.width));
      emblem.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
    }
    splash.classList.add('is-morphing-out');
    window.setTimeout(applyChoice, 320);
  };

  // Interactive Tier Picker & Theme toggle for Website Desktop & Desktop App
  const tierRow = el('div', { className: 'qv-splash-tier-grid' });
  const tierCards: Array<{ id: ToolTier; title: string; desc: string }> = [
    { id: 'basic', title: 'Basic', desc: 'Clean page like Word or Docs. Zero clutter.' },
    { id: 'intermediate', title: 'Intermediate', desc: 'Adds Corkboard, Outline, Proofread & Typeset.' },
    { id: 'advanced', title: 'Advanced', desc: 'Full Studio: Story Bible, Graph, Pro Cover & Seal.' },
  ];
  const renderTierButtons = () => {
    tierRow.replaceChildren();
    for (const tc of tierCards) {
      tierRow.appendChild(
        el(
          'button',
          {
            className: `qv-splash-tier-card${chosenTier === tc.id ? ' is-selected' : ''}`,
            attrs: { type: 'button' },
            on: {
              click: () => {
                chosenTier = tc.id;
                renderTierButtons();
              },
            },
          },
          el('strong', { text: tc.title }),
          el('span', { className: 'bv-label', text: tc.desc }),
        ),
      );
    }
  };
  renderTierButtons();

  const themeToggleRow = el(
    'div',
    { className: 'qv-splash-theme-row' },
    ...(['ivory', 'parchment', 'obsidian'] as AppThemeId[]).map((th) => {
      const btn = el('button', {
        className: `bv-mini-btn${chosenTheme === th ? ' is-active' : ''}`,
        text: th === 'ivory' ? 'Ivory Light' : th === 'parchment' ? 'Parchment' : 'Obsidian Dark',
        attrs: { type: 'button' },
        on: {
          click: () => {
            chosenTheme = th;
            actions.updateSettings({ appTheme: th });
            Array.from(themeToggleRow.children).forEach((c, idx) => {
              c.classList.toggle('is-active', idx === (['ivory', 'parchment', 'obsidian'] as AppThemeId[]).indexOf(th));
            });
          },
        },
      });
      return btn;
    }),
  );

  const courseBtn = el(
    'button',
    {
      className: 'bv-btn bv-btn-primary',
      attrs: { type: 'button' },
      on: { click: () => finishWithMode('course') },
    },
    icon('course', 14),
    env === 'mobile-web' ? 'Guided Book Course' : 'Take Complete Book Course',
  );

  const blankBtn = el('button', {
    className: 'bv-btn',
    text: 'Start Blank Book',
    attrs: { type: 'button' },
    on: { click: () => finishWithMode('blank') },
  });

  const resumeBtn = el('button', {
    className: env === 'desktop-app' ? 'bv-btn bv-btn-primary' : 'bv-btn',
    text: isPreview ? 'Explore Sample Book' : 'Continue Writing',
    attrs: { type: 'button' },
    on: { click: () => finishWithMode(isPreview ? 'preview' : 'skip') },
  });

  const envLabel =
    env === 'desktop-app'
      ? 'Desktop Studio · Local Disk Auto-Save, Native Files & LAN Sync'
      : env === 'mobile-web'
        ? 'Mobile Draft Edition · Keyboard-Safe & Offline Local Save'
        : 'Web Studio (/start) · Instant Browser Workspace · Zero Accounts';

  const subtitle =
    env === 'desktop-app'
      ? 'Full offline desktop studio with native .quillvibe file associations, Wi-Fi PIN collaboration, and Pro Cover Designer.'
      : env === 'mobile-web'
        ? 'Draft chapters and notes comfortably on your phone. Export a .quillvibe archive anytime to sync with Desktop.'
        : 'Start clean like Google Docs in Basic mode, or unlock Pro Cover Studio, Proofread Markup, and Typeset tools as your book grows.';

  const splash = el(
    'div',
    { className: `bv-splash-overlay qv-splash-${env}`, id: 'bv-splash-overlay' },
    el(
      'div',
      { className: 'bv-splash-inner' },
      el('div', { className: 'bv-splash-emblem' }, quillvibeLogo(env === 'mobile-web' ? 56 : 74)),
      el('span', { className: 'bv-mono-tag', text: envLabel }),
      el('h1', { className: 'bv-splash-title', text: 'Quillvibe' }),
      el('p', { className: 'bv-splash-sub', text: subtitle }),
      env !== 'mobile-web' ? tierRow : null,
      themeToggleRow,
      el(
        'div',
        { className: 'bv-splash-actions' },
        env === 'desktop-app' ? resumeBtn : courseBtn,
        env === 'desktop-app' ? courseBtn : resumeBtn,
        blankBtn,
      ),
    ),
  );

  document.body.appendChild(splash);
}
