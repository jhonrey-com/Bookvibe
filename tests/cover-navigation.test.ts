import { describe, expect, it } from 'vitest';
import {
  COVER_MAX_ZOOM,
  COVER_MIN_ZOOM,
  COVER_ZOOM_PRESETS,
  clampCoverZoom,
  classifyCanvasWheelGesture,
  computeCursorAnchoredZoom,
  computeFitZoom,
} from '../src/core/cover-navigation';

describe('Cover Studio Canvas Navigation', () => {
  it('treats ordinary two-finger touchpad scroll as panning and never zooms', () => {
    const vertical = classifyCanvasWheelGesture({ deltaX: 0, deltaY: 42, ctrlKey: false, metaKey: false });
    expect(vertical).toEqual({ kind: 'pan', panDeltaX: 0, panDeltaY: -42 });

    const horizontal = classifyCanvasWheelGesture({ deltaX: -28, deltaY: 0, ctrlKey: false });
    expect(horizontal).toEqual({ kind: 'pan', panDeltaX: 28, panDeltaY: 0 });

    const diagonal = classifyCanvasWheelGesture({ deltaX: 16, deltaY: -24, ctrlKey: false, metaKey: false });
    expect(diagonal).toEqual({ kind: 'pan', panDeltaX: -16, panDeltaY: 24 });
  });

  it('pans horizontally on Shift + Wheel without triggering zoom', () => {
    const shiftScroll = classifyCanvasWheelGesture({
      deltaX: 0,
      deltaY: 60,
      shiftKey: true,
      ctrlKey: false,
    });
    expect(shiftScroll).toEqual({ kind: 'pan', panDeltaX: -60, panDeltaY: 0 });
  });

  it('recognizes trackpad pinch and Ctrl/Cmd + Wheel as intentional zoom', () => {
    const pinchIn = classifyCanvasWheelGesture({ deltaX: 0, deltaY: 36, ctrlKey: true });
    expect(pinchIn.kind).toBe('zoom');
    if (pinchIn.kind === 'zoom') {
      expect(pinchIn.zoomFactor).toBeLessThan(1);
    }

    const pinchOut = classifyCanvasWheelGesture({ deltaX: 0, deltaY: -36, ctrlKey: true });
    expect(pinchOut.kind).toBe('zoom');
    if (pinchOut.kind === 'zoom') {
      expect(pinchOut.zoomFactor).toBeGreaterThan(1);
    }

    const cmdWheel = classifyCanvasWheelGesture({ deltaX: 0, deltaY: -24, metaKey: true });
    expect(cmdWheel.kind).toBe('zoom');
  });

  it('keeps the point under the cursor anchored during zoom in and zoom out', () => {
    const originX = 500;
    const originY = 120;
    const anchorX = 640;
    const anchorY = 310;

    let zoom = 1;
    let panX = 24;
    let panY = -18;

    // Point on canvas in unscaled coordinates relative to origin:
    const localX = (anchorX - originX - panX) / zoom;
    const localY = (anchorY - originY - panY) / zoom;

    const zoomedIn = computeCursorAnchoredZoom({
      currentZoom: zoom,
      nextZoom: 1.75,
      panX,
      panY,
      anchorX,
      anchorY,
      originX,
      originY,
    });
    zoom = zoomedIn.zoom;
    panX = zoomedIn.panX;
    panY = zoomedIn.panY;

    expect(originX + panX + localX * zoom).toBeCloseTo(anchorX, 4);
    expect(originY + panY + localY * zoom).toBeCloseTo(anchorY, 4);

    const zoomedOut = computeCursorAnchoredZoom({
      currentZoom: zoom,
      nextZoom: 0.65,
      panX,
      panY,
      anchorX,
      anchorY,
      originX,
      originY,
    });
    expect(originX + zoomedOut.panX + localX * zoomedOut.zoom).toBeCloseTo(anchorX, 4);
    expect(originY + zoomedOut.panY + localY * zoomedOut.zoom).toBeCloseTo(anchorY, 4);
  });

  it('clamps zoom presets cleanly and computes fit-to-window scale', () => {
    expect(COVER_ZOOM_PRESETS).toEqual([0.25, 0.5, 0.75, 1, 1.5, 2]);
    expect(clampCoverZoom(0.01)).toBe(COVER_MIN_ZOOM);
    expect(clampCoverZoom(12)).toBe(COVER_MAX_ZOOM);
    expect(clampCoverZoom(Number.NaN)).toBe(1);

    const fit = computeFitZoom(900, 700, 1200, 900, 80);
    expect(fit).toBeGreaterThanOrEqual(COVER_MIN_ZOOM);
    expect(fit).toBeLessThanOrEqual(1);
    expect(fit).toBeCloseTo(0.68, 2);
  });

  it('handles rapid direction reversals and interrupted non-finite wheel inputs safely', () => {
    let panX = 0;
    let panY = 0;
    const deltas = [
      { deltaX: 12, deltaY: -30 },
      { deltaX: -12, deltaY: 30 },
      { deltaX: 45, deltaY: 18 },
      { deltaX: -45, deltaY: -18 },
    ];
    for (const d of deltas) {
      const g = classifyCanvasWheelGesture(d);
      expect(g.kind).toBe('pan');
      if (g.kind === 'pan') {
        panX += g.panDeltaX;
        panY += g.panDeltaY;
      }
    }
    expect(panX).toBe(0);
    expect(panY).toBe(0);

    const malformed = classifyCanvasWheelGesture({
      deltaX: Number.NaN,
      deltaY: Number.POSITIVE_INFINITY,
      ctrlKey: true,
    });
    expect(malformed.kind).toBe('zoom');
    if (malformed.kind === 'zoom') {
      expect(malformed.zoomFactor).toBe(1);
    }
  });
});
