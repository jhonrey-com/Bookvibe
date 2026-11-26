export const COVER_MIN_ZOOM = 0.1;
export const COVER_MAX_ZOOM = 5;
export const COVER_ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;

export interface WheelGestureInput {
  deltaX: number;
  deltaY: number;
  deltaMode?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export type ClassifiedCanvasWheelGesture =
  | { kind: 'zoom'; zoomFactor: number; normalizedDeltaY: number }
  | { kind: 'pan'; panDeltaX: number; panDeltaY: number };

export interface CursorAnchoredZoomParams {
  currentZoom: number;
  nextZoom: number;
  panX: number;
  panY: number;
  anchorX?: number;
  anchorY?: number;
  originX: number;
  originY: number;
}

function normalizeWheelAxis(value: number, deltaMode: number): number {
  if (!Number.isFinite(value)) return 0;
  if (deltaMode === 1) return value * 16;
  if (deltaMode === 2) return value * 120;
  return value;
}

export function clampCoverZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(COVER_MIN_ZOOM, Math.min(COVER_MAX_ZOOM, Number(zoom.toFixed(3))));
}

/**
 * Separates ordinary two-finger touchpad scrolling / mouse wheel panning from
 * intentional zoom gestures (trackpad pinch dispatches ctrlKey=true on Chromium/WebView2,
 * alongside explicit Ctrl+Wheel / Cmd+Wheel).
 */
export function classifyCanvasWheelGesture(input: WheelGestureInput): ClassifiedCanvasWheelGesture {
  const mode = input.deltaMode ?? 0;
  const rawX = normalizeWheelAxis(input.deltaX, mode);
  const rawY = normalizeWheelAxis(input.deltaY, mode);

  if (input.ctrlKey || input.metaKey) {
    const clampedDelta = Math.max(-180, Math.min(180, rawY));
    return {
      kind: 'zoom',
      zoomFactor: Math.exp(-clampedDelta * 0.0055),
      normalizedDeltaY: clampedDelta,
    };
  }

  if (input.shiftKey && Math.abs(rawX) < 0.001) {
    return {
      kind: 'pan',
      panDeltaX: rawY === 0 ? 0 : -rawY,
      panDeltaY: 0,
    };
  }

  return {
    kind: 'pan',
    panDeltaX: rawX === 0 ? 0 : -rawX,
    panDeltaY: rawY === 0 ? 0 : -rawY,
  };
}

/**
 * Updates zoom and translation so the canvas point under (anchorX, anchorY)
 * remains stationary relative to the viewport origin.
 */
export function computeCursorAnchoredZoom(params: CursorAnchoredZoomParams): {
  zoom: number;
  panX: number;
  panY: number;
} {
  const prevZoom = clampCoverZoom(params.currentZoom);
  const clampedZoom = clampCoverZoom(params.nextZoom);
  const curPanX = Number.isFinite(params.panX) ? params.panX : 0;
  const curPanY = Number.isFinite(params.panY) ? params.panY : 0;

  if (
    typeof params.anchorX === 'number' &&
    typeof params.anchorY === 'number' &&
    Number.isFinite(params.anchorX) &&
    Number.isFinite(params.anchorY) &&
    Number.isFinite(params.originX) &&
    Number.isFinite(params.originY)
  ) {
    const ox = params.anchorX - params.originX;
    const oy = params.anchorY - params.originY;
    const ratio = clampedZoom / prevZoom;
    return {
      zoom: clampedZoom,
      panX: ox - (ox - curPanX) * ratio,
      panY: oy - (oy - curPanY) * ratio,
    };
  }

  return {
    zoom: clampedZoom,
    panX: curPanX,
    panY: curPanY,
  };
}

export function computeFitZoom(
  viewportWidth: number,
  viewportHeight: number,
  artboardWidth: number,
  artboardHeight: number,
  paddingPx = 80,
): number {
  const safeVw = Math.max(260, (Number.isFinite(viewportWidth) ? viewportWidth : 640) - paddingPx);
  const safeVh = Math.max(260, (Number.isFinite(viewportHeight) ? viewportHeight : 620) - paddingPx);
  const safeAw = Math.max(1, Number.isFinite(artboardWidth) ? artboardWidth : 1);
  const safeAh = Math.max(1, Number.isFinite(artboardHeight) ? artboardHeight : 1);
  const fit = Math.min(safeVw / safeAw, safeVh / safeAh);
  return Math.max(COVER_MIN_ZOOM, Math.min(2.5, Number(fit.toFixed(2))));
}
