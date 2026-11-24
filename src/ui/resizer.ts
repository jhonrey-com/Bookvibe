import { el } from './dom';

export interface VerticalResizerOptions {
  side: 'left' | 'right';
  minWidth: number;
  maxWidth: number;
  cssVarName: string;
  ariaLabel: string;
  getWidth: () => number;
  onResizeEnd: (finalWidth: number) => void;
  onDoubleClickReset?: () => number;
}

/**
 * Creates a draggable 5px vertical split handle displaying a <-> indicator on hover/drag.
 */
export function createVerticalResizer(options: VerticalResizerOptions): HTMLElement {
  let dragging = false;
  let startX = 0;
  let startW = options.getWidth();
  let liveW = startW;

  const handle = el(
    'div',
    {
      className: `qv-resizer qv-resizer-${options.side}`,
      attrs: {
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': options.ariaLabel,
        tabindex: 0,
      },
      on: {
        pointerdown: (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          dragging = true;
          startX = e.clientX;
          startW = options.getWidth();
          liveW = startW;
          handle.classList.add('is-dragging');
          document.body.classList.add('is-col-resizing');
          try {
            handle.setPointerCapture(e.pointerId);
          } catch {
            // Ignore synthetic events
          }
        },
        pointermove: (e) => {
          if (!dragging) return;
          const delta = options.side === 'left' ? e.clientX - startX : startX - e.clientX;
          liveW = Math.round(Math.max(options.minWidth, Math.min(options.maxWidth, startW + delta)));
          document.documentElement.style.setProperty(options.cssVarName, `${liveW}px`);
        },
        pointerup: (e) => {
          if (!dragging) return;
          dragging = false;
          handle.classList.remove('is-dragging');
          document.body.classList.remove('is-col-resizing');
          try {
            if (handle.hasPointerCapture(e.pointerId)) {
              handle.releasePointerCapture(e.pointerId);
            }
          } catch {
            // Ignore
          }
          options.onResizeEnd(liveW);
        },
        pointercancel: () => {
          if (!dragging) return;
          dragging = false;
          handle.classList.remove('is-dragging');
          document.body.classList.remove('is-col-resizing');
        },
        dblclick: () => {
          if (!options.onDoubleClickReset) return;
          const resetW = options.onDoubleClickReset();
          document.documentElement.style.setProperty(options.cssVarName, `${resetW}px`);
          options.onResizeEnd(resetW);
        },
        keydown: (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const step = e.shiftKey ? 24 : 10;
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          const signedDelta = options.side === 'left' ? dir * step : -dir * step;
          const next = Math.round(
            Math.max(options.minWidth, Math.min(options.maxWidth, options.getWidth() + signedDelta)),
          );
          document.documentElement.style.setProperty(options.cssVarName, `${next}px`);
          options.onResizeEnd(next);
        },
      },
    },
    el('span', { className: 'qv-resizer-grip', text: '↔', attrs: { 'aria-hidden': 'true' } }),
  );

  return handle;
}
