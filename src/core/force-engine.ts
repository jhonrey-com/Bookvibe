import type { StoryGraph, StoryGraphColorRule, StoryGraphEdge, StoryGraphNode } from './types';

export interface ForceBody {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
  degree: number;
  radius: number;
}

export interface ForceParams {
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
}

export const DEFAULT_FORCE_PARAMS: ForceParams = {
  centerForce: 0.06,
  repelForce: 14500,
  linkForce: 0.12,
  linkDistance: 230,
};

/**
 * Deterministic Verlet force-directed graph physics simulation supporting pin locks,
 * degree-scaled node sizes, hop isolation, and BFS shortest-path narrative tracing.
 */
export class ForceGraphSimulation {
  readonly bodies = new Map<string, ForceBody>();
  readonly edges: StoryGraphEdge[];
  private centerX: number;
  private centerY: number;

  constructor(graph: StoryGraph, centerX = 500, centerY = 340) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.edges = graph.edges;
    const degreeCount = new Map<string, number>();
    for (const e of graph.edges) {
      degreeCount.set(e.sourceId, (degreeCount.get(e.sourceId) ?? 0) + 1);
      degreeCount.set(e.targetId, (degreeCount.get(e.targetId) ?? 0) + 1);
    }
    graph.nodes.forEach((n, idx) => {
      const deg = degreeCount.get(n.id) ?? 0;
      const angle = (idx / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      const spread = 120 + (idx % 3) * 55;
      const x = Number.isFinite(n.x) && n.x !== 0 ? n.x : centerX + Math.cos(angle) * spread;
      const y = Number.isFinite(n.y) && n.y !== 0 ? n.y : centerY + Math.sin(angle) * spread;
      this.bodies.set(n.id, {
        id: n.id,
        x,
        y,
        vx: 0,
        vy: 0,
        pinned: Boolean(n.pinned),
        degree: deg,
        radius: 10 + Math.min(18, deg * 2.4),
      });
    });
  }

  step(params: ForceParams = DEFAULT_FORCE_PARAMS): void {
    const arr = Array.from(this.bodies.values());
    const n = arr.length;

    // Pairwise inverse-square repulsion
    for (let i = 0; i < n; i++) {
      const a = arr[i];
      for (let j = i + 1; j < n; j++) {
        const b = arr[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 16) {
          dx = 2 + (i % 3);
          dy = 2 + (j % 3);
          distSq = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(distSq);
        const force = params.repelForce / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!a.pinned) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!b.pinned) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    // Spring links
    for (const e of this.edges) {
      const a = this.bodies.get(e.sourceId);
      const b = this.bodies.get(e.targetId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const stretch = dist - params.linkDistance;
      const f = stretch * params.linkForce;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      if (!a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Gravity toward center + damping integration
    for (const b of arr) {
      if (b.pinned) {
        b.vx = 0;
        b.vy = 0;
        continue;
      }
      b.vx += (this.centerX - b.x) * params.centerForce;
      b.vy += (this.centerY - b.y) * params.centerForce;
      b.vx *= 0.78;
      b.vy *= 0.78;
      b.x += Math.max(-24, Math.min(24, b.vx));
      b.y += Math.max(-24, Math.min(24, b.vy));
    }
  }

  runSteps(count = 60, params: ForceParams = DEFAULT_FORCE_PARAMS): void {
    for (let i = 0; i < count; i++) {
      this.step(params);
    }
  }
}

export function getNeighborhoodIds(
  graph: StoryGraph,
  rootId: string,
  maxDepth = 1,
): Set<string> {
  const visited = new Set<string>();
  if (!rootId || maxDepth <= 0) return visited;
  visited.add(rootId);
  let frontier = [rootId];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: string[] = [];
    for (const curr of frontier) {
      for (const e of graph.edges) {
        if (e.sourceId === curr && !visited.has(e.targetId)) {
          visited.add(e.targetId);
          next.push(e.targetId);
        } else if (e.targetId === curr && !visited.has(e.sourceId)) {
          visited.add(e.sourceId);
          next.push(e.sourceId);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return visited;
}

export function findShortestNarrativePath(
  graph: StoryGraph,
  sourceId: string,
  targetId: string,
): { nodeIds: string[]; edgeIds: string[] } | null {
  if (!sourceId || !targetId) return null;
  if (sourceId === targetId) return { nodeIds: [sourceId], edgeIds: [] };

  const visited = new Set<string>([sourceId]);
  const parentNode = new Map<string, string>();
  const parentEdge = new Map<string, string>();
  const queue = [sourceId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const e of graph.edges) {
      const neighbor = e.sourceId === curr ? e.targetId : e.targetId === curr ? e.sourceId : null;
      if (!neighbor || visited.has(neighbor)) continue;
      visited.add(neighbor);
      parentNode.set(neighbor, curr);
      parentEdge.set(neighbor, e.id);
      if (neighbor === targetId) {
        const nodeIds: string[] = [];
        const edgeIds: string[] = [];
        let walk: string | undefined = targetId;
        while (walk) {
          nodeIds.unshift(walk);
          const pe = parentEdge.get(walk);
          if (pe) edgeIds.unshift(pe);
          walk = parentNode.get(walk);
        }
        return { nodeIds, edgeIds };
      }
      queue.push(neighbor);
    }
  }
  return null;
}

export function resolveNodeColorByRules(
  node: StoryGraphNode,
  rules: StoryGraphColorRule[] | undefined,
): string {
  if (!rules || rules.length === 0) return node.color;
  const hayTags = (node.tags ?? []).map((t) => t.toLowerCase());
  const hayLabel = `${node.label} ${node.subtitle}`.toLowerCase();
  for (const rule of rules) {
    const q = rule.query.trim().toLowerCase();
    if (!q) continue;
    if (q.startsWith('kind:') && node.kind.toLowerCase() === q.slice(5).trim()) {
      return rule.color;
    }
    if (q.startsWith('#') && hayTags.some((t) => t === q.slice(1) || t === q)) {
      return rule.color;
    }
    if (hayLabel.includes(q) || hayTags.some((t) => t.includes(q))) {
      return rule.color;
    }
  }
  return node.color;
}
