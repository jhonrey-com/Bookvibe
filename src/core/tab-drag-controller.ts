import {
  listDesktopWindowBounds,
  moveDesktopWindow,
  type DesktopWindowBounds,
} from './bridge';

export type TabDragState =
  | 'IDLE'
  | 'PENDING'
  | 'DRAGGING'
  | 'DETACH_PREVIEW'
  | 'DRAGGING_OVER_TARGET'
  | 'DROP_PENDING'
  | 'COMMITTING'
  | 'COMPLETED'
  | 'CANCELLED';

export type DetailedTabDragState =
  | 'IDLE'
  | 'PENDING'
  | 'DRAGGING_ATTACHED'
  | 'DRAGGING_DETACHED'
  | 'DRAGGING_OVER_TARGET'
  | 'DROP_PENDING'
  | 'COMMITTING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TargetWindowStripMetrics {
  tabWidthPx?: number;
  tabCount?: number;
  stripLeftOffsetPx?: number;
}

export interface TabDragConfig {
  dragThresholdPx: number;
  detachThresholdPx: number;
  edgeScrollZonePx: number;
  edgeScrollMaxPxPerFrame: number;
}

export interface UniformTabWidthOptions {
  minWidth?: number;
  maxWidth?: number;
  gapPx?: number;
}

export const DEFAULT_UNIFORM_TAB_MIN_PX = 104;
export const DEFAULT_UNIFORM_TAB_MAX_PX = 220;
export const DEFAULT_TAB_GAP_PX = 3;

/**
 * Computes Chrome-style equal width for every tab in the strip from available space.
 */
export function computeUniformTabWidth(
  availableWidth: number,
  tabCount: number,
  options: UniformTabWidthOptions = {},
): number {
  const minW = options.minWidth ?? DEFAULT_UNIFORM_TAB_MIN_PX;
  const maxW = options.maxWidth ?? DEFAULT_UNIFORM_TAB_MAX_PX;
  const gapPx = options.gapPx ?? DEFAULT_TAB_GAP_PX;
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return maxW;
  }
  const safeCount = Math.max(1, Math.floor(tabCount));
  const totalGaps = Math.max(0, safeCount - 1) * gapPx;
  const raw = Math.floor((availableWidth - totalGaps) / safeCount);
  return Math.max(minW, Math.min(maxW, raw));
}

export interface TabDragCallbacks {
  getWindowLabel: () => string;
  getTabIds: () => string[];
  getActiveTabId: () => string;
  onOrderChange: (nextIds: string[]) => void;
  onActivateTab: (tabId: string) => void;
  onFinishInStrip: (orderChanged: boolean) => void;
  onCancel?: (restoredIds: string[]) => void;
  onDetachToNewWindow: (
    tabId: string,
    tabTitle: string,
    screenX: number,
    screenY: number,
  ) => void;
  onMergeIntoWindow: (
    targetWindowLabel: string,
    tabId: string,
    insertionIndex: number,
  ) => void;
  getTargetWindowStripMetrics?: (targetWindowLabel: string) => TargetWindowStripMetrics | null;
  onHoverTargetWindow?: (targetWindowLabel: string, insertionIndex: number, tabTitle: string) => void;
  onLeaveTargetWindow?: (targetWindowLabel: string) => void;
  onLiveDetachSpawn?: (
    tabId: string,
    tabTitle: string,
    screenX: number,
    screenY: number,
  ) => Promise<string | null>;
  onLiveDetachCancel?: (windowLabel: string) => void;
  onLiveDetachCommit?: (windowLabel: string, tabId: string) => void;
  immediateMergeOnTargetHover?: boolean;
}

interface TabSlotSnapshot {
  tabId: string;
  el: HTMLElement;
  baseLeft: number;
  width: number;
}

interface StripLayoutBinding {
  tabStrip: HTMLElement;
  addTabBtn: HTMLElement;
  shellEl: HTMLElement;
  desktopTabBarEl?: HTMLElement;
  cleanup: () => void;
}

interface ActiveDragSession {
  pointerId: number;
  sourceTabId: string;
  tabTitle: string;
  tabEl: HTMLElement;
  tabStrip: HTMLElement;
  desktopTabBarEl: HTMLElement;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  lastScreenX: number;
  lastScreenY: number;
  dragAnchorClientX: number;
  dragAnchorScrollLeft: number;
  initialTabWidth: number;
  grabOffsetX: number;
  grabOffsetY: number;
  tabLeftInWindow: number;
  barRect: DOMRect;
  originalTabIds: string[];
  hasPointerCapture: boolean;
  ghostEl: HTMLElement | null;
  cachedWindows: DesktopWindowBounds[];
  boundsLoaded: boolean;
  hoverTargetWin: DesktopWindowBounds | null;
  hoverInsertionIndex: number;
  liveDetachedWindowLabel: string | null;
  liveDetachSpawning: boolean;
  liveDetachCancelled: boolean;
  liveDetachSpawnPromise: Promise<string | null> | null;
  baseSlots: TabSlotSnapshot[];
  gapPx: number;
  totalContentWidth: number;
  availableExtraRightPx: number;
  sourceBaseIndex: number;
  currentTargetIndex: number;
  currentOrder: string[];
  lastClampedDx: number;
  cleanupListeners: () => void;
}

const DEFAULT_CONFIG: TabDragConfig = {
  dragThresholdPx: 6,
  detachThresholdPx: 42,
  edgeScrollZonePx: 36,
  edgeScrollMaxPxPerFrame: 8,
};

const TARGET_STRIP_HEIGHT_PX = 52;
const APPROX_TAB_WIDTH_PX = 160;
const APPROX_STRIP_LEFT_OFFSET_PX = 44;
const SLOT_SWITCH_HYSTERESIS_PX = 4;

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Explicit pointer-event state machine for Chrome-style uniform tab sizing,
 * zero-flicker in-flow New Tab (`+`) layout positioning, rightmost-tab glide travel,
 * edge auto-scrolling, vertical tear-off detachment, sole-tab native window dragging,
 * cross-window merging, and safe cancellation.
 */
export class TabDragController {
  private state: TabDragState = 'IDLE';
  private callbacks: TabDragCallbacks;
  private config: TabDragConfig;
  private activeSession: ActiveDragSession | null = null;
  private layoutBinding: StripLayoutBinding | null = null;
  private lastAppliedAddDelta: number | null = null;
  private lastAppliedTabWidth: number | null = null;
  private moveRafId: number | null = null;
  private edgeScrollRafId: number | null = null;
  private pendingMovePos: { label: string; x: number; y: number } | null = null;
  private tabBindings = new WeakMap<HTMLElement, () => void>();

  constructor(callbacks: TabDragCallbacks, config: Partial<TabDragConfig> = {}) {
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): TabDragState {
    return this.state;
  }

  getDetailedState(): DetailedTabDragState {
    if (this.state === 'DRAGGING') return 'DRAGGING_ATTACHED';
    if (this.state === 'DETACH_PREVIEW') return 'DRAGGING_DETACHED';
    return this.state;
  }

  isDragging(): boolean {
    return (
      this.state === 'DRAGGING' ||
      this.state === 'DETACH_PREVIEW' ||
      this.state === 'DRAGGING_OVER_TARGET' ||
      this.state === 'DROP_PENDING'
    );
  }

  /**
   * Bind the `+` New Tab button and uniform tab-width sizing inside `.qv-tab-strip-shell`.
   */
  bindTabStripLayout(
    tabStrip: HTMLElement,
    addTabBtn: HTMLElement,
    shellEl: HTMLElement,
    desktopTabBarEl?: HTMLElement,
  ): () => void {
    this.layoutBinding?.cleanup();
    this.layoutBinding = null;
    this.lastAppliedAddDelta = null;
    this.lastAppliedTabWidth = null;

    addTabBtn.setAttribute('draggable', 'false');

    const onScroll = () => {
      this.syncNewTabButtonPosition(true);
    };
    const onResize = () => {
      this.syncUniformTabWidths();
      this.syncNewTabButtonPosition(true);
    };

    tabStrip.addEventListener('scroll', onScroll, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        this.syncUniformTabWidths();
        this.syncNewTabButtonPosition(true);
      });
      ro.observe(desktopTabBarEl ?? shellEl);
    } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', onResize, { passive: true });
    }

    const cleanup = () => {
      tabStrip.removeEventListener('scroll', onScroll);
      if (ro) {
        ro.disconnect();
      } else if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('resize', onResize);
      }
    };

    this.layoutBinding = { tabStrip, addTabBtn, shellEl, desktopTabBarEl, cleanup };
    this.syncUniformTabWidths();
    this.syncNewTabButtonPosition(true);
    return () => {
      if (this.layoutBinding?.cleanup === cleanup) {
        this.layoutBinding.cleanup();
        this.layoutBinding = null;
      }
    };
  }

  /**
   * Synchronize uniform equal tab width across all tabs in the strip.
   */
  syncUniformTabWidths(): number | null {
    const binding = this.layoutBinding;
    if (!binding) return null;
    if (this.isDragging()) return this.lastAppliedTabWidth;

    const { tabStrip, shellEl, desktopTabBarEl, addTabBtn } = binding;
    const tabs = tabStrip.querySelectorAll<HTMLElement>('.qv-book-tab');
    const tabCount = Math.max(1, tabs.length);

    let availableWidth = 0;
    const barW =
      desktopTabBarEl && desktopTabBarEl.clientWidth > 0
        ? desktopTabBarEl.clientWidth
        : 0;
    if (barW > 0) {
      const addW = addTabBtn.offsetWidth > 0 ? addTabBtn.offsetWidth : 28;
      // Reserve fixed chrome width: logo (24) + add btn + menu btn (26) + window controls (112) + gaps/padding (64)
      availableWidth = Math.max(120, barW - addW - 226);
    } else {
      const shellW = shellEl.clientWidth > 0 ? shellEl.clientWidth : shellEl.getBoundingClientRect().width;
      const addW = addTabBtn.offsetWidth > 0 ? addTabBtn.offsetWidth : 28;
      availableWidth = shellW > 0 ? Math.max(120, shellW - addW - 8) : 0;
    }

    if (availableWidth <= 0) return null;
    const nextWidth = computeUniformTabWidth(availableWidth, tabCount, {
      minWidth: DEFAULT_UNIFORM_TAB_MIN_PX,
      maxWidth: DEFAULT_UNIFORM_TAB_MAX_PX,
      gapPx: DEFAULT_TAB_GAP_PX,
    });

    if (this.lastAppliedTabWidth !== nextWidth) {
      this.lastAppliedTabWidth = nextWidth;
      const setProp = (tabStrip.style as CSSStyleDeclaration & {
        setProperty?: (name: string, val: string) => void;
      }).setProperty;
      if (typeof setProp === 'function') {
        setProp.call(tabStrip.style, '--qv-tab-width', `${nextWidth}px`);
      } else {
        (tabStrip.style as unknown as Record<string, string>)['--qv-tab-width'] = `${nextWidth}px`;
      }
    }
    return nextWidth;
  }

  /**
   * Dynamically position the in-flow `+` button without triggering idle layer churn or hover flicker.
   */
  syncNewTabButtonPosition(instant = false): void {
    const binding = this.layoutBinding;
    if (!binding) return;

    const { tabStrip, addTabBtn } = binding;
    const session =
      this.activeSession && this.activeSession.tabStrip === tabStrip
        ? this.activeSession
        : null;

    const isDetachedState =
      this.state === 'DETACH_PREVIEW' || this.state === 'DRAGGING_OVER_TARGET';

    if (session && isDetachedState && session.baseSlots.length <= 1) {
      if (!addTabBtn.classList.contains('is-hidden-during-drag')) {
        addTabBtn.classList.add('is-hidden-during-drag');
      }
      return;
    }
    addTabBtn.classList.remove('is-hidden-during-drag');

    const isOverflowing = tabStrip.scrollWidth > tabStrip.clientWidth + 1;
    let deltaX = 0;

    if (
      session &&
      session.baseSlots.length > 0 &&
      isDetachedState
    ) {
      const draggedSlot = session.baseSlots[session.sourceBaseIndex];
      deltaX = isOverflowing
        ? 0
        : -Math.round((draggedSlot?.width ?? 0) + session.gapPx);
    }

    if (deltaX === this.lastAppliedAddDelta) {
      return;
    }
    this.lastAppliedAddDelta = deltaX;

    if (deltaX === 0) {
      addTabBtn.classList.remove('is-instant');
      addTabBtn.style.transform = '';
      return;
    }

    if (instant) {
      addTabBtn.classList.add('is-instant');
    } else {
      addTabBtn.classList.remove('is-instant');
    }

    addTabBtn.style.transform = `translate3d(${deltaX}px, 0, 0)`;
    if (instant) {
      void addTabBtn.offsetWidth;
      addTabBtn.classList.remove('is-instant');
    }
  }

  cancelActiveDrag(removedTabId?: string): void {
    const session = this.activeSession;
    if (!session) {
      this.state = 'IDLE';
      this.syncUniformTabWidths();
      this.syncNewTabButtonPosition(true);
      return;
    }

    if (session.hoverTargetWin) {
      this.callbacks.onLeaveTargetWindow?.(session.hoverTargetWin.label);
      session.hoverTargetWin = null;
    }

    this.cancelLiveDetachedWindow(session);

    const wasDragging =
      this.state === 'DRAGGING' ||
      this.state === 'DETACH_PREVIEW' ||
      this.state === 'DRAGGING_OVER_TARGET';
    this.state = 'CANCELLED';
    this.teardownSessionVisuals(session);

    if (wasDragging) {
      const restored = removedTabId
        ? session.originalTabIds.filter((id) => id !== removedTabId)
        : [...session.originalTabIds];
      this.callbacks.onOrderChange(restored);
      this.callbacks.onCancel?.(restored);
    }

    this.state = 'IDLE';
    this.syncUniformTabWidths();
    this.syncNewTabButtonPosition(true);
  }

  handleTabRemoved(tabId: string): void {
    if (this.activeSession && this.activeSession.sourceTabId === tabId) {
      this.cancelActiveDrag(tabId);
    } else {
      this.syncUniformTabWidths();
      this.syncNewTabButtonPosition(false);
    }
  }

  attachTab(
    tabEl: HTMLElement,
    tabStrip: HTMLElement,
    desktopTabBarEl: HTMLElement,
    options: {
      tabId: string;
      tabTitle: string;
    },
  ): () => void {
    const prevUnbind = this.tabBindings.get(tabEl);
    if (prevUnbind) {
      prevUnbind();
      this.tabBindings.delete(tabEl);
    }

    const { tabId, tabTitle } = options;
    tabEl.setAttribute('draggable', 'false');

    const onDragStart = (ev: DragEvent) => {
      ev.preventDefault();
    };

    const onPointerDown = (downEv: PointerEvent) => {
      if (downEv.button !== 0 || !downEv.isPrimary) return;
      if ((downEv.target as HTMLElement | null)?.closest('.qv-tab-close')) return;
      downEv.preventDefault?.();
      if (this.state !== 'IDLE') {
        this.cancelActiveDrag();
      }

      const tabRect = tabEl.getBoundingClientRect();
      const barRect = desktopTabBarEl.getBoundingClientRect();
      const grabOffsetX =
        tabRect.width > 0
          ? Math.max(8, Math.min(tabRect.width - 8, downEv.clientX - tabRect.left))
          : 40;
      const grabOffsetY =
        tabRect.height > 0
          ? Math.max(6, Math.min(tabRect.height - 6, downEv.clientY - tabRect.top))
          : 14;

      const originalIds = [...this.callbacks.getTabIds()];

      const liveTabTitle = tabEl.dataset.tabTitle?.trim() || tabTitle;

      const session: ActiveDragSession = {
        pointerId: downEv.pointerId,
        sourceTabId: tabId,
        tabTitle: liveTabTitle,
        tabEl,
        tabStrip,
        desktopTabBarEl,
        startClientX: downEv.clientX,
        startClientY: downEv.clientY,
        lastClientX: downEv.clientX,
        lastClientY: downEv.clientY,
        lastScreenX: downEv.screenX,
        lastScreenY: downEv.screenY,
        dragAnchorClientX: downEv.clientX,
        dragAnchorScrollLeft: tabStrip.scrollLeft,
        initialTabWidth: tabRect.width > 0 ? Math.round(tabRect.width) : 0,
        grabOffsetX,
        grabOffsetY,
        tabLeftInWindow: Math.max(0, tabRect.left),
        barRect,
        originalTabIds: originalIds,
        hasPointerCapture: false,
        ghostEl: null,
        cachedWindows: [],
        boundsLoaded: false,
        hoverTargetWin: null,
        hoverInsertionIndex: 0,
        liveDetachedWindowLabel: null,
        liveDetachSpawning: false,
        liveDetachCancelled: false,
        liveDetachSpawnPromise: null,
        baseSlots: [],
        gapPx: DEFAULT_TAB_GAP_PX,
        totalContentWidth: 0,
        availableExtraRightPx: 0,
        sourceBaseIndex: 0,
        currentTargetIndex: 0,
        currentOrder: originalIds,
        lastClampedDx: 0,
        cleanupListeners: () => {},
      };

      const onPointerMove = (moveEv: PointerEvent) => {
        if (moveEv.pointerId !== session.pointerId || this.activeSession !== session) {
          return;
        }
        this.handlePointerMove(session, moveEv);
      };

      const onPointerUp = (upEv: PointerEvent) => {
        if (upEv.pointerId !== session.pointerId || this.activeSession !== session) {
          return;
        }
        this.handlePointerUp(session, upEv);
      };

      const onPointerCancel = (cancelEv: PointerEvent) => {
        if (
          cancelEv.pointerId !== session.pointerId ||
          this.activeSession !== session
        ) {
          return;
        }
        this.cancelActiveDrag();
      };

      const onLostPointerCapture = (capEv: PointerEvent) => {
        if (
          capEv.pointerId !== session.pointerId ||
          this.activeSession !== session
        ) {
          return;
        }
        // Keep dragging cleanly via window pointermove/pointerup even if native capture drops during window movement
        session.hasPointerCapture = false;
      };

      const onWindowBlur = () => {
        if (this.activeSession === session && (this.state === 'PENDING' || this.state === 'DRAGGING')) {
          this.cancelActiveDrag();
        }
      };

      const onKeyDown = (keyEv: KeyboardEvent) => {
        if (keyEv.key === 'Escape' && this.activeSession === session) {
          keyEv.preventDefault();
          this.cancelActiveDrag();
        }
      };

      session.cleanupListeners = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        window.removeEventListener('blur', onWindowBlur);
        window.removeEventListener('keydown', onKeyDown);
        tabEl.removeEventListener('lostpointercapture', onLostPointerCapture);
      };

      this.activeSession = session;
      this.state = 'PENDING';

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
      window.addEventListener('blur', onWindowBlur);
      window.addEventListener('keydown', onKeyDown);
      tabEl.addEventListener('lostpointercapture', onLostPointerCapture);
    };

    tabEl.addEventListener('dragstart', onDragStart);
    tabEl.addEventListener('pointerdown', onPointerDown);

    const unbind = () => {
      tabEl.removeEventListener('dragstart', onDragStart);
      tabEl.removeEventListener('pointerdown', onPointerDown);
      if (this.activeSession?.tabEl === tabEl) {
        this.cancelActiveDrag();
      }
    };
    this.tabBindings.set(tabEl, unbind);
    return unbind;
  }

  private clearAllTabTransforms(session: ActiveDragSession): void {
    session.tabStrip.classList.remove('is-drag-unclipped');
    const allTabs = Array.from(session.tabStrip.querySelectorAll<HTMLElement>('.qv-book-tab'));
    for (const tab of allTabs) {
      tab.classList.remove('is-dragging', 'is-drag-sibling');
      tab.style.transform = '';
      tab.style.transition = '';
      tab.style.width = '';
      tab.style.visibility = '';
      tab.style.opacity = '';
    }
  }

  private teardownSessionVisuals(session: ActiveDragSession): void {
    session.cleanupListeners();

    if (session.hasPointerCapture) {
      session.hasPointerCapture = false;
      try {
        session.tabEl.releasePointerCapture(session.pointerId);
      } catch {
        // Ignore if capture already released or unsupported
      }
    }

    if (this.edgeScrollRafId !== null) {
      window.cancelAnimationFrame(this.edgeScrollRafId);
      this.edgeScrollRafId = null;
    }
    if (this.moveRafId !== null) {
      window.cancelAnimationFrame(this.moveRafId);
      this.moveRafId = null;
    }
    this.pendingMovePos = null;

    if (session.ghostEl) {
      session.ghostEl.remove();
      session.ghostEl = null;
    }

    this.clearAllTabTransforms(session);
    this.layoutBinding?.addTabBtn.classList.remove('is-hidden-during-drag');
    document.body?.classList.remove('is-tab-dragging');
    this.activeSession = null;
  }

  private refreshOtherWindows(session: ActiveDragSession): void {
    if (session.boundsLoaded) return;
    session.boundsLoaded = true;
    void listDesktopWindowBounds().then((bounds) => {
      if (this.activeSession !== session) return;
      const myLabel = this.callbacks.getWindowLabel();
      session.cachedWindows = bounds.filter((b) => b.label !== myLabel);
    });
  }

  private ensureGhost(session: ActiveDragSession): HTMLElement {
    if (session.ghostEl) return session.ghostEl;
    const g = document.createElement('div');
    g.className = 'qv-tab-drag-ghost';
    g.id = 'qv-tab-drag-ghost';
    if (session.initialTabWidth > 0) {
      g.style.width = `${Math.max(150, session.initialTabWidth)}px`;
    }
    const strong = document.createElement('strong');
    strong.textContent = session.tabTitle;
    const hint = document.createElement('span');
    hint.className = 'qv-tab-drag-hint';
    hint.textContent =
      this.callbacks.getTabIds().length <= 1
        ? 'Moving window — drag over another tab strip to combine'
        : 'Release to open in new window';
    g.append(strong, hint);
    document.body.appendChild(g);
    session.ghostEl = g;
    this.refreshOtherWindows(session);
    return g;
  }

  private removeGhost(session: ActiveDragSession): void {
    if (session.ghostEl) {
      session.ghostEl.remove();
      session.ghostEl = null;
    }
  }

  private hitTestOtherWindowTabStrip(
    session: ActiveDragSession,
    screenX: number,
    screenY: number,
  ): { target: DesktopWindowBounds; insertionIndex: number } | null {
    for (const win of session.cachedWindows) {
      if (win.label === session.liveDetachedWindowLabel) continue;
      const inX = screenX >= win.x && screenX <= win.x + win.width;
      const inStripY = screenY >= win.y - 12 && screenY <= win.y + TARGET_STRIP_HEIGHT_PX;
      if (inX && inStripY) {
        const metrics = this.callbacks.getTargetWindowStripMetrics?.(win.label);
        const stripOffsetX = metrics?.stripLeftOffsetPx ?? APPROX_STRIP_LEFT_OFFSET_PX;
        const tabW = metrics?.tabWidthPx && metrics.tabWidthPx > 20 ? metrics.tabWidthPx : APPROX_TAB_WIDTH_PX;
        const relX = Math.max(0, screenX - win.x - stripOffsetX);
        const rawIndex = Math.max(0, Math.round(relX / (tabW + DEFAULT_TAB_GAP_PX)));
        const maxIndex = typeof metrics?.tabCount === 'number' && metrics.tabCount > 0 ? metrics.tabCount : rawIndex;
        return { target: win, insertionIndex: Math.min(rawIndex, maxIndex) };
      }
    }
    return null;
  }

  private captureBaseSlots(session: ActiveDragSession): void {
    const stripRect = session.tabStrip.getBoundingClientRect();
    const tabs = Array.from(session.tabStrip.querySelectorAll<HTMLElement>('.qv-book-tab'));
    const slots: TabSlotSnapshot[] = tabs.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tabId: el.dataset.tabId ?? '',
        el,
        baseLeft: rect.left - stripRect.left + session.tabStrip.scrollLeft,
        width: rect.width > 0 ? rect.width : 140,
      };
    });

    session.baseSlots = slots;
    session.gapPx =
      slots.length >= 2
        ? Math.max(0, slots[1].baseLeft - (slots[0].baseLeft + slots[0].width))
        : DEFAULT_TAB_GAP_PX;
    session.totalContentWidth =
      slots.length > 0
        ? slots[slots.length - 1].baseLeft + slots[slots.length - 1].width - slots[0].baseLeft
        : 0;

    const isOverflowing = session.tabStrip.scrollWidth > session.tabStrip.clientWidth + 1;
    const spacerEl = session.desktopTabBarEl.querySelector('.qv-tabbar-spacer') as HTMLElement | null;
    const spacerW = spacerEl ? spacerEl.getBoundingClientRect().width : null;
    const barRect = session.desktopTabBarEl.getBoundingClientRect();
    session.availableExtraRightPx = isOverflowing
      ? 0
      : spacerW !== null && spacerW > 0
        ? Math.max(0, Math.round(spacerW - 8))
        : Math.max(48, Math.round(barRect.right - stripRect.right - 160));

    const foundIdx = slots.findIndex((s) => s.el === session.tabEl);
    session.sourceBaseIndex = foundIdx >= 0 ? foundIdx : 0;
    session.currentTargetIndex = session.sourceBaseIndex;
    session.currentOrder = slots.map((s) => s.tabId).filter((id) => id.length > 0);
    session.lastClampedDx = 0;

    if (!isOverflowing) {
      session.tabStrip.classList.add('is-drag-unclipped');
    }

    for (const slot of slots) {
      if (slot.el !== session.tabEl) {
        slot.el.classList.add('is-drag-sibling');
      }
    }
  }

  private buildCandidateSequence(session: ActiveDragSession, targetIndex: number): TabSlotSnapshot[] {
    const draggedSlot = session.baseSlots[session.sourceBaseIndex];
    const others = session.baseSlots.filter((s) => s.el !== session.tabEl);
    if (!draggedSlot) return others;
    const clampedIdx = Math.max(0, Math.min(others.length, targetIndex));
    const seq = [...others];
    seq.splice(clampedIdx, 0, draggedSlot);
    return seq;
  }

  private applySiblingSlotTransforms(session: ActiveDragSession, collapsedGap = false): void {
    const startX = session.baseSlots[0]?.baseLeft ?? 0;
    const seq = collapsedGap
      ? session.baseSlots.filter((s) => s.el !== session.tabEl)
      : this.buildCandidateSequence(session, session.currentTargetIndex);

    let cursor = startX;
    for (const slot of seq) {
      if (slot.el !== session.tabEl) {
        const shift = cursor - slot.baseLeft;
        slot.el.style.transform =
          Math.abs(shift) < 0.5 ? '' : `translate3d(${Math.round(shift)}px, 0, 0)`;
      }
      cursor += slot.width + session.gapPx;
    }
  }

  private computeDraggedDx(session: ActiveDragSession, clientX: number): { rawDx: number; clampedDx: number } {
    const draggedSlot = session.baseSlots[session.sourceBaseIndex];
    const scrollDelta = session.tabStrip.scrollLeft - session.dragAnchorScrollLeft;
    const rawDx = clientX - session.dragAnchorClientX + scrollDelta;
    if (!draggedSlot || session.baseSlots.length === 0) {
      return { rawDx, clampedDx: rawDx };
    }

    const firstLeft = session.baseSlots[0].baseLeft;
    const minDx = firstLeft - draggedSlot.baseLeft;
    // Lock horizontal drag strictly within [firstLeft, totalContentWidth - width] so tabs never slide past `+`
    const maxRightLeft = Math.max(
      firstLeft,
      firstLeft + session.totalContentWidth - draggedSlot.width,
    );
    const maxDx = maxRightLeft - draggedSlot.baseLeft;
    return {
      rawDx,
      clampedDx: Math.max(minDx, Math.min(maxDx, rawDx)),
    };
  }

  private computeTargetIndex(session: ActiveDragSession, effectiveDx: number): number {
    const draggedSlot = session.baseSlots[session.sourceBaseIndex];
    if (!draggedSlot) return 0;

    const draggedCenterX = draggedSlot.baseLeft + effectiveDx + draggedSlot.width / 2;
    const currentSeq = this.buildCandidateSequence(session, session.currentTargetIndex);
    const startX = session.baseSlots[0]?.baseLeft ?? 0;

    let cursor = startX;
    let passedCount = 0;
    let seenDragged = false;

    for (const slot of currentSeq) {
      if (slot.el === session.tabEl) {
        seenDragged = true;
        cursor += slot.width + session.gapPx;
        continue;
      }
      const sibMid = cursor + slot.width / 2;
      if (seenDragged) {
        if (draggedCenterX > sibMid + SLOT_SWITCH_HYSTERESIS_PX) passedCount += 1;
      } else if (draggedCenterX >= sibMid - SLOT_SWITCH_HYSTERESIS_PX) {
        passedCount += 1;
      }
      cursor += slot.width + session.gapPx;
    }

    return passedCount;
  }

  private reorderInStrip(session: ActiveDragSession, clientX: number): void {
    if (session.baseSlots.length === 0) {
      this.captureBaseSlots(session);
    }

    const { rawDx, clampedDx } = this.computeDraggedDx(session, clientX);
    session.lastClampedDx = clampedDx;
    session.tabEl.style.transform = `translate3d(${Math.round(clampedDx)}px, 0, 0)`;

    const nextTargetIndex = this.computeTargetIndex(session, rawDx);
    if (nextTargetIndex !== session.currentTargetIndex) {
      session.currentTargetIndex = nextTargetIndex;
      this.applySiblingSlotTransforms(session, false);

      const nextSeq = this.buildCandidateSequence(session, nextTargetIndex);
      const nextOrder = nextSeq.map((s) => s.tabId).filter((id) => id.length > 0);
      if (!arraysEqual(nextOrder, session.currentOrder)) {
        session.currentOrder = nextOrder;
        this.callbacks.onOrderChange(nextOrder);
      }
    }

    this.syncNewTabButtonPosition(true);
  }

  private commitFinalDomOrder(session: ActiveDragSession): void {
    const byId = new Map<string, HTMLElement>();
    for (const s of session.baseSlots) {
      if (s.tabId) byId.set(s.tabId, s.el);
    }
    for (const id of session.currentOrder) {
      const node = byId.get(id);
      if (node && (!node.parentNode || node.parentNode === session.tabStrip)) {
        session.tabStrip.insertBefore(node, null);
      }
    }
  }

  private getEdgeScrollDelta(session: ActiveDragSession): number {
    const strip = session.tabStrip;
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    if (maxScroll <= 1) return 0;

    const stripRect = strip.getBoundingClientRect();
    const zone = this.config.edgeScrollZonePx;
    if (session.lastClientX < stripRect.left + zone && strip.scrollLeft > 0) {
      const ratio = Math.min(1, Math.max(0.15, (stripRect.left + zone - session.lastClientX) / zone));
      return -Math.ceil(ratio * this.config.edgeScrollMaxPxPerFrame);
    }
    if (session.lastClientX > stripRect.right - zone && strip.scrollLeft < maxScroll) {
      const ratio = Math.min(1, Math.max(0.15, (session.lastClientX - (stripRect.right - zone)) / zone));
      return Math.ceil(ratio * this.config.edgeScrollMaxPxPerFrame);
    }
    return 0;
  }

  private syncEdgeAutoScroll(session: ActiveDragSession): void {
    const delta = this.getEdgeScrollDelta(session);
    if (delta === 0) {
      if (this.edgeScrollRafId !== null) {
        window.cancelAnimationFrame(this.edgeScrollRafId);
        this.edgeScrollRafId = null;
      }
      return;
    }

    if (this.edgeScrollRafId !== null) return;
    const tick = () => {
      this.edgeScrollRafId = null;
      if (this.activeSession !== session || this.state !== 'DRAGGING') return;
      const stepDelta = this.getEdgeScrollDelta(session);
      if (stepDelta === 0) return;

      const prevScroll = session.tabStrip.scrollLeft;
      session.tabStrip.scrollLeft += stepDelta;
      if (session.tabStrip.scrollLeft !== prevScroll) {
        this.reorderInStrip(session, session.lastClientX);
      }
      this.edgeScrollRafId = window.requestAnimationFrame(tick);
    };
    this.edgeScrollRafId = window.requestAnimationFrame(tick);
  }

  private cancelLiveDetachedWindow(session: ActiveDragSession): void {
    session.liveDetachCancelled = true;
    const label = session.liveDetachedWindowLabel;
    session.liveDetachedWindowLabel = null;
    session.liveDetachSpawning = false;
    session.liveDetachSpawnPromise = null;
    if (label) {
      this.callbacks.onLiveDetachCancel?.(label);
    }
  }

  private startLiveDetachSpawn(session: ActiveDragSession, screenX: number, screenY: number): void {
    if (!this.callbacks.onLiveDetachSpawn || session.liveDetachSpawning || session.liveDetachedWindowLabel) {
      return;
    }
    session.liveDetachCancelled = false;
    session.liveDetachSpawning = true;
    const x = screenX - session.tabLeftInWindow - session.grabOffsetX;
    const y = screenY - session.grabOffsetY;
    const spawnPromise = this.callbacks
      .onLiveDetachSpawn(session.sourceTabId, session.tabTitle, x, y)
      .then((label) => {
        session.liveDetachSpawning = false;
        if (!label) return null;
        if (session.liveDetachCancelled) {
          this.callbacks.onLiveDetachCancel?.(label);
          return null;
        }
        session.liveDetachedWindowLabel = label;
        void moveDesktopWindow(
          session.lastScreenX - session.tabLeftInWindow - session.grabOffsetX,
          session.lastScreenY - session.grabOffsetY,
          label,
        );
        return label;
      })
      .catch(() => {
        session.liveDetachSpawning = false;
        return null;
      });
    session.liveDetachSpawnPromise = spawnPromise;
  }

  private scheduleWindowMove(
    targetLabel: string,
    screenX: number,
    screenY: number,
    session: ActiveDragSession,
  ): void {
    this.pendingMovePos = {
      label: targetLabel,
      x: screenX - session.tabLeftInWindow - session.grabOffsetX,
      y: screenY - session.grabOffsetY,
    };
    if (this.moveRafId !== null) return;
    this.moveRafId = window.requestAnimationFrame(() => {
      this.moveRafId = null;
      if (this.pendingMovePos && this.activeSession === session) {
        void moveDesktopWindow(
          this.pendingMovePos.x,
          this.pendingMovePos.y,
          this.pendingMovePos.label,
        );
        this.pendingMovePos = null;
      }
    });
  }

  private handlePointerMove(session: ActiveDragSession, ev: PointerEvent): void {
    session.lastClientX = ev.clientX;
    session.lastClientY = ev.clientY;
    session.lastScreenX = ev.screenX;
    session.lastScreenY = ev.screenY;

    if (this.state === 'PENDING') {
      const dx = ev.clientX - session.startClientX;
      const dy = ev.clientY - session.startClientY;
      if (Math.hypot(dx, dy) < this.config.dragThresholdPx) return;

      try {
        session.tabEl.setPointerCapture(session.pointerId);
        session.hasPointerCapture = true;
      } catch {
        session.hasPointerCapture = false;
      }

      this.state = 'DRAGGING';
      document.body?.classList.add('is-tab-dragging');
      this.captureBaseSlots(session);
      session.tabEl.classList.add('is-dragging');
      if (session.initialTabWidth > 0) {
        session.tabEl.style.width = `${session.initialTabWidth}px`;
      }
      this.refreshOtherWindows(session);
    }

    const outsideVertically =
      ev.clientY > session.barRect.bottom + this.config.detachThresholdPx ||
      ev.clientY < session.barRect.top - this.config.detachThresholdPx;
    const isSoleTab = this.callbacks.getTabIds().length <= 1;

    if (outsideVertically || isSoleTab) {
      if (this.state !== 'DETACH_PREVIEW' && this.state !== 'DRAGGING_OVER_TARGET') {
        this.state = 'DETACH_PREVIEW';
        session.tabEl.style.transform = '';
        if (!isSoleTab) {
          session.tabEl.style.visibility = 'hidden';
          session.tabEl.style.opacity = '0';
        }
        if (this.edgeScrollRafId !== null) {
          window.cancelAnimationFrame(this.edgeScrollRafId);
          this.edgeScrollRafId = null;
        }
        this.applySiblingSlotTransforms(session, true);
        this.syncNewTabButtonPosition(false);
        this.refreshOtherWindows(session);
      }

      if (!isSoleTab && this.callbacks.onLiveDetachSpawn && !session.liveDetachedWindowLabel && !session.liveDetachSpawning) {
        this.startLiveDetachSpawn(session, ev.screenX, ev.screenY);
      }

      const prevHoverWin = session.hoverTargetWin;
      const prevInsertionIndex = session.hoverInsertionIndex;
      const hit = this.hitTestOtherWindowTabStrip(session, ev.screenX, ev.screenY);
      session.hoverTargetWin = hit?.target ?? null;
      session.hoverInsertionIndex = hit?.insertionIndex ?? 0;

      if (hit && this.callbacks.immediateMergeOnTargetHover) {
        if (prevHoverWin) {
          this.callbacks.onLeaveTargetWindow?.(prevHoverWin.label);
        }
        this.cancelLiveDetachedWindow(session);
        const targetLabel = hit.target.label;
        const insertionIndex = hit.insertionIndex;
        const sourceTabId = session.sourceTabId;
        this.state = 'DROP_PENDING';
        this.teardownSessionVisuals(session);
        this.state = 'IDLE';
        this.syncUniformTabWidths();
        this.syncNewTabButtonPosition(true);
        this.callbacks.onMergeIntoWindow(targetLabel, sourceTabId, insertionIndex);
        return;
      }

      if (prevHoverWin && (!hit || hit.target.label !== prevHoverWin.label)) {
        this.callbacks.onLeaveTargetWindow?.(prevHoverWin.label);
      }

      if (session.hoverTargetWin) {
        this.state = 'DRAGGING_OVER_TARGET';
        if (
          !prevHoverWin ||
          prevHoverWin.label !== session.hoverTargetWin.label ||
          prevInsertionIndex !== session.hoverInsertionIndex
        ) {
          this.callbacks.onHoverTargetWindow?.(
            session.hoverTargetWin.label,
            session.hoverInsertionIndex,
            session.tabTitle,
          );
        }
      } else {
        this.state = 'DETACH_PREVIEW';
      }

      if (isSoleTab) {
        this.scheduleWindowMove(this.callbacks.getWindowLabel(), ev.screenX, ev.screenY, session);
      } else if (session.liveDetachedWindowLabel) {
        this.scheduleWindowMove(session.liveDetachedWindowLabel, ev.screenX, ev.screenY, session);
      }

      const usingLiveWindow =
        Boolean(this.callbacks.onLiveDetachSpawn) ||
        (isSoleTab && Boolean(this.callbacks.immediateMergeOnTargetHover));
      if (!usingLiveWindow) {
        const g = this.ensureGhost(session);
        g.style.left = `${Math.round(ev.clientX - session.grabOffsetX)}px`;
        g.style.top = `${Math.round(ev.clientY - session.grabOffsetY)}px`;
        g.classList.toggle('is-combine', Boolean(session.hoverTargetWin));
        const hint = g.querySelector('.qv-tab-drag-hint');
        if (hint) {
          hint.textContent = session.hoverTargetWin
            ? 'Release to combine into target tab strip'
            : isSoleTab
              ? 'Moving window — drag over another tab strip to combine'
              : 'Release to open in new window';
        }
      } else {
        this.removeGhost(session);
      }
      return;
    }

    if (
      (this.state === 'DETACH_PREVIEW' || this.state === 'DRAGGING_OVER_TARGET') &&
      !outsideVertically &&
      !isSoleTab
    ) {
      if (session.hoverTargetWin) {
        this.callbacks.onLeaveTargetWindow?.(session.hoverTargetWin.label);
        session.hoverTargetWin = null;
      }
      this.cancelLiveDetachedWindow(session);
      session.tabEl.style.visibility = '';
      session.tabEl.style.opacity = '';
      this.state = 'DRAGGING';
      this.removeGhost(session);
      this.applySiblingSlotTransforms(session, false);
    }

    if (this.state === 'DRAGGING') {
      this.reorderInStrip(session, ev.clientX);
      this.syncEdgeAutoScroll(session);
    }
  }

  private handlePointerUp(session: ActiveDragSession, ev: PointerEvent): void {
    const prevState = this.state;
    const targetWin = session.hoverTargetWin;
    const insertionIndex = session.hoverInsertionIndex;
    const grabOffsetX = session.grabOffsetX;
    const grabOffsetY = session.grabOffsetY;
    const originalIds = session.originalTabIds;
    const sourceTabId = session.sourceTabId;
    const tabTitle = session.tabTitle;
    const liveWindowLabel = session.liveDetachedWindowLabel;
    const liveSpawnPromise = session.liveDetachSpawnPromise;

    if (targetWin) {
      this.callbacks.onLeaveTargetWindow?.(targetWin.label);
      session.hoverTargetWin = null;
    }

    if (prevState === 'PENDING') {
      this.cancelLiveDetachedWindow(session);
      this.teardownSessionVisuals(session);
      this.state = 'IDLE';
      if (sourceTabId !== this.callbacks.getActiveTabId()) {
        this.callbacks.onActivateTab(sourceTabId);
      }
      return;
    }

    const wasDetached = prevState === 'DETACH_PREVIEW' || prevState === 'DRAGGING_OVER_TARGET';
    if (prevState !== 'DRAGGING' && !wasDetached) {
      this.cancelLiveDetachedWindow(session);
      this.teardownSessionVisuals(session);
      this.state = 'IDLE';
      return;
    }

    this.state = 'DROP_PENDING';
    this.teardownSessionVisuals(session);
    this.state = 'IDLE';
    this.syncUniformTabWidths();
    this.syncNewTabButtonPosition(true);

    if (wasDetached) {
      if (targetWin) {
        session.liveDetachCancelled = true;
        if (liveWindowLabel) {
          this.callbacks.onLiveDetachCancel?.(liveWindowLabel);
        }
        this.callbacks.onMergeIntoWindow(targetWin.label, sourceTabId, insertionIndex);
        return;
      }
      if (this.callbacks.getTabIds().length > 1) {
        if (liveWindowLabel && this.callbacks.onLiveDetachCommit) {
          this.callbacks.onLiveDetachCommit(liveWindowLabel, sourceTabId);
          return;
        }
        if (liveSpawnPromise) {
          void liveSpawnPromise.then((resolvedLabel) => {
            if (resolvedLabel && this.callbacks.onLiveDetachCommit) {
              this.callbacks.onLiveDetachCommit(resolvedLabel, sourceTabId);
            } else {
              this.callbacks.onDetachToNewWindow(
                sourceTabId,
                tabTitle,
                ev.screenX - grabOffsetX,
                ev.screenY - grabOffsetY,
              );
            }
          });
          return;
        }
        this.callbacks.onDetachToNewWindow(
          sourceTabId,
          tabTitle,
          ev.screenX - grabOffsetX,
          ev.screenY - grabOffsetY,
        );
        return;
      }
    }

    this.cancelLiveDetachedWindow(session);
    this.commitFinalDomOrder(session);
    const orderChanged = !arraysEqual(originalIds, this.callbacks.getTabIds());
    this.callbacks.onFinishInStrip(orderChanged);
    this.syncUniformTabWidths();
    this.syncNewTabButtonPosition(true);
  }
}
