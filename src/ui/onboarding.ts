import type { AppActions } from '../core/app-context';
import type { StudioViewId } from '../core/types';
import { bookvibeLogo, el, svgEl } from './dom';

const SPLASH_SEEN_KEY = 'bookvibe.splashSeen.v1';
const TOURS_SEEN_KEY = 'bookvibe.toursSeen.v1';

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const SECTION_TOURS: Record<StudioViewId, TourStep[]> = {
  editor: [
    {
      selector: '.bv-paper-float-nav',
      title: 'Draft, Proofread, Split & Diff',
      body: 'Switch right here between clean Draft prose, 15 editorial Proofread marks, side-by-side Story Bible reference, and word-level Revision Diffs.',
    },
    {
      selector: '.bv-scene-heading',
      title: 'Distraction-Free Paper Sheet',
      body: 'Rename scenes inline or write directly on Obsidian, Parchment, or Ivory paper sheets.',
    },
    {
      selector: '.bv-save-split',
      title: 'One-Click Save & Export Format',
      body: 'Pick your preferred extension (.bookvibe, .epub, .md, .bvscene) and click Save anytime to export immediately.',
    },
  ],
  corkboard: [
    {
      selector: '.bv-main-stage',
      title: 'Index Card Corkboard',
      body: 'Arrange chapters and scenes visually, track POV badges, and adjust target progress bars.',
    },
  ],
  outline: [
    {
      selector: '.bv-main-stage',
      title: 'Outline Revision Ledger',
      body: 'Filter scenes by draft stage, timeline location, and word count across the full book.',
    },
  ],
  bible: [
    {
      selector: '.bv-main-stage',
      title: 'Story Bible Codex',
      body: 'Store character sheets, locations, lore, custom world tabs, reference images, and arbitrary metadata fields.',
    },
  ],
  graph: [
    {
      selector: '.bv-graph-canvas-wrap',
      title: 'Live Interactive Story Graph',
      body: 'Drag cards to see edges follow live at 60fps, drag any handle port onto another card to link them, and switch Compact / Standard / Detailed views.',
    },
  ],
  typeset: [
    {
      selector: '.bv-main-stage',
      title: 'Typeset, Full Cover Wrap & Author Seal',
      body: 'Preview book pages with custom device fonts, design front/back/spine covers, and sign builds with your ECDSA Author Key.',
    },
  ],
};

let activeTourOverlay: {
  cursor: HTMLElement;
  ring: HTMLElement;
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

export function destroyActiveTour(): void {
  if (!activeTourOverlay) return;
  activeTourOverlay.cursor.remove();
  activeTourOverlay.ring.remove();
  activeTourOverlay.card.remove();
  activeTourOverlay = null;
}

function buildPointerSvg(): SVGSVGElement {
  const s = svgEl('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' });
  s.appendChild(
    svgEl('path', {
      d: 'M4.5 3.5l14 7.5-5.6 1.9-2.2 5.7-6.2-15.1z',
      fill: '#eceef2',
      stroke: '#08080a',
      'stroke-width': 1.5,
      'stroke-linejoin': 'round',
    }),
  );
  return s;
}

function positionTourStep(): void {
  if (!activeTourOverlay) return;
  const { viewId, stepIdx, cursor, ring, card } = activeTourOverlay;
  const steps = SECTION_TOURS[viewId] ?? [];
  const step = steps[stepIdx];
  if (!step) return;

  const target = document.querySelector(step.selector) as HTMLElement | null;
  if (target) {
    const r = target.getBoundingClientRect();
    const cx = Math.max(24, Math.min(window.innerWidth - 32, r.left + Math.min(r.width * 0.45, 110)));
    const cy = Math.max(24, Math.min(window.innerHeight - 32, r.top + Math.min(r.height * 0.5, 28)));
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    ring.style.transform = `translate3d(${cx - 14}px, ${cy - 14}px, 0)`;
    ring.style.opacity = '1';
  } else {
    cursor.style.transform = 'translate3d(240px, 140px, 0)';
    ring.style.opacity = '0';
  }

  const titleEl = card.querySelector('.bv-tour-title') as HTMLElement;
  const bodyEl = card.querySelector('.bv-tour-body') as HTMLElement;
  const metaEl = card.querySelector('.bv-tour-step-meta') as HTMLElement;
  const nextBtn = card.querySelector('.bv-tour-next') as HTMLButtonElement;
  if (titleEl) titleEl.textContent = step.title;
  if (bodyEl) bodyEl.textContent = step.body;
  if (metaEl) metaEl.textContent = `${viewId.toUpperCase()} · Step ${stepIdx + 1} of ${steps.length}`;
  if (nextBtn) nextBtn.textContent = stepIdx + 1 >= steps.length ? 'Done' : 'Next';
}

export function maybeStartSectionTour(
  viewId: StudioViewId,
  actions: AppActions,
  force = false,
): void {
  const settings = actions.getState().settings;
  if (!force && !settings.showOnboardingHints) return;

  const seen = readSeenTours();
  if (!force && seen.has(viewId)) return;

  const steps = SECTION_TOURS[viewId];
  if (!steps || steps.length === 0) return;

  destroyActiveTour();

  const cursor = el('div', { className: 'bv-tour-cursor' }, buildPointerSvg());
  const ring = el('div', { className: 'bv-tour-spotlight' });

  const skipSectionBtn = el('button', {
    className: 'bv-mini-btn',
    text: 'Skip Section',
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
        actions.notify('Guided tours paused. Re-open anytime via Help (?)');
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
    el('div', { className: 'bv-mono-tag bv-tour-step-meta', style: { color: 'var(--accent-amber)' } }),
    el('strong', { className: 'bv-tour-title', style: { fontSize: '13.5px' } }),
    el('p', { className: 'bv-label bv-tour-body', style: { margin: '2px 0 8px' } }),
    el(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
      el('div', { style: { display: 'flex', gap: '6px' } }, skipAllBtn, skipSectionBtn),
      nextBtn,
    ),
  );

  activeTourOverlay = { cursor, ring, card, viewId, stepIdx: 0 };
  document.body.append(ring, cursor, card);
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

  const reduced =
    actions.getState().settings.reducedMotionOverride === 'reduce' ||
    (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  if (alreadyShown || reduced) {
    requestAnimationFrame(() => maybeStartSectionTour(actions.getState().activeView, actions));
    return;
  }

  let finished = false;
  const finishSplash = () => {
    if (finished) return;
    finished = true;
    try {
      window.localStorage.setItem(SPLASH_SEEN_KEY, '1');
    } catch {
      // Ignore storage error
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
    window.setTimeout(() => {
      splash.remove();
      maybeStartSectionTour(actions.getState().activeView, actions);
    }, 380);
  };

  const skipBtn = el('button', {
    className: 'bv-btn',
    text: 'Skip Intro',
    attrs: { type: 'button' },
    on: { click: finishSplash },
  });

  const splash = el(
    'div',
    { className: 'bv-splash-overlay', id: 'bv-splash-overlay' },
    el(
      'div',
      { className: 'bv-splash-inner' },
      el('div', { className: 'bv-splash-emblem' }, bookvibeLogo(74)),
      el('h1', { className: 'bv-splash-title', text: 'Bookvibe' }),
      el('p', { className: 'bv-splash-sub', text: 'Offline book writing, proofing, typesetting & cover studio' }),
      skipBtn,
    ),
  );

  document.body.appendChild(splash);
  window.setTimeout(() => finishSplash(), 920);
}
