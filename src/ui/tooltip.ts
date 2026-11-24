export interface TooltipSpec {
  title: string;
  short: string;
  details?: string;
  shortcut?: string;
  tips?: string[];
}

interface ActiveTooltipState {
  target: HTMLElement;
  spec: TooltipSpec;
  expanded: boolean;
  pinned: boolean;
}

let tooltipBox: HTMLDivElement | null = null;
let showTimer: number | null = null;
let hideTimer: number | null = null;
let activeState: ActiveTooltipState | null = null;
let globalListenersBound = false;

function clearTimers(): void {
  if (showTimer !== null) {
    window.clearTimeout(showTimer);
    showTimer = null;
  }
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function bindGlobalDismissListeners(): void {
  if (globalListenersBound || typeof document === 'undefined') return;
  globalListenersBound = true;

  document.addEventListener('pointerdown', (e) => {
    if (!activeState || !tooltipBox) return;
    const node = e.target as Node | null;
    if (node && tooltipBox.contains(node)) return;
    hideTooltip();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeState) {
      hideTooltip();
    }
  });

  window.addEventListener('blur', hideTooltip);
  window.addEventListener('wheel', () => {
    if (activeState && !activeState.pinned) hideTooltip();
  }, { passive: true });

  window.addEventListener(
    'scroll',
    () => {
      if (activeState && !activeState.pinned) hideTooltip();
    },
    { passive: true, capture: true },
  );

  window.addEventListener(
    'resize',
    () => {
      if (activeState) positionTooltip();
    },
    { passive: true },
  );
}

function ensureTooltipBox(): HTMLDivElement {
  if (tooltipBox && document.body.contains(tooltipBox)) return tooltipBox;
  tooltipBox = document.createElement('div');
  tooltipBox.className = 'bv-tooltip';
  tooltipBox.setAttribute('role', 'tooltip');
  tooltipBox.setAttribute('aria-hidden', 'true');

  tooltipBox.addEventListener('pointerenter', () => {
    if (activeState?.pinned) {
      clearTimers();
    }
  });

  tooltipBox.addEventListener('pointerleave', () => {
    if (activeState && !activeState.pinned) {
      hideTooltip();
    }
  });

  tooltipBox.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activeState) return;
    const closeBtn = (e.target as HTMLElement | null)?.closest('.bv-tooltip-close');
    if (closeBtn) {
      hideTooltip();
      return;
    }
    const hasDepth = Boolean(activeState.spec.details || activeState.spec.tips?.length);
    if (!hasDepth) return;
    activeState.expanded = !activeState.expanded;
    activeState.pinned = activeState.expanded;
    renderTooltipContents();
    positionTooltip();
  });

  document.body.appendChild(tooltipBox);
  bindGlobalDismissListeners();
  return tooltipBox;
}

function renderTooltipContents(): void {
  if (!activeState) return;
  const box = ensureTooltipBox();
  const { spec, expanded } = activeState;
  const hasDepth = Boolean(spec.details || (spec.tips && spec.tips.length > 0));

  box.replaceChildren();
  box.classList.toggle('is-expanded', expanded);

  const head = document.createElement('div');
  head.className = 'bv-tooltip-head';

  const titleEl = document.createElement('span');
  titleEl.className = 'bv-tooltip-title';
  titleEl.textContent = spec.title;
  head.appendChild(titleEl);

  const metaGroup = document.createElement('span');
  metaGroup.className = 'bv-tooltip-meta';

  if (spec.shortcut) {
    const kbd = document.createElement('kbd');
    kbd.className = 'bv-tooltip-kbd';
    kbd.textContent = spec.shortcut;
    metaGroup.appendChild(kbd);
  }

  if (hasDepth) {
    const toggleCue = document.createElement('span');
    toggleCue.className = 'bv-tooltip-cue';
    toggleCue.textContent = expanded ? 'Less ▴' : 'Details ▾';
    metaGroup.appendChild(toggleCue);
  }

  if (expanded) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'bv-tooltip-close';
    closeBtn.setAttribute('aria-label', 'Close help card');
    closeBtn.textContent = '×';
    metaGroup.appendChild(closeBtn);
  }

  head.appendChild(metaGroup);
  box.appendChild(head);

  const shortEl = document.createElement('div');
  shortEl.className = 'bv-tooltip-short';
  shortEl.textContent = spec.short;
  box.appendChild(shortEl);

  if (expanded && hasDepth) {
    const detailWrap = document.createElement('div');
    detailWrap.className = 'bv-tooltip-body';
    if (spec.details) {
      const p = document.createElement('p');
      p.className = 'bv-tooltip-details';
      p.textContent = spec.details;
      detailWrap.appendChild(p);
    }
    if (spec.tips && spec.tips.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'bv-tooltip-tips';
      for (const tip of spec.tips) {
        const li = document.createElement('li');
        li.textContent = tip;
        ul.appendChild(li);
      }
      detailWrap.appendChild(ul);
    }
    box.appendChild(detailWrap);
  }
}

function positionTooltip(): void {
  if (!activeState || !tooltipBox) return;
  if (!document.body.contains(activeState.target)) {
    hideTooltip();
    return;
  }

  const targetRect = activeState.target.getBoundingClientRect();
  tooltipBox.style.left = '0px';
  tooltipBox.style.top = '0px';
  tooltipBox.classList.add('is-visible');
  tooltipBox.setAttribute('aria-hidden', 'false');

  const boxRect = tooltipBox.getBoundingClientRect();
  const pad = 10;
  const gap = 8;

  let left = targetRect.left + targetRect.width / 2 - boxRect.width / 2;
  left = Math.max(pad, Math.min(window.innerWidth - boxRect.width - pad, left));

  let top = targetRect.bottom + gap;
  if (top + boxRect.height + pad > window.innerHeight) {
    const aboveTop = targetRect.top - boxRect.height - gap;
    if (aboveTop >= pad) {
      top = aboveTop;
    } else {
      top = Math.max(pad, window.innerHeight - boxRect.height - pad);
    }
  }

  tooltipBox.style.left = `${Math.round(left)}px`;
  tooltipBox.style.top = `${Math.round(top)}px`;
}

function showTooltipNow(target: HTMLElement, spec: TooltipSpec, expanded = false): void {
  clearTimers();
  activeState = { target, spec, expanded, pinned: expanded };
  renderTooltipContents();
  positionTooltip();
}

export function showTooltipForElement(target: HTMLElement, spec: TooltipSpec): void {
  showTooltipNow(target, spec, false);
}

function scheduleHide(delayMs: number): void {
  clearTimers();
  hideTimer = window.setTimeout(() => {
    if (activeState && !activeState.pinned) {
      hideTooltip();
    }
  }, delayMs);
}

export function hideTooltip(): void {
  clearTimers();
  activeState = null;
  if (tooltipBox) {
    tooltipBox.classList.remove('is-visible', 'is-expanded');
    tooltipBox.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Attaches custom short hover tooltips that expand with full descriptions when clicked or F1/?.
 */
export function attachTooltip(target: HTMLElement, spec: TooltipSpec): void {
  target.removeAttribute('title');
  if (!target.getAttribute('aria-label')) {
    target.setAttribute('aria-label', spec.title);
  }

  target.addEventListener('pointerenter', () => {
    clearTimers();
    if (activeState?.pinned && activeState.target === target) return;
    showTimer = window.setTimeout(() => {
      if (target.matches(':hover') || document.activeElement === target) {
        showTooltipNow(target, spec, false);
      }
    }, 180);
  });

  target.addEventListener('pointerleave', () => {
    clearTimers();
    if (activeState?.target === target && !activeState.pinned) {
      scheduleHide(40);
    }
  });

  target.addEventListener('focus', () => {
    if (activeState?.pinned) return;
    showTooltipNow(target, spec, false);
  });

  target.addEventListener('blur', () => {
    clearTimers();
    if (activeState?.target === target && !activeState.pinned) {
      hideTooltip();
    }
  });

  target.addEventListener('keydown', (e) => {
    if (e.key === '?' || e.key === 'F1') {
      e.preventDefault();
      const nextExp = !(activeState?.target === target && activeState.expanded);
      showTooltipNow(target, spec, nextExp);
    }
  });

  target.addEventListener('pointerdown', () => {
    if (activeState && !activeState.pinned) {
      hideTooltip();
    }
  });
}
