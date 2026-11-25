import {
  listDesktopWindowBounds,
  moveDesktopWindow,
  type DesktopWindowBounds,
} from './bridge';
import { isSpecialPageTabId } from './window-sync';

export type TabDragState = 'IDLE' | 'DRAGGING_IN_STRIP' | 'DRAGGING_WINDOW';

export interface TabDragCallbacks {
  getWindowLabel: () => string;
  getTabIds: () => string[];
  setTabIds: (nextIds: string[]) => void;
  onActivateTab: (tabId: string) => void;
  onFinishInStrip: () => void;
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
}

const DRAG_START_PX = 6;
const DETACH_THRESHOLD_PX = 32;
const TARGET_STRIP_HEIGHT_PX = 52;
const APPROX_TAB_WIDTH_PX = 160;
const APPROX_STRIP_LEFT_OFFSET_PX = 44;

/**
 * Central state machine coordinating browser-style tab reordering,
 * vertical tear-off detachment, sole-tab window dragging, and cross-window merging.
 */
export class TabDragController {
  private state: TabDragState = 'IDLE';
  private callbacks: TabDragCallbacks;
  private moveRafId: number | null = null;
  private pendingMovePos: { x: number; y: number } | null = null;

  constructor(callbacks: TabDragCallbacks) {
    this.callbacks = callbacks;
  }

  getState(): TabDragState {
    return this.state;
  }

  attachTab(
    tabEl: HTMLElement,
    tabStrip: HTMLElement,
    desktopTabBarEl: HTMLElement,
    options: {
      tabId: string;
      tabTitle: string;
      isActive: boolean;
    },
  ): void {
    const { tabId, tabTitle, isActive } = options;

    tabEl.addEventListener('pointerdown', (downEv) => {
      if (downEv.button !== 0) return;
      if ((downEv.target as HTMLElement | null)?.closest('.qv-tab-close')) return;

      const tabRect = tabEl.getBoundingClientRect();
      const barRect = desktopTabBarEl.getBoundingClientRect();
      const startClientX = downEv.clientX;
      const startClientY = downEv.clientY;
      // Preserve where on the tab the user grabbed so detach/merge stays anchored
      const grabOffsetX = Math.max(8, Math.min(tabRect.width - 8, downEv.clientX - tabRect.left));
      const grabOffsetY = Math.max(6, Math.min(tabRect.height - 6, downEv.clientY - tabRect.top));
      const tabLeftInWindow = Math.max(0, tabRect.left);

      let draggingStarted = false;
      let ghostEl: HTMLElement | null = null;
      let cachedWindows: DesktopWindowBounds[] = [];
      let boundsLoaded = false;
      let hoverTargetWin: DesktopWindowBounds | null = null;
      let hoverInsertionIndex = 0;

      try {
        tabEl.setPointerCapture(downEv.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable in synthetic tests
      }

      const refreshOtherWindows = () => {
        if (boundsLoaded) return;
        boundsLoaded = true;
        void listDesktopWindowBounds().then((bounds) => {
          const myLabel = this.callbacks.getWindowLabel();
          cachedWindows = bounds.filter((b) => b.label !== myLabel);
        });
      };

      const ensureGhost = (): HTMLElement => {
        if (ghostEl) return ghostEl;
        const g = document.createElement('div');
        g.className = 'qv-tab-drag-ghost';
        g.id = 'qv-tab-drag-ghost';
        const strong = document.createElement('strong');
        strong.textContent = tabTitle;
        const hint = document.createElement('span');
        hint.className = 'qv-tab-drag-hint';
        hint.textContent =
          this.callbacks.getTabIds().length <= 1
            ? 'Drag onto another window tab strip to combine'
            : 'Release to open in new window';
        g.append(strong, hint);
        document.body.appendChild(g);
        ghostEl = g;
        refreshOtherWindows();
        return g;
      };

      const removeGhost = () => {
        if (ghostEl) {
          ghostEl.remove();
          ghostEl = null;
        }
      };

      const hitTestOtherWindowTabStrip = (
        screenX: number,
        screenY: number,
      ): { target: DesktopWindowBounds; insertionIndex: number } | null => {
        // cachedWindows comes from host window enumeration in stack/z order
        for (const win of cachedWindows) {
          const inX = screenX >= win.x && screenX <= win.x + win.width;
          const inStripY = screenY >= win.y - 12 && screenY <= win.y + TARGET_STRIP_HEIGHT_PX;
          if (inX && inStripY) {
            const relX = Math.max(0, screenX - win.x - APPROX_STRIP_LEFT_OFFSET_PX);
            const insertionIndex = Math.max(0, Math.round(relX / APPROX_TAB_WIDTH_PX));
            return { target: win, insertionIndex };
          }
        }
        return null;
      };

      const animateNeighborFlip = (
        prevLefts: Map<string, number>,
        movedTabEl: HTMLElement,
      ) => {
        const children = Array.from(tabStrip.querySelectorAll<HTMLElement>('.qv-book-tab'));
        for (const sib of children) {
          if (sib === movedTabEl) continue;
          const sibId = sib.dataset.tabId;
          if (!sibId) continue;
          const prevLeft = prevLefts.get(sibId);
          if (prevLeft === undefined) continue;
          const nextLeft = sib.getBoundingClientRect().left;
          const delta = prevLeft - nextLeft;
          if (Math.abs(delta) < 1) continue;
          sib.style.transition = 'none';
          sib.style.transform = `translateX(${Math.round(delta)}px)`;
          void sib.offsetWidth;
          sib.style.transition = 'transform 160ms cubic-bezier(0.2, 0.9, 0.2, 1)';
          sib.style.transform = '';
        }
      };

      const reorderInStrip = (ev: PointerEvent) => {
        const dx = ev.clientX - startClientX;
        tabEl.style.transform = `translateX(${Math.round(dx)}px)`;
        const siblings = Array.from(tabStrip.querySelectorAll<HTMLElement>('.qv-book-tab'));
        const ids = this.callbacks.getTabIds();
        const curIdx = ids.indexOf(tabId);
        if (curIdx === -1) return;

        for (let i = 0; i < siblings.length; i++) {
          const sibId = siblings[i].dataset.tabId;
          if (!sibId || sibId === tabId) continue;
          const r = siblings[i].getBoundingClientRect();
          const mid = r.left + r.width / 2;
          if ((i > curIdx && ev.clientX > mid) || (i < curIdx && ev.clientX < mid)) {
            const prevLefts = new Map<string, number>();
            for (const s of siblings) {
              if (s.dataset.tabId) prevLefts.set(s.dataset.tabId, s.getBoundingClientRect().left);
            }
            const next = [...ids];
            next.splice(curIdx, 1);
            next.splice(i, 0, tabId);
            this.callbacks.setTabIds(next);
            if (i > curIdx) {
              tabStrip.insertBefore(tabEl, siblings[i].nextSibling);
            } else {
              tabStrip.insertBefore(tabEl, siblings[i]);
            }
            tabEl.style.transform = '';
            animateNeighborFlip(prevLefts, tabEl);
            break;
          }
        }
      };

      const scheduleSoleWindowMove = (screenX: number, screenY: number) => {
        this.pendingMovePos = {
          x: Math.max(0, screenX - tabLeftInWindow - grabOffsetX),
          y: Math.max(0, screenY - grabOffsetY),
        };
        if (this.moveRafId !== null) return;
        this.moveRafId = window.requestAnimationFrame(() => {
          this.moveRafId = null;
          if (this.pendingMovePos) {
            void moveDesktopWindow(
              this.pendingMovePos.x,
              this.pendingMovePos.y,
              this.callbacks.getWindowLabel(),
            );
            this.pendingMovePos = null;
          }
        });
      };

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startClientX;
        const dy = ev.clientY - startClientY;
        if (!draggingStarted && Math.hypot(dx, dy) < DRAG_START_PX) return;
        if (!draggingStarted) {
          draggingStarted = true;
          this.state = 'DRAGGING_IN_STRIP';
          tabEl.classList.add('is-dragging');
          refreshOtherWindows();
        }

        const outsideVertically =
          ev.clientY > barRect.bottom + DETACH_THRESHOLD_PX ||
          ev.clientY < barRect.top - DETACH_THRESHOLD_PX;
        const isSoleTab = this.callbacks.getTabIds().length <= 1;

        if (!isSpecialPageTabId(tabId) && (outsideVertically || (this.state === 'DRAGGING_WINDOW' && isSoleTab))) {
          if (this.state !== 'DRAGGING_WINDOW') {
            this.state = 'DRAGGING_WINDOW';
            tabEl.style.transform = '';
          }

          const hit = hitTestOtherWindowTabStrip(ev.screenX, ev.screenY);
          hoverTargetWin = hit?.target ?? null;
          hoverInsertionIndex = hit?.insertionIndex ?? 0;

          if (isSoleTab) {
            // Sole-tab window moves smoothly across screen without creating another window
            scheduleSoleWindowMove(ev.screenX, ev.screenY);
          }

          const g = ensureGhost();
          g.style.left = `${Math.round(ev.clientX - grabOffsetX)}px`;
          g.style.top = `${Math.round(ev.clientY - grabOffsetY)}px`;
          g.classList.toggle('is-combine', Boolean(hoverTargetWin));
          const hint = g.querySelector('.qv-tab-drag-hint');
          if (hint) {
            hint.textContent = hoverTargetWin
              ? 'Release to combine into target tab strip'
              : isSoleTab
                ? 'Moving window — drag over another tab strip to combine'
                : 'Release to open in new window';
          }
          return;
        }

        if (this.state === 'DRAGGING_WINDOW' && !outsideVertically && !isSoleTab) {
          // Re-entered source tab strip seamlessly back to DRAGGING_IN_STRIP
          this.state = 'DRAGGING_IN_STRIP';
          hoverTargetWin = null;
          removeGhost();
        }

        if (this.state === 'DRAGGING_IN_STRIP') {
          reorderInStrip(ev);
        }
      };

      const onUp = (ev: PointerEvent) => {
        tabEl.removeEventListener('pointermove', onMove);
        tabEl.removeEventListener('pointerup', onUp);
        tabEl.removeEventListener('pointercancel', onUp);
        tabEl.classList.remove('is-dragging');
        tabEl.style.transform = '';
        removeGhost();
        if (this.moveRafId !== null) {
          window.cancelAnimationFrame(this.moveRafId);
          this.moveRafId = null;
        }

        const finalState = this.state;
        this.state = 'IDLE';

        if (!draggingStarted) {
          if (!isActive) this.callbacks.onActivateTab(tabId);
          return;
        }

        if (finalState === 'DRAGGING_WINDOW' && !isSpecialPageTabId(tabId)) {
          if (hoverTargetWin) {
            this.callbacks.onMergeIntoWindow(
              hoverTargetWin.label,
              tabId,
              hoverInsertionIndex,
            );
            return;
          }
          if (this.callbacks.getTabIds().length > 1) {
            this.callbacks.onDetachToNewWindow(
              tabId,
              tabTitle,
              Math.max(0, ev.screenX - grabOffsetX),
              Math.max(0, ev.screenY - grabOffsetY),
            );
            return;
          }
        }

        this.callbacks.onFinishInStrip();
      };

      tabEl.addEventListener('pointermove', onMove);
      tabEl.addEventListener('pointerup', onUp);
      tabEl.addEventListener('pointercancel', onUp);
    });
  }
}
