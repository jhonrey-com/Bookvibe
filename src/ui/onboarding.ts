import type { AppActions } from '../core/app-context';
import { createEmptyBookProject, upsertBookInLibrary } from '../core/library';
import type { StudioViewId } from '../core/types';
import { bookvibeLogo, el } from './dom';

const SPLASH_SEEN_KEY = 'bookvibe.splashSeen.v1';
const TOURS_SEEN_KEY = 'bookvibe.toursSeen.v1';
const PREVIEW_BOOK_ID = 'proj-salt-cartographer';

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const SECTION_TOURS: Record<StudioViewId, TourStep[]> = {
  editor: [
    {
      selector: '.bv-paper-float-nav',
      title: 'Switch Modes',
      body: 'Move between Draft, 15 Proofread marks, Split reference, and Revision Diff.',
    },
    {
      selector: '.bv-scene-heading',
      title: 'Write Freely',
      body: 'Rename scenes inline or write directly on Obsidian, Parchment, or Ivory sheets.',
    },
    {
      selector: '.bv-save-split',
      title: 'Save Locally',
      body: 'Pick any format and click Save anytime to export a copy to your computer.',
    },
  ],
  corkboard: [
    {
      selector: '.bv-main-stage',
      title: 'Index Cards',
      body: 'Drag scene cards to reorder chapters and edit quick synopses.',
    },
  ],
  outline: [
    {
      selector: '.bv-main-stage',
      title: 'Outline Table',
      body: 'Filter chapters by draft stage, POV character, or word progress.',
    },
  ],
  bible: [
    {
      selector: '.bv-main-stage',
      title: 'Story Bible',
      body: 'Track characters, places, lore, and custom categories with portraits.',
    },
  ],
  graph: [
    {
      selector: '.bv-graph-canvas-wrap',
      title: 'Infinite Graph Canvas',
      body: 'Drag cards anywhere freely; hover card edges to drag connection lines live.',
    },
  ],
  typeset: [
    {
      selector: '.bv-main-stage',
      title: 'Typeset & Cover Wrap',
      body: 'Choose a book trim size, preview Table of Contents, and export clean Print PDF.',
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

export function maybeRunFirstLaunchSplash(actions: AppActions): void {
  const alreadyShown =
    typeof window !== 'undefined' &&
    window.localStorage &&
    window.localStorage.getItem(SPLASH_SEEN_KEY) === '1';

  const isPreview = actions.getState().project.id === PREVIEW_BOOK_ID;

  if (alreadyShown) {
    requestAnimationFrame(() => maybeStartSectionTour(actions.getState().activeView, actions));
    return;
  }

  let finished = false;
  const finishWithMode = (mode: 'preview' | 'blank' | 'skip') => {
    if (finished) return;
    finished = true;
    try {
      window.localStorage.setItem(SPLASH_SEEN_KEY, '1');
    } catch {
      // Ignore storage error
    }

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
      } else if (mode === 'preview') {
        maybeStartSectionTour(actions.getState().activeView, actions, true);
      } else {
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
    window.setTimeout(applyChoice, 340);
  };

  const exploreBtn = el('button', {
    className: 'bv-btn bv-btn-primary',
    text: 'Explore Preview Book',
    attrs: { type: 'button' },
    on: { click: () => finishWithMode('preview') },
  });

  const blankBtn = el('button', {
    className: 'bv-btn',
    text: 'Start New Blank Book',
    attrs: { type: 'button' },
    on: { click: () => finishWithMode('blank') },
  });

  const skipBtn = el('button', {
    className: 'bv-mini-btn',
    text: 'Skip Intro',
    attrs: { type: 'button' },
    on: { click: () => finishWithMode('skip') },
  });

  const splash = el(
    'div',
    { className: 'bv-splash-overlay', id: 'bv-splash-overlay' },
    el(
      'div',
      { className: 'bv-splash-inner' },
      el('div', { className: 'bv-splash-emblem' }, bookvibeLogo(74)),
      el('h1', { className: 'bv-splash-title', text: 'Bookvibe' }),
      el('p', {
        className: 'bv-splash-sub',
        text: isPreview
          ? 'Open the sample book for a brief highlight guide, or begin a blank book right away.'
          : 'Offline book writing, proofing, typesetting & cover studio',
      }),
      el(
        'div',
        { className: 'bv-splash-actions' },
        ...(isPreview ? [exploreBtn, blankBtn] : []),
        skipBtn,
      ),
    ),
  );

  document.body.appendChild(splash);
}
