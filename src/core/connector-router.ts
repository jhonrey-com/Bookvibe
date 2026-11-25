import type { GraphAnchorSide, GraphRoutingMode } from './types';

export type ResolvedSide = 'top' | 'right' | 'bottom' | 'left';

export interface RectBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RoutedConnector {
  d: string;
  sourceSide: ResolvedSide;
  targetSide: ResolvedSide;
  startPoint: RoutePoint;
  endPoint: RoutePoint;
  labelPoint: RoutePoint;
  midHandle: { x: number; y: number; axis: 'x' | 'y' } | null;
}

const PORT_STUB_PX = 24;
const ELBOW_CORNER_RADIUS_PX = 8;

export function getPortPointOnBox(box: RectBox, side: ResolvedSide): RoutePoint {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (side === 'left') return { x: box.x, y: cy };
  if (side === 'right') return { x: box.x + box.width, y: cy };
  if (side === 'top') return { x: cx, y: box.y };
  return { x: cx, y: box.y + box.height };
}

export function resolveSidesForBoxes(
  sourceBox: RectBox,
  targetBox: RectBox,
  sourcePref: GraphAnchorSide = 'auto',
  targetPref: GraphAnchorSide = 'auto',
): { sourceSide: ResolvedSide; targetSide: ResolvedSide } {
  const scx = sourceBox.x + sourceBox.width / 2;
  const scy = sourceBox.y + sourceBox.height / 2;
  const tcx = targetBox.x + targetBox.width / 2;
  const tcy = targetBox.y + targetBox.height / 2;
  const dx = tcx - scx;
  const dy = tcy - scy;
  const preferHoriz = Math.abs(dx) >= Math.abs(dy);

  const sourceSide: ResolvedSide =
    sourcePref !== 'auto'
      ? sourcePref
      : preferHoriz
        ? dx >= 0
          ? 'right'
          : 'left'
        : dy >= 0
          ? 'bottom'
          : 'top';

  const targetSide: ResolvedSide =
    targetPref !== 'auto'
      ? targetPref
      : preferHoriz
        ? dx >= 0
          ? 'left'
          : 'right'
        : dy >= 0
          ? 'top'
          : 'bottom';

  return { sourceSide, targetSide };
}

function clipRayToBoxBorder(fromCenter: RoutePoint, toward: RoutePoint, box: RectBox): RoutePoint {
  const dx = toward.x - fromCenter.x;
  const dy = toward.y - fromCenter.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return fromCenter;
  const hw = box.width / 2;
  const hh = box.height / 2;
  const tx = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);
  return {
    x: fromCenter.x + dx * t,
    y: fromCenter.y + dy * t,
  };
}

function sideNormal(side: ResolvedSide): RoutePoint {
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'bottom') return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

function buildRoundedPolylinePath(pts: RoutePoint[], radius = ELBOW_CORNER_RADIUS_PX): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }
  const cmds: string[] = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 1 || len2 < 1) {
      cmds.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
      continue;
    }
    const r = Math.min(radius, len1 * 0.45, len2 * 0.45);
    const pInX = curr.x - (v1x / len1) * r;
    const pInY = curr.y - (v1y / len1) * r;
    const pOutX = curr.x + (v2x / len2) * r;
    const pOutY = curr.y + (v2y / len2) * r;
    cmds.push(`L ${pInX.toFixed(1)} ${pInY.toFixed(1)}`);
    cmds.push(`Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${pOutX.toFixed(1)} ${pOutY.toFixed(1)}`);
  }
  const last = pts[pts.length - 1];
  cmds.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return cmds.join(' ');
}

function segmentIntersectsRect(a: RoutePoint, b: RoutePoint, box: RectBox, pad = 10): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const rx1 = box.x - pad;
  const ry1 = box.y - pad;
  const rx2 = box.x + box.width + pad;
  const ry2 = box.y + box.height + pad;
  return maxX >= rx1 && minX <= rx2 && maxY >= ry1 && minY <= ry2;
}

/**
 * Computes obstacle-aware connector SVG geometry supporting elbow, curved, and straight routing.
 */
export function routeConnector(params: {
  sourceBox: RectBox;
  targetBox: RectBox;
  routingMode?: GraphRoutingMode;
  sourceAnchor?: GraphAnchorSide;
  targetAnchor?: GraphAnchorSide;
  elbowOffset?: number;
  obstacles?: RectBox[];
}): RoutedConnector {
  const mode = params.routingMode ?? 'elbow';
  const { sourceSide, targetSide } = resolveSidesForBoxes(
    params.sourceBox,
    params.targetBox,
    params.sourceAnchor ?? 'auto',
    params.targetAnchor ?? 'auto',
  );

  if (mode === 'straight') {
    const sc = { x: params.sourceBox.x + params.sourceBox.width / 2, y: params.sourceBox.y + params.sourceBox.height / 2 };
    const tc = { x: params.targetBox.x + params.targetBox.width / 2, y: params.targetBox.y + params.targetBox.height / 2 };
    const startPoint = clipRayToBoxBorder(sc, tc, params.sourceBox);
    const endPoint = clipRayToBoxBorder(tc, sc, params.targetBox);
    return {
      d: `M ${startPoint.x.toFixed(1)} ${startPoint.y.toFixed(1)} L ${endPoint.x.toFixed(1)} ${endPoint.y.toFixed(1)}`,
      sourceSide,
      targetSide,
      startPoint,
      endPoint,
      labelPoint: { x: (startPoint.x + endPoint.x) / 2, y: (startPoint.y + endPoint.y) / 2 },
      midHandle: null,
    };
  }

  const startPoint = getPortPointOnBox(params.sourceBox, sourceSide);
  const endPoint = getPortPointOnBox(params.targetBox, targetSide);

  if (mode === 'curved') {
    const n1 = sideNormal(sourceSide);
    const n2 = sideNormal(targetSide);
    const dist = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    const handleLen = Math.max(44, Math.min(180, dist * 0.42));
    const c1 = { x: startPoint.x + n1.x * handleLen, y: startPoint.y + n1.y * handleLen };
    const c2 = { x: endPoint.x + n2.x * handleLen, y: endPoint.y + n2.y * handleLen };
    // Exact cubic Bezier midpoint at t = 0.5
    const labelPoint = {
      x: 0.125 * startPoint.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * endPoint.x,
      y: 0.125 * startPoint.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * endPoint.y,
    };
    return {
      d: `M ${startPoint.x.toFixed(1)} ${startPoint.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${endPoint.x.toFixed(1)} ${endPoint.y.toFixed(1)}`,
      sourceSide,
      targetSide,
      startPoint,
      endPoint,
      labelPoint,
      midHandle: null,
    };
  }

  // Orthogonal obstacle-aware 90-degree elbow routing
  const n1 = sideNormal(sourceSide);
  const n2 = sideNormal(targetSide);
  const p1 = { x: startPoint.x + n1.x * PORT_STUB_PX, y: startPoint.y + n1.y * PORT_STUB_PX };
  const p2 = { x: endPoint.x + n2.x * PORT_STUB_PX, y: endPoint.y + n2.y * PORT_STUB_PX };

  const horizontalExit = sourceSide === 'left' || sourceSide === 'right';
  const offset = params.elbowOffset ?? 0;
  let pts: RoutePoint[];

  if (horizontalExit) {
    let midX = (p1.x + p2.x) / 2 + offset;
    const blocking = (params.obstacles ?? []).filter(
      (o) =>
        o.id !== params.sourceBox.id &&
        o.id !== params.targetBox.id &&
        segmentIntersectsRect({ x: midX, y: p1.y }, { x: midX, y: p2.y }, o, 14),
    );
    if (blocking.length > 0 && offset === 0) {
      const topMost = Math.min(...blocking.map((b) => b.y)) - 32;
      const botMost = Math.max(...blocking.map((b) => b.y + b.height)) + 32;
      const detourY = Math.abs(p1.y - topMost) <= Math.abs(p1.y - botMost) ? topMost : botMost;
      pts = [startPoint, p1, { x: p1.x, y: detourY }, { x: p2.x, y: detourY }, p2, endPoint];
      const labelPoint = { x: (p1.x + p2.x) / 2, y: detourY };
      return {
        d: buildRoundedPolylinePath(pts),
        sourceSide,
        targetSide,
        startPoint,
        endPoint,
        labelPoint,
        midHandle: { x: labelPoint.x, y: labelPoint.y, axis: 'y' },
      };
    }
    pts = [startPoint, p1, { x: midX, y: p1.y }, { x: midX, y: p2.y }, p2, endPoint];
    const labelPoint = { x: midX, y: (p1.y + p2.y) / 2 };
    return {
      d: buildRoundedPolylinePath(pts),
      sourceSide,
      targetSide,
      startPoint,
      endPoint,
      labelPoint,
      midHandle: { x: midX, y: labelPoint.y, axis: 'x' },
    };
  }

  let midY = (p1.y + p2.y) / 2 + offset;
  const blocking = (params.obstacles ?? []).filter(
    (o) =>
      o.id !== params.sourceBox.id &&
      o.id !== params.targetBox.id &&
      segmentIntersectsRect({ x: p1.x, y: midY }, { x: p2.x, y: midY }, o, 14),
  );
  if (blocking.length > 0 && offset === 0) {
    const leftMost = Math.min(...blocking.map((b) => b.x)) - 32;
    const rightMost = Math.max(...blocking.map((b) => b.x + b.width)) + 32;
    const detourX = Math.abs(p1.x - leftMost) <= Math.abs(p1.x - rightMost) ? leftMost : rightMost;
    pts = [startPoint, p1, { x: detourX, y: p1.y }, { x: detourX, y: p2.y }, p2, endPoint];
    const labelPoint = { x: detourX, y: (p1.y + p2.y) / 2 };
    return {
      d: buildRoundedPolylinePath(pts),
      sourceSide,
      targetSide,
      startPoint,
      endPoint,
      labelPoint,
      midHandle: { x: detourX, y: labelPoint.y, axis: 'x' },
    };
  }
  pts = [startPoint, p1, { x: p1.x, y: midY }, { x: p2.x, y: midY }, p2, endPoint];
  const labelPoint = { x: (p1.x + p2.x) / 2, y: midY };
  return {
    d: buildRoundedPolylinePath(pts),
    sourceSide,
    targetSide,
    startPoint,
    endPoint,
    labelPoint,
    midHandle: { x: labelPoint.x, y: midY, axis: 'y' },
  };
}
