import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeUniformTabWidth, TabDragController } from '../src/core/tab-drag-controller';
import { TabManager } from '../src/core/tab-manager';

const { mockWindowBounds } = vi.hoisted(() => ({
  mockWindowBounds: [] as Array<{ label: string; x: number; y: number; width: number; height: number }>,
}));

vi.mock('../src/core/bridge', () => ({
  listDesktopWindowBounds: vi.fn(async () => [...mockWindowBounds]),
  moveDesktopWindow: vi.fn(async () => {}),
}));

type Handler = (ev: Record<string, unknown>) => void;

class MockClassList {
  private set = new Set<string>();
  add(...names: string[]) {
    names.forEach((n) => this.set.add(n));
  }
  remove(...names: string[]) {
    names.forEach((n) => this.set.delete(n));
  }
  toggle(name: string, force?: boolean) {
    if (force === undefined) {
      if (this.set.has(name)) this.set.delete(name);
      else this.set.add(name);
      return;
    }
    if (force) this.set.add(name);
    else this.set.delete(name);
  }
  contains(name: string) {
    return this.set.has(name);
  }
}

class MockNode {
  tagName: string;
  id = '';
  className = '';
  classList = new MockClassList();
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  textContent = '';
  children: MockNode[] = [];
  parent: MockNode | null = null;
  scrollLeft = 0;
  clientWidth = 600;
  scrollWidth = 600;
  offsetWidth = 140;
  private widthPx = 140;
  private listeners = new Map<string, Set<Handler>>();
  private customRect: DOMRect | null = null;

  constructor(tagName = 'div', widthPx = 140) {
    this.tagName = tagName.toUpperCase();
    this.widthPx = widthPx;
    this.offsetWidth = widthPx;
  }

  setAttribute() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  closest(selector: string) {
    if (selector === '.qv-tab-close' && this.className.includes('qv-tab-close')) {
      return this;
    }
    return null;
  }
  get parentNode(): MockNode | null {
    return this.parent;
  }
  get nextSibling(): MockNode | null {
    if (!this.parent) return null;
    const idx = this.parent.children.indexOf(this);
    if (idx === -1 || idx + 1 >= this.parent.children.length) return null;
    return this.parent.children[idx + 1];
  }
  appendChild(node: MockNode) {
    this.append(node);
    return node;
  }
  append(...nodes: MockNode[]) {
    for (const n of nodes) {
      if (n.parent === this) {
        const oldIdx = this.children.indexOf(n);
        if (oldIdx !== -1) this.children.splice(oldIdx, 1);
      }
      n.parent = this;
      this.children.push(n);
    }
  }
  insertBefore(newNode: MockNode, refNode: MockNode | null) {
    const oldIdx = this.children.indexOf(newNode);
    if (oldIdx !== -1) this.children.splice(oldIdx, 1);
    if (!refNode) {
      this.children.push(newNode);
    } else {
      const refIdx = this.children.indexOf(refNode);
      if (refIdx === -1) this.children.push(newNode);
      else this.children.splice(refIdx, 0, newNode);
    }
    newNode.parent = this;
    return newNode;
  }
  remove() {
    if (!this.parent) return;
    const idx = this.parent.children.indexOf(this);
    if (idx !== -1) this.parent.children.splice(idx, 1);
    this.parent = null;
  }
  querySelector(selector: string): MockNode | null {
    const cls = selector.startsWith('.') ? selector.slice(1) : selector;
    for (const child of this.children) {
      if (child.className.split(/\s+/).includes(cls)) return child;
    }
    return null;
  }
  querySelectorAll(selector: string): MockNode[] {
    const cls = selector.startsWith('.') ? selector.slice(1) : selector;
    return this.children.filter((c) => c.className.split(/\s+/).includes(cls));
  }
  addEventListener(type: string, fn: Handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Handler) {
    this.listeners.get(type)?.delete(fn);
  }
  dispatch(type: string, ev: Record<string, unknown> = {}) {
    const payload = {
      type,
      target: this,
      preventDefault: () => {},
      stopPropagation: () => {},
      ...ev,
    };
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      fn(payload);
    }
  }
  setCustomRect(rect: DOMRect) {
    this.customRect = rect;
  }
  getBoundingClientRect(): DOMRect {
    if (this.customRect) return this.customRect;
    if (this.parent && this.className.includes('qv-book-tab')) {
      let left = 40 - this.parent.scrollLeft;
      for (const child of this.parent.children) {
        if (child === this) {
          return {
            left,
            right: left + this.widthPx,
            top: 4,
            bottom: 34,
            width: this.widthPx,
            height: 30,
            x: left,
            y: 4,
            toJSON: () => ({}),
          };
        }
        left += child.widthPx + 4;
      }
    }
    return {
      left: 40,
      right: 40 + this.clientWidth,
      top: 0,
      bottom: 36,
      width: this.clientWidth,
      height: 36,
      x: 40,
      y: 0,
      toJSON: () => ({}),
    };
  }
}

function setupDragHarness(widths: number[] = [140, 140, 140, 140]) {
  const storage = new Map<string, string>();
  const winListeners = new Map<string, Set<Handler>>();
  const rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
  let nextRaf = 1;

  const body = new MockNode('body');
  const mockWin = {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    },
    addEventListener: (type: string, fn: Handler) => {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: Handler) => {
      winListeners.get(type)?.delete(fn);
    },
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      const id = nextRaf++;
      rafQueue.push({ id, cb });
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      const idx = rafQueue.findIndex((q) => q.id === id);
      if (idx !== -1) rafQueue.splice(idx, 1);
    },
  };

  vi.stubGlobal('window', mockWin);
  vi.stubGlobal('document', {
    body,
    createElement: (tag: string) => new MockNode(tag),
  });

  const dispatchWin = (type: string, ev: Record<string, unknown> = {}) => {
    const payload = { type, preventDefault: () => {}, ...ev };
    for (const fn of [...(winListeners.get(type) ?? [])]) {
      fn(payload);
    }
  };

  const flushRafFrame = () => {
    const item = rafQueue.shift();
    if (item) item.cb(performance.now());
  };

  const shell = new MockNode('div', 720);
  shell.clientWidth = 720;
  shell.setCustomRect({
    left: 40,
    right: 760,
    top: 0,
    bottom: 36,
    width: 720,
    height: 36,
    x: 40,
    y: 0,
    toJSON: () => ({}),
  });

  const bar = new MockNode('div');
  bar.setCustomRect({
    left: 0,
    right: 900,
    top: 0,
    bottom: 36,
    width: 900,
    height: 36,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  const strip = new MockNode('div');
  strip.clientWidth = 660;
  strip.scrollWidth = 660;
  shell.append(strip);

  const addBtn = new MockNode('button', 26);
  addBtn.className = 'qv-tab-add-btn';
  shell.append(addBtn);

  bar.append(shell);

  const ids = widths.map((_, i) => `book-${i + 1}`);
  const manager = new TabManager(ids, 'book-1');
  const onActivate = vi.fn((id: string) => manager.setActiveTabId(id));
  const onFinishInStrip = vi.fn();
  const onCancel = vi.fn();
  const onDetach = vi.fn();
  const onMerge = vi.fn();
  const onHoverTarget = vi.fn();
  const onLeaveTarget = vi.fn();

  const controller = new TabDragController({
    getWindowLabel: () => 'main',
    getTabIds: () => manager.getTabIds(),
    getActiveTabId: () => manager.getActiveTabId(),
    onOrderChange: (next) => {
      manager.setOrder(next, { persist: false });
    },
    onActivateTab: onActivate,
    onFinishInStrip,
    onCancel,
    onDetachToNewWindow: onDetach,
    onMergeIntoWindow: onMerge,
    getTargetWindowStripMetrics: () => ({ tabWidthPx: 140, tabCount: 2, stripLeftOffsetPx: 40 }),
    onHoverTargetWindow: onHoverTarget,
    onLeaveTargetWindow: onLeaveTarget,
  });

  const tabEls = ids.map((id, i) => {
    const tab = new MockNode('div', widths[i]);
    tab.className = 'qv-book-tab';
    tab.dataset.tabId = id;
    const close = new MockNode('button', 17);
    close.className = 'qv-tab-close';
    tab.append(close);
    strip.append(tab);
    controller.attachTab(tab as unknown as HTMLElement, strip as unknown as HTMLElement, bar as unknown as HTMLElement, {
      tabId: id,
      tabTitle: `Book ${i + 1}`,
    });
    return { tab, close, id };
  });

  controller.bindTabStripLayout(
    strip as unknown as HTMLElement,
    addBtn as unknown as HTMLElement,
    shell as unknown as HTMLElement,
  );

  return {
    body,
    bar,
    shell,
    strip,
    addBtn,
    manager,
    controller,
    tabEls,
    dispatchWin,
    flushRafFrame,
    onActivate,
    onFinishInStrip,
    onCancel,
    onDetach,
    onMerge,
    onHoverTarget,
    onLeaveTarget,
  };
}

describe('TabManager single source of truth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maintains stable identity, immutable reorders, close fallback, and persisted order', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      },
    });

    const mgr = new TabManager(['book-a', 'book-b', 'book-c'], 'book-b');
    const prevIds = mgr.getTabIds();
    mgr.reorderTab('book-a', 2);
    expect(prevIds).toEqual(['book-a', 'book-b', 'book-c']);
    expect(mgr.getTabIds()).toEqual(['book-b', 'book-c', 'book-a']);
    expect(mgr.getActiveTabId()).toBe('book-b');

    mgr.savePersistedOrder('main');
    const loaded = mgr.loadPersistedOrder('main');
    expect(loaded).toEqual({
      tabIds: ['book-b', 'book-c', 'book-a'],
      activeTabId: 'book-b',
    });

    const closeRes = mgr.closeTab('book-b');
    expect(closeRes.closed).toBe(true);
    expect(closeRes.nextActiveId).toBe('book-c');

    mgr.closeTab('book-c');
    const lastClose = mgr.closeTab('book-a');
    expect(lastClose.closed).toBe(false);
    expect(mgr.getTabIds()).toEqual(['book-a']);
  });
});

describe('TabDragController Chrome-style drag state machine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('distinguishes click activation, small jitter below threshold, and close button press', () => {
    const { controller, tabEls, dispatchWin, onActivate, onFinishInStrip } = setupDragHarness();

    // Click close button does not enter PENDING or activate tab
    tabEls[1].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 220,
      clientY: 16,
      target: tabEls[1].close,
    });
    expect(controller.getState()).toBe('IDLE');
    expect(onActivate).not.toHaveBeenCalled();

    // Press tab-2 with jitter < 6px -> activates tab-2 on pointerup without dragging
    tabEls[1].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 2,
      clientX: 220,
      clientY: 16,
    });
    expect(controller.getState()).toBe('PENDING');
    dispatchWin('pointermove', { pointerId: 2, clientX: 223, clientY: 17 });
    expect(controller.getState()).toBe('PENDING');
    dispatchWin('pointerup', { pointerId: 2, clientX: 223, clientY: 17 });
    expect(controller.getState()).toBe('IDLE');
    expect(onActivate).toHaveBeenCalledWith('book-2');
    expect(onFinishInStrip).not.toHaveBeenCalled();

    // Clicking already-active tab-2 does not redundantly re-activate
    onActivate.mockClear();
    tabEls[1].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 3,
      clientX: 220,
      clientY: 16,
    });
    dispatchWin('pointerup', { pointerId: 3, clientX: 220, clientY: 16 });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('reorders left, right, first-to-last, last-to-first, and across varying tab widths smoothly', () => {
    const { controller, manager, tabEls, strip, dispatchWin, onFinishInStrip, onActivate } =
      setupDragHarness([90, 210, 110, 150]);

    // Drag narrow tab-1 right across wide tab-2, tab-3, tab-4 (first-to-last)
    // Layout slots start at: [40..130], [134..344 (mid=239)], [348..458 (mid=403)], [462..612 (mid=537)]
    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 10,
      clientX: 85,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 10, clientX: 245, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    expect(manager.getTabIds()).toEqual(['book-2', 'book-1', 'book-3', 'book-4']);

    dispatchWin('pointermove', { pointerId: 10, clientX: 550, clientY: 16 });
    expect(manager.getTabIds()).toEqual(['book-2', 'book-3', 'book-4', 'book-1']);

    dispatchWin('pointerup', { pointerId: 10, clientX: 550, clientY: 16 });
    expect(controller.getState()).toBe('IDLE');
    expect(onFinishInStrip).toHaveBeenCalledWith(true);
    expect(onActivate).not.toHaveBeenCalled();
    expect(strip.querySelectorAll('.qv-book-tab').map((n) => n.dataset.tabId)).toEqual([
      'book-2',
      'book-3',
      'book-4',
      'book-1',
    ]);

    // Drag last tab (book-1) back to first position
    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 11,
      clientX: 550,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 11, clientX: 60, clientY: 16 });
    expect(manager.getTabIds()).toEqual(['book-1', 'book-2', 'book-3', 'book-4']);
    dispatchWin('pointerup', { pointerId: 11, clientX: 60, clientY: 16 });
  });

  it('returns smoothly when dragged outside vertically and brought back inside, and supports Escape / blur / tab close cancellation', () => {
    const { body, controller, manager, tabEls, dispatchWin, onCancel, onDetach } =
      setupDragHarness([140, 140, 140]);

    // Drag tab-1 right by 1 slot, then pull vertically outside detach threshold -> DETACH_PREVIEW, then return inside -> DRAGGING
    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 20,
      clientX: 100,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 20, clientX: 270, clientY: 16 });
    expect(manager.getTabIds()).toEqual(['book-2', 'book-1', 'book-3']);

    dispatchWin('pointermove', { pointerId: 20, clientX: 270, clientY: 110 });
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    expect(body.children.some((c) => c.id === 'qv-tab-drag-ghost')).toBe(true);

    dispatchWin('pointermove', { pointerId: 20, clientX: 270, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    expect(body.children.some((c) => c.id === 'qv-tab-drag-ghost')).toBe(false);

    // Escape cancels and restores original order cleanly
    dispatchWin('keydown', { key: 'Escape' });
    expect(controller.getState()).toBe('IDLE');
    expect(manager.getTabIds()).toEqual(['book-1', 'book-2', 'book-3']);
    expect(onCancel).toHaveBeenCalledWith(['book-1', 'book-2', 'book-3']);
    expect(body.classList.contains('is-tab-dragging')).toBe(false);
    expect(tabEls[0].tab.classList.contains('is-dragging')).toBe(false);
    expect(onDetach).not.toHaveBeenCalled();

    // Closing dragged source tab mid-drag cancels safely without restoring the closed tab
    tabEls[1].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 21,
      clientX: 240,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 21, clientX: 100, clientY: 16 });
    controller.handleTabRemoved('book-2');
    expect(controller.getState()).toBe('IDLE');
    expect(manager.getTabIds()).toEqual(['book-1', 'book-3']);

    // Window blur mid-drag cancels cleanly
    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 22,
      clientX: 100,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 22, clientX: 250, clientY: 16 });
    dispatchWin('blur');
    expect(controller.getState()).toBe('IDLE');
  });

  it('auto-scrolls horizontally when overflowing tab strip edge is reached', () => {
    const { strip, controller, manager, tabEls, dispatchWin, flushRafFrame } = setupDragHarness([
      180, 180, 180, 180, 180,
    ]);
    strip.clientWidth = 420;
    strip.scrollWidth = 940;
    strip.setCustomRect({
      left: 40,
      right: 460,
      top: 0,
      bottom: 36,
      width: 420,
      height: 36,
      x: 40,
      y: 0,
      toJSON: () => ({}),
    });

    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 30,
      clientX: 120,
      clientY: 16,
    });
    // Move close to right edge of scrolled strip
    dispatchWin('pointermove', { pointerId: 30, clientX: 448, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    expect(strip.scrollLeft).toBe(0);

    flushRafFrame();
    expect(strip.scrollLeft).toBeGreaterThan(0);

    dispatchWin('pointerup', { pointerId: 30, clientX: 448, clientY: 16 });
    expect(controller.getState()).toBe('IDLE');
    expect(manager.getTabIds().length).toBe(5);
  });

  it('calculates uniform Chrome-style tab widths and avoids idle transform churn on the + button', () => {
    expect(computeUniformTabWidth(900, 1)).toBe(220);
    expect(computeUniformTabWidth(900, 2)).toBe(220);
    expect(computeUniformTabWidth(600, 4)).toBe(147);
    // Crowded strip clamps cleanly at minimum tab width instead of shrinking tabs unpredictably
    expect(computeUniformTabWidth(600, 10)).toBe(104);

    const { strip, addBtn } = setupDragHarness([140, 140, 140]);
    expect(strip.style['--qv-tab-width']).toBe('220px');
    expect(addBtn.style.transform).toBe('');
  });

  it('glides neighboring tabs via CSS transforms without premature DOM mutation and tracks the + New Tab button dynamically', () => {
    const { strip, addBtn, controller, manager, tabEls, dispatchWin } =
      setupDragHarness([120, 120, 120]);
    expect(addBtn.style.transform).toBe('');
    expect(manager.getTabIds()).toEqual(['book-1', 'book-2', 'book-3']);

    // Drag Tab A (book-1) right over Tab B -> neighbors shift smoothly via translate3d while DOM stays unmutated mid-drag
    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 40,
      clientX: 100,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 40, clientX: 240, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    expect(manager.getTabIds()).toEqual(['book-2', 'book-1', 'book-3']);
    // DOM order is committed on drop, not mid-drag
    expect(strip.querySelectorAll('.qv-book-tab').map((n) => n.dataset.tabId)).toEqual([
      'book-1',
      'book-2',
      'book-3',
    ]);
    // Tab B shifted left by -(120 + 4) = -124px; Tab C unchanged
    expect(tabEls[1].tab.style.transform).toBe('translate3d(-124px, 0, 0)');
    expect(tabEls[2].tab.style.transform).toBe('');
    // + button stays clean at rest (no idle transform offset)
    expect(addBtn.style.transform).toBe('');

    // Drag rightmost Tab C left across Tab A -> rightmost tab moves freely and + glides dynamically before/after swap
    dispatchWin('pointerup', { pointerId: 40, clientX: 240, clientY: 16 });
    expect(manager.getTabIds()).toEqual(['book-2', 'book-1', 'book-3']);
    tabEls[2].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 42,
      clientX: 340,
      clientY: 16,
    });
    // Pull rightmost tab slightly right -> locked strictly at right boundary; + stays steady without moving/flickering
    dispatchWin('pointermove', { pointerId: 42, clientX: 376, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    expect(tabEls[2].tab.style.transform).toBe('translate3d(0px, 0, 0)');
    expect(addBtn.style.transform).toBe('');
    // Pull rightmost tab all the way left to first slot -> book-3 moves to slot 0, book-1 shifts into final slot
    dispatchWin('pointermove', { pointerId: 42, clientX: 70, clientY: 16 });
    expect(manager.getTabIds()).toEqual(['book-3', 'book-2', 'book-1']);
    expect(addBtn.style.transform).toBe('');
    dispatchWin('pointerup', { pointerId: 42, clientX: 70, clientY: 16 });
    expect(controller.getState()).toBe('IDLE');
    expect(strip.querySelectorAll('.qv-book-tab').map((n) => n.dataset.tabId)).toEqual([
      'book-3',
      'book-2',
      'book-1',
    ]);
    expect(addBtn.style.transform).toBe('');

    // Pull tab vertically out of strip into DETACH_PREVIEW -> gap closes and + glides smoothly left by -(120 + 4) = -124px
    tabEls[2].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 43,
      clientX: 100,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 43, clientX: 100, clientY: 110 });
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    expect(addBtn.style.transform).toBe('translate3d(-124px, 0, 0)');

    // Return into strip -> + restores and commit completes
    dispatchWin('pointermove', { pointerId: 43, clientX: 100, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    expect(addBtn.style.transform).toBe('');
    dispatchWin('pointerup', { pointerId: 43, clientX: 100, clientY: 16 });

    // Overflowing crowded strip keeps + pinned cleanly without transform jitter
    strip.clientWidth = 300;
    strip.scrollWidth = 500;
    strip.dispatch('scroll');
    expect(addBtn.style.transform).toBe('');

    // Sole-tab dragging by tab header enters window-move DETACH_PREVIEW immediately past 6px threshold (horizontal or vertical)
    const sole = setupDragHarness([140]);
    expect(sole.addBtn.style.transform).toBe('');
    sole.tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 41,
      clientX: 100,
      clientY: 16,
    });
    sole.dispatchWin('pointermove', { pointerId: 41, clientX: 145, clientY: 16 });
    expect(sole.controller.getState()).toBe('DETACH_PREVIEW');
    expect(sole.addBtn.classList.contains('is-hidden-during-drag')).toBe(true);
    sole.dispatchWin('keydown', { key: 'Escape' });
    expect(sole.addBtn.classList.contains('is-hidden-during-drag')).toBe(false);
    expect(sole.addBtn.style.transform).toBe('');
    expect(sole.manager.getTabIds()).toEqual(['book-1']);
  });

  it('drags active and inactive tabs cleanly in both directions with boundary hysteresis', () => {
    const { controller, manager, tabEls, dispatchWin } = setupDragHarness([120, 120, 120]);
    const preventSpy = vi.fn();

    // Active tab (book-1) starts in IDLE -> prevents default focus hijack and drags cleanly right & back left
    expect(manager.getActiveTabId()).toBe('book-1');
    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 50,
      clientX: 100,
      clientY: 16,
      preventDefault: preventSpy,
    });
    expect(preventSpy).toHaveBeenCalledTimes(1);

    // Move barely past midpoint of slot 2 (sibMid = 184, hysteresis 4 => threshold > 188): stays in slot 0 at 187px
    dispatchWin('pointermove', { pointerId: 50, clientX: 227, clientY: 16 }); // center = 60+127 = 187 <= 188
    expect(manager.getTabIds()).toEqual(['book-1', 'book-2', 'book-3']);

    // Cross hysteresis band -> moves smoothly right
    dispatchWin('pointermove', { pointerId: 50, clientX: 232, clientY: 16 }); // center = 192 > 188
    expect(manager.getTabIds()).toEqual(['book-2', 'book-1', 'book-3']);

    // Reverse direction back left
    dispatchWin('pointermove', { pointerId: 50, clientX: 70, clientY: 16 });
    expect(manager.getTabIds()).toEqual(['book-1', 'book-2', 'book-3']);

    dispatchWin('pointerup', { pointerId: 50, clientX: 70, clientY: 16 });
    expect(controller.getState()).toBe('IDLE');
    expect(controller.getDetailedState()).toBe('IDLE');
  });

  it('survives lostpointercapture and supports consecutive detachments and reattachment', () => {
    mockWindowBounds.length = 0;
    const { body, controller, manager, tabEls, dispatchWin, onDetach } = setupDragHarness([
      120, 120, 120, 120,
    ]);

    // First detachment (simulate lostpointercapture mid-drag without canceling)
    tabEls[1].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 61,
      clientX: 224,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 61, clientX: 240, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    tabEls[1].tab.dispatch('lostpointercapture', { pointerId: 61 });
    expect(controller.getState()).toBe('DRAGGING');

    dispatchWin('pointermove', { pointerId: 61, clientX: 240, clientY: 120, screenX: 440, screenY: 320 });
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    dispatchWin('pointerup', { pointerId: 61, clientX: 240, clientY: 120, screenX: 440, screenY: 320 });
    expect(onDetach).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('IDLE');
    expect(body.classList.contains('is-tab-dragging')).toBe(false);

    // Consecutive second detachment immediately after first
    tabEls[2].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 62,
      clientX: 348,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 62, clientX: 360, clientY: 130, screenX: 500, screenY: 340 });
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    dispatchWin('pointerup', { pointerId: 62, clientX: 360, clientY: 130, screenX: 500, screenY: 340 });
    expect(onDetach).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toBe('IDLE');

    // Pull out then reattach cleanly without detaching, then detach again cleanly (3rd detach attempt)
    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 63,
      clientX: 100,
      clientY: 16,
    });
    dispatchWin('pointermove', { pointerId: 63, clientX: 110, clientY: 120 });
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    dispatchWin('pointermove', { pointerId: 63, clientX: 110, clientY: 16 });
    expect(controller.getState()).toBe('DRAGGING');
    dispatchWin('pointermove', { pointerId: 63, clientX: 110, clientY: 140, screenX: 300, screenY: 300 });
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    dispatchWin('pointerup', { pointerId: 63, clientX: 110, clientY: 140, screenX: 300, screenY: 300 });
    expect(onDetach).toHaveBeenCalledTimes(3);
    expect(manager.getTabIds().length).toBe(4);
  });

  it('previews cross-window drop target without premature commit and merges only on pointerup', async () => {
    mockWindowBounds.length = 0;
    mockWindowBounds.push(
      { label: 'win-2', x: 800, y: 100, width: 640, height: 500 },
      { label: 'win-3', x: 1500, y: 100, width: 640, height: 500 },
    );

    const { controller, tabEls, dispatchWin, onDetach, onMerge, onHoverTarget, onLeaveTarget } =
      setupDragHarness([120, 120, 120]);

    tabEls[0].tab.dispatch('pointerdown', {
      button: 0,
      isPrimary: true,
      pointerId: 70,
      clientX: 100,
      clientY: 16,
    });
    // Begin drag and flush microtasks so listDesktopWindowBounds() resolves
    dispatchWin('pointermove', { pointerId: 70, clientX: 115, clientY: 16 });
    await Promise.resolve();
    await Promise.resolve();

    // Hover over win-2 strip -> DRAGGING_OVER_TARGET preview only; NEVER merges during move
    dispatchWin('pointermove', { pointerId: 70, clientX: 115, clientY: 110, screenX: 920, screenY: 118 });
    expect(controller.getState()).toBe('DRAGGING_OVER_TARGET');
    expect(onHoverTarget).toHaveBeenCalledWith('win-2', expect.any(Number), 'Book 1');
    expect(onMerge).not.toHaveBeenCalled();
    expect(onDetach).not.toHaveBeenCalled();

    // Move across into win-3 strip -> leaves win-2 and previews win-3 without merging yet
    dispatchWin('pointermove', { pointerId: 70, clientX: 115, clientY: 110, screenX: 1650, screenY: 118 });
    expect(controller.getState()).toBe('DRAGGING_OVER_TARGET');
    expect(onLeaveTarget).toHaveBeenCalledWith('win-2');
    expect(onHoverTarget).toHaveBeenCalledWith('win-3', expect.any(Number), 'Book 1');
    expect(onMerge).not.toHaveBeenCalled();

    // Release outside any strip cancels target hover -> opens independent new window instead of merging
    dispatchWin('pointermove', { pointerId: 70, clientX: 115, clientY: 220, screenX: 400, screenY: 500 });
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    expect(onLeaveTarget).toHaveBeenCalledWith('win-3');

    // Move back onto win-2 strip and release pointerup -> commits merge cleanly
    dispatchWin('pointermove', { pointerId: 70, clientX: 115, clientY: 110, screenX: 980, screenY: 118 });
    expect(controller.getState()).toBe('DRAGGING_OVER_TARGET');
    dispatchWin('pointerup', { pointerId: 70, clientX: 115, clientY: 110, screenX: 980, screenY: 118 });

    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge).toHaveBeenCalledWith('win-2', 'book-1', expect.any(Number));
    expect(onDetach).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('IDLE');
  });

  it('spawns a live detached window immediately on tear-off, supports unlimited consecutive detaches, and merges immediately on target strip entry', async () => {
    mockWindowBounds.length = 0;
    mockWindowBounds.push({ label: 'win-2', x: 900, y: 100, width: 640, height: 500 });

    const storage = new Map<string, string>();
    const winListeners = new Map<string, Set<Handler>>();
    const body = new MockNode('body');
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      },
      addEventListener: (type: string, fn: Handler) => {
        if (!winListeners.has(type)) winListeners.set(type, new Set());
        winListeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: Handler) => {
        winListeners.get(type)?.delete(fn);
      },
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(performance.now());
        return 1;
      },
      cancelAnimationFrame: () => {},
    });
    vi.stubGlobal('document', {
      body,
      createElement: (tag: string) => new MockNode(tag),
    });
    const dispatchWin = (type: string, ev: Record<string, unknown> = {}) => {
      const payload = { type, preventDefault: () => {}, ...ev };
      for (const fn of [...(winListeners.get(type) ?? [])]) {
        fn(payload);
      }
    };

    const shell = new MockNode('div', 720);
    shell.clientWidth = 720;
    shell.setCustomRect({
      left: 40,
      right: 760,
      top: 0,
      bottom: 36,
      width: 720,
      height: 36,
      x: 40,
      y: 0,
      toJSON: () => ({}),
    });
    const bar = new MockNode('div');
    bar.setCustomRect({
      left: 0,
      right: 900,
      top: 0,
      bottom: 36,
      width: 900,
      height: 36,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const strip = new MockNode('div');
    strip.clientWidth = 660;
    strip.scrollWidth = 660;
    const addBtn = new MockNode('button', 26);
    shell.append(strip, addBtn);
    bar.append(shell);

    const ids = ['book-1', 'book-2', 'book-3', 'book-4', 'book-5', 'book-6'];
    const manager = new TabManager(ids, 'book-1');
    let nextWinIdx = 1;
    let isDraggingAtCommit = false;
    const onLiveDetachSpawn = vi.fn(async () => `quillvibe-win-${nextWinIdx++}`);
    const onLiveDetachCancel = vi.fn();
    const onLiveDetachCommit = vi.fn((_winLabel: string, tabId: string) => {
      isDraggingAtCommit = controller.isDragging();
      manager.closeTab(tabId);
    });
    const onMerge = vi.fn((_targetLabel: string, tabId: string) => {
      manager.closeTab(tabId);
    });

    const controller = new TabDragController({
      getWindowLabel: () => 'main',
      getTabIds: () => manager.getTabIds(),
      getActiveTabId: () => manager.getActiveTabId(),
      immediateMergeOnTargetHover: true,
      onLiveDetachSpawn,
      onLiveDetachCancel,
      onLiveDetachCommit,
      onOrderChange: (next) => manager.setOrder(next, { persist: false }),
      onActivateTab: (id) => manager.setActiveTabId(id),
      onFinishInStrip: () => {},
      onDetachToNewWindow: vi.fn(),
      onMergeIntoWindow: onMerge,
    });

    const tabs = ids.map((id, idx) => {
      const node = new MockNode('div', 100);
      node.className = 'qv-book-tab';
      node.dataset.tabId = id;
      strip.append(node);
      controller.attachTab(node as unknown as HTMLElement, strip as unknown as HTMLElement, bar as unknown as HTMLElement, {
        tabId: id,
        tabTitle: `Book ${idx + 1}`,
      });
      return node;
    });
    controller.bindTabStripLayout(strip as unknown as HTMLElement, addBtn as unknown as HTMLElement, shell as unknown as HTMLElement);

    // 1. Pull book-2 vertically out -> spawns live window immediately & hides source tab, then pull back inside -> cancels live window
    tabs[1].dispatch('pointerdown', { button: 0, isPrimary: true, pointerId: 80, clientX: 180, clientY: 16 });
    dispatchWin('pointermove', { pointerId: 80, clientX: 180, clientY: 110, screenX: 400, screenY: 300 });
    await Promise.resolve();
    await Promise.resolve();
    expect(onLiveDetachSpawn).toHaveBeenCalledTimes(1);
    expect(tabs[1].style.visibility).toBe('hidden');
    expect(controller.getState()).toBe('DETACH_PREVIEW');

    dispatchWin('pointermove', { pointerId: 80, clientX: 180, clientY: 16, screenX: 400, screenY: 16 });
    expect(onLiveDetachCancel).toHaveBeenCalledWith('quillvibe-win-1');
    expect(tabs[1].style.visibility).toBe('');
    expect(controller.getState()).toBe('DRAGGING');
    dispatchWin('pointerup', { pointerId: 80, clientX: 180, clientY: 16 });

    // 2. Unlimited consecutive detaches (4 tabs torn out into 4 live windows; each removed from source with isDragging() === false)
    for (let i = 1; i <= 4; i += 1) {
      tabs[i].dispatch('pointerdown', { button: 0, isPrimary: true, pointerId: 90 + i, clientX: 180, clientY: 16 });
      dispatchWin('pointermove', { pointerId: 90 + i, clientX: 180, clientY: 115, screenX: 420 + i * 20, screenY: 320 });
      await Promise.resolve();
      await Promise.resolve();
      dispatchWin('pointerup', { pointerId: 90 + i, clientX: 180, clientY: 115, screenX: 420 + i * 20, screenY: 320 });
      expect(isDraggingAtCommit).toBe(false);
    }
    expect(onLiveDetachCommit).toHaveBeenCalledTimes(4);
    expect(manager.getTabIds()).toEqual(['book-1', 'book-6']);

    // 3. Tear book-6 out and drag directly onto win-2 tab strip -> immediately cancels live window and joins win-2 without waiting for pointerup
    tabs[5].dispatch('pointerdown', { button: 0, isPrimary: true, pointerId: 99, clientX: 180, clientY: 16 });
    dispatchWin('pointermove', { pointerId: 99, clientX: 195, clientY: 16 });
    await Promise.resolve();
    await Promise.resolve();
    dispatchWin('pointermove', { pointerId: 99, clientX: 195, clientY: 115, screenX: 980, screenY: 118 });
    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge).toHaveBeenCalledWith('win-2', 'book-6', expect.any(Number));
    expect(controller.getState()).toBe('IDLE');
    expect(manager.getTabIds()).toEqual(['book-1']);

    // 4. Special page tabs (Settings, Manual, Help, Course, Extensions) also detach live and merge cleanly
    const settingsTab = new MockNode('div', 100);
    settingsTab.className = 'qv-book-tab';
    settingsTab.dataset.tabId = '__qv_settings_tab__';
    strip.append(settingsTab);
    manager.openTab('__qv_settings_tab__', { activate: true });
    controller.attachTab(settingsTab as unknown as HTMLElement, strip as unknown as HTMLElement, bar as unknown as HTMLElement, {
      tabId: '__qv_settings_tab__',
      tabTitle: 'Settings',
    });

    settingsTab.dispatch('pointerdown', { button: 0, isPrimary: true, pointerId: 105, clientX: 280, clientY: 16 });
    dispatchWin('pointermove', { pointerId: 105, clientX: 280, clientY: 120, screenX: 460, screenY: 340 });
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.getState()).toBe('DETACH_PREVIEW');
    dispatchWin('pointerup', { pointerId: 105, clientX: 280, clientY: 120, screenX: 460, screenY: 340 });
    expect(onLiveDetachCommit).toHaveBeenCalledWith(expect.stringMatching(/^quillvibe-win-/), '__qv_settings_tab__');
    expect(manager.getTabIds()).toEqual(['book-1']);
  });
});
