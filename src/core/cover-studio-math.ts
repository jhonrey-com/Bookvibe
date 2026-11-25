export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewportTransform {
  zoom: number;
  panX: number;
  panY: number;
  /** Viewport offset of canvas surface origin */
  originX: number;
  originY: number;
}

export interface SnapGuideLine {
  orientation: 'vertical' | 'horizontal';
  positionPct: number;
  kind: 'page' | 'element';
}

export interface SpacingBadgeIndicator {
  orientation: 'horizontal' | 'vertical';
  startPct: number;
  endPct: number;
  crossPct: number;
  gapPx: number;
}

export interface StudioSmartSnapResult {
  snappedLeftPct: number;
  snappedTopPct: number;
  guides: SnapGuideLine[];
  spacingBadges: SpacingBadgeIndicator[];
}

/**
 * Maps pointer positions and distances between CSS viewport pixels and logical 0..100% artboard coordinates.
 */
export class CoordinateSystem {
  readonly artboardWidth: number;
  readonly artboardHeight: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly originX: number;
  readonly originY: number;

  constructor(params: {
    artboardWidth: number;
    artboardHeight: number;
    zoom?: number;
    panX?: number;
    panY?: number;
    originX?: number;
    originY?: number;
  }) {
    this.artboardWidth = Math.max(1, params.artboardWidth);
    this.artboardHeight = Math.max(1, params.artboardHeight);
    this.zoom = Math.max(0.1, Math.min(5, params.zoom ?? 1));
    this.panX = params.panX ?? 0;
    this.panY = params.panY ?? 0;
    this.originX = params.originX ?? 0;
    this.originY = params.originY ?? 0;
  }

  screenToWorld(clientX: number, clientY: number): WorldPoint {
    const worldPxX = (clientX - this.originX - this.panX) / this.zoom;
    const worldPxY = (clientY - this.originY - this.panY) / this.zoom;
    return {
      x: (worldPxX / this.artboardWidth) * 100,
      y: (worldPxY / this.artboardHeight) * 100,
    };
  }

  worldToScreen(worldXPct: number, worldYPct: number): WorldPoint {
    const worldPxX = (worldXPct / 100) * this.artboardWidth;
    const worldPxY = (worldYPct / 100) * this.artboardHeight;
    return {
      x: this.originX + this.panX + worldPxX * this.zoom,
      y: this.originY + this.panY + worldPxY * this.zoom,
    };
  }

  screenDeltaToWorldPct(dxScreen: number, dyScreen: number): WorldPoint {
    return {
      x: (dxScreen / (this.artboardWidth * this.zoom)) * 100,
      y: (dyScreen / (this.artboardHeight * this.zoom)) * 100,
    };
  }

  screenThresholdToWorldPctX(thresholdPx = 5): number {
    return (thresholdPx / (this.artboardWidth * this.zoom)) * 100;
  }

  screenThresholdToWorldPctY(thresholdPx = 5): number {
    return (thresholdPx / (this.artboardHeight * this.zoom)) * 100;
  }
}

/**
 * Computes magnetic smart guides to page edges/centers, sibling edges/centers,
 * and 3+ element equal-spacing intervals at a constant screen-space threshold (5px).
 */
export function computeStudioSmartSnap(
  movingBox: WorldBox,
  otherBoxes: WorldBox[],
  coord: CoordinateSystem,
  options: { disabled?: boolean; thresholdPx?: number; pageMarginPct?: number } = {},
): StudioSmartSnapResult {
  if (options.disabled) {
    return {
      snappedLeftPct: movingBox.left,
      snappedTopPct: movingBox.top,
      guides: [],
      spacingBadges: [],
    };
  }

  const thresholdPx = options.thresholdPx ?? 5;
  const tolX = coord.screenThresholdToWorldPctX(thresholdPx);
  const tolY = coord.screenThresholdToWorldPctY(thresholdPx);
  const margin = options.pageMarginPct ?? 7.5;

  const targetXLines: { val: number; kind: 'page' | 'element' }[] = [
    { val: 0, kind: 'page' },
    { val: margin, kind: 'page' },
    { val: 50, kind: 'page' },
    { val: 100 - margin, kind: 'page' },
    { val: 100, kind: 'page' },
  ];
  const targetYLines: { val: number; kind: 'page' | 'element' }[] = [
    { val: 0, kind: 'page' },
    { val: margin, kind: 'page' },
    { val: 50, kind: 'page' },
    { val: 100 - margin, kind: 'page' },
    { val: 100, kind: 'page' },
  ];

  for (const b of otherBoxes) {
    if (b.id === movingBox.id) continue;
    targetXLines.push(
      { val: b.left, kind: 'element' },
      { val: b.left + b.width / 2, kind: 'element' },
      { val: b.left + b.width, kind: 'element' },
    );
    targetYLines.push(
      { val: b.top, kind: 'element' },
      { val: b.top + b.height / 2, kind: 'element' },
      { val: b.top + b.height, kind: 'element' },
    );
  }

  // Evaluate left edge, center-X, right edge against targetXLines
  const movingXAnchors = [
    { offset: 0, pos: movingBox.left },
    { offset: movingBox.width / 2, pos: movingBox.left + movingBox.width / 2 },
    { offset: movingBox.width, pos: movingBox.left + movingBox.width },
  ];

  let bestDx = Number.POSITIVE_INFINITY;
  let bestSnapLeft = movingBox.left;
  let matchedXGuide: SnapGuideLine | null = null;

  for (const anchor of movingXAnchors) {
    for (const target of targetXLines) {
      const diff = target.val - anchor.pos;
      if (Math.abs(diff) <= tolX && Math.abs(diff) < Math.abs(bestDx)) {
        bestDx = diff;
        bestSnapLeft = target.val - anchor.offset;
        matchedXGuide = { orientation: 'vertical', positionPct: target.val, kind: target.kind };
      }
    }
  }

  const movingYAnchors = [
    { offset: 0, pos: movingBox.top },
    { offset: movingBox.height / 2, pos: movingBox.top + movingBox.height / 2 },
    { offset: movingBox.height, pos: movingBox.top + movingBox.height },
  ];

  let bestDy = Number.POSITIVE_INFINITY;
  let bestSnapTop = movingBox.top;
  let matchedYGuide: SnapGuideLine | null = null;

  for (const anchor of movingYAnchors) {
    for (const target of targetYLines) {
      const diff = target.val - anchor.pos;
      if (Math.abs(diff) <= tolY && Math.abs(diff) < Math.abs(bestDy)) {
        bestDy = diff;
        bestSnapTop = target.val - anchor.offset;
        matchedYGuide = { orientation: 'horizontal', positionPct: target.val, kind: target.kind };
      }
    }
  }

  const guides: SnapGuideLine[] = [];
  if (matchedXGuide) guides.push(matchedXGuide);
  if (matchedYGuide) guides.push(matchedYGuide);

  // Check equal spacing among 3+ horizontally or vertically ordered items
  const spacingBadges: SpacingBadgeIndicator[] = [];
  const siblings = otherBoxes.filter((b) => b.id !== movingBox.id);

  if (siblings.length >= 2) {
    const sortedX = [...siblings].sort((a, b) => a.left - b.left);
    for (let i = 0; i < sortedX.length - 1; i++) {
      const a = sortedX[i];
      const b = sortedX[i + 1];
      const aRight = a.left + a.width;
      const gap = b.left - aRight;
      if (gap <= 0.2) continue;

      // Candidate 1: moving box placed after b matching [a..b] gap
      const targetAfterB = b.left + b.width + gap;
      const candAfterX = matchedXGuide ? bestSnapLeft : movingBox.left;
      if (Math.abs(candAfterX - targetAfterB) <= tolX) {
        if (!matchedXGuide) bestSnapLeft = targetAfterB;
        const gapPx = Math.round((gap / 100) * coord.artboardWidth);
        const crossY = movingBox.top + movingBox.height / 2;
        spacingBadges.push(
          { orientation: 'horizontal', startPct: aRight, endPct: b.left, crossPct: crossY, gapPx },
          { orientation: 'horizontal', startPct: b.left + b.width, endPct: targetAfterB, crossPct: crossY, gapPx },
        );
        break;
      }

      // Candidate 2: moving box placed before a matching [a..b] gap
      const targetBeforeA = a.left - gap - movingBox.width;
      const candBeforeX = matchedXGuide ? bestSnapLeft : movingBox.left;
      if (Math.abs(candBeforeX - targetBeforeA) <= tolX) {
        if (!matchedXGuide) bestSnapLeft = targetBeforeA;
        const gapPx = Math.round((gap / 100) * coord.artboardWidth);
        const crossY = movingBox.top + movingBox.height / 2;
        spacingBadges.push(
          { orientation: 'horizontal', startPct: targetBeforeA + movingBox.width, endPct: a.left, crossPct: crossY, gapPx },
          { orientation: 'horizontal', startPct: aRight, endPct: b.left, crossPct: crossY, gapPx },
        );
        break;
      }
    }

    const sortedY = [...siblings].sort((a, b) => a.top - b.top);
    for (let i = 0; i < sortedY.length - 1; i++) {
      const a = sortedY[i];
      const b = sortedY[i + 1];
      const aBottom = a.top + a.height;
      const gap = b.top - aBottom;
      if (gap <= 0.2) continue;

      const targetBelowB = b.top + b.height + gap;
      const candBelowY = matchedYGuide ? bestSnapTop : movingBox.top;
      if (Math.abs(candBelowY - targetBelowB) <= tolY) {
        if (!matchedYGuide) bestSnapTop = targetBelowB;
        const gapPx = Math.round((gap / 100) * coord.artboardHeight);
        const crossX = movingBox.left + movingBox.width / 2;
        spacingBadges.push(
          { orientation: 'vertical', startPct: aBottom, endPct: b.top, crossPct: crossX, gapPx },
          { orientation: 'vertical', startPct: b.top + b.height, endPct: targetBelowB, crossPct: crossX, gapPx },
        );
        break;
      }

      const targetAboveA = a.top - gap - movingBox.height;
      const candAboveY = matchedYGuide ? bestSnapTop : movingBox.top;
      if (Math.abs(candAboveY - targetAboveA) <= tolY) {
        if (!matchedYGuide) bestSnapTop = targetAboveA;
        const gapPx = Math.round((gap / 100) * coord.artboardHeight);
        const crossX = movingBox.left + movingBox.width / 2;
        spacingBadges.push(
          { orientation: 'vertical', startPct: targetAboveA + movingBox.height, endPct: a.top, crossPct: crossX, gapPx },
          { orientation: 'vertical', startPct: aBottom, endPct: b.top, crossPct: crossX, gapPx },
        );
        break;
      }
    }
  }

  return {
    snappedLeftPct: Number(bestSnapLeft.toFixed(3)),
    snappedTopPct: Number(bestSnapTop.toFixed(3)),
    guides,
    spacingBadges,
  };
}

export function computeUnifiedBounds(boxes: WorldBox[]): WorldBox | null {
  if (boxes.length === 0) return null;
  let minL = boxes[0].left;
  let minT = boxes[0].top;
  let maxR = boxes[0].left + boxes[0].width;
  let maxB = boxes[0].top + boxes[0].height;
  for (let i = 1; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.left < minL) minL = b.left;
    if (b.top < minT) minT = b.top;
    if (b.left + b.width > maxR) maxR = b.left + b.width;
    if (b.top + b.height > maxB) maxB = b.top + b.height;
  }
  return {
    id: '__group_bounds__',
    left: minL,
    top: minT,
    width: Math.max(0.5, maxR - minL),
    height: Math.max(0.5, maxB - minT),
  };
}

export function scaleBoxesAroundPivot(
  initialBoxes: WorldBox[],
  initialGroup: WorldBox,
  newGroup: WorldBox,
): Map<string, WorldBox> {
  const sx = newGroup.width / Math.max(0.5, initialGroup.width);
  const sy = newGroup.height / Math.max(0.5, initialGroup.height);
  const out = new Map<string, WorldBox>();
  for (const box of initialBoxes) {
    out.set(box.id, {
      id: box.id,
      left: newGroup.left + (box.left - initialGroup.left) * sx,
      top: newGroup.top + (box.top - initialGroup.top) * sy,
      width: Math.max(1, box.width * sx),
      height: Math.max(0.5, box.height * sy),
    });
  }
  return out;
}

export type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'middle-y' | 'bottom' | 'tidy';

export function alignBoxes(
  boxes: WorldBox[],
  mode: AlignMode,
  canvasWidthPct = 100,
  canvasHeightPct = 100,
): Map<string, { left: number; top: number }> {
  const result = new Map<string, { left: number; top: number }>();
  if (boxes.length === 0) return result;

  if (boxes.length === 1) {
    const b = boxes[0];
    let left = b.left;
    let top = b.top;
    if (mode === 'left') left = 7.5;
    else if (mode === 'center-x') left = (canvasWidthPct - b.width) / 2;
    else if (mode === 'right') left = canvasWidthPct - 7.5 - b.width;
    else if (mode === 'top') top = 7.5;
    else if (mode === 'middle-y') top = (canvasHeightPct - b.height) / 2;
    else if (mode === 'bottom') top = canvasHeightPct - 7.5 - b.height;
    result.set(b.id, { left, top });
    return result;
  }

  const bounds = computeUnifiedBounds(boxes)!;
  if (mode === 'tidy') {
    const sorted = [...boxes].sort((a, b) => a.top - b.top);
    const totalH = sorted.reduce((acc, b) => acc + b.height, 0);
    const gap = Math.max(2, (bounds.height - totalH) / Math.max(1, sorted.length - 1));
    let cursorY = bounds.top;
    const centerX = bounds.left + bounds.width / 2;
    for (const b of sorted) {
      result.set(b.id, { left: centerX - b.width / 2, top: cursorY });
      cursorY += b.height + gap;
    }
    return result;
  }

  for (const b of boxes) {
    let left = b.left;
    let top = b.top;
    if (mode === 'left') left = bounds.left;
    else if (mode === 'center-x') left = bounds.left + bounds.width / 2 - b.width / 2;
    else if (mode === 'right') left = bounds.left + bounds.width - b.width;
    else if (mode === 'top') top = bounds.top;
    else if (mode === 'middle-y') top = bounds.top + bounds.height / 2 - b.height / 2;
    else if (mode === 'bottom') top = bounds.top + bounds.height - b.height;
    result.set(b.id, { left, top });
  }
  return result;
}
