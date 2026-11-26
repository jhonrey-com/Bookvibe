import { countTermOccurrences } from './bible';
import { getAllScenes, newId } from './manuscript';
import type {
  BookProject,
  GraphNodeKind,
  StoryGraph,
  StoryGraphEdge,
  StoryGraphNode,
} from './types';

export const GRAPH_KIND_COLORS: Record<GraphNodeKind, string> = {
  character: '#c7a97b',
  location: '#6b9cd4',
  lore: '#67b08c',
  plot: '#d4827d',
  scene: '#9aa4b8',
  storyline: '#d19a66',
  faction: '#e06c75',
  item: '#56b6c2',
  note: '#8aa4c8',
  custom: '#b995cc',
};

export const GRAPH_KIND_LABELS: Record<GraphNodeKind, string> = {
  character: 'Character',
  location: 'Location',
  lore: 'Lore / Codex',
  plot: 'Plot Beat',
  scene: 'Scene',
  storyline: 'Storyline',
  faction: 'Faction',
  item: 'Item',
  note: 'Note',
  custom: 'Custom',
};

export function seedGraphFromProject(project: BookProject): StoryGraph {
  const existingNodes = project.storyGraph?.nodes ?? [];
  const existingEdges = project.storyGraph?.edges ?? [];
  const byRefId = new Map<string, StoryGraphNode>();
  for (const node of existingNodes) {
    if (node.refId) byRefId.set(node.refId, node);
  }

  const seededNodes: StoryGraphNode[] = [];
  const ringEntries: Array<{
    refId: string;
    kind: GraphNodeKind;
    label: string;
    subtitle: string;
    notes: string;
  }> = [];

  for (const ch of project.bible.characters) {
    ringEntries.push({
      refId: ch.id,
      kind: 'character',
      label: ch.name,
      subtitle: ch.role || 'Character',
      notes: ch.motivation,
    });
  }
  for (const loc of project.bible.locations) {
    ringEntries.push({
      refId: loc.id,
      kind: 'location',
      label: loc.name,
      subtitle: loc.region || 'Location',
      notes: loc.atmosphere,
    });
  }
  for (const lore of project.bible.lore) {
    ringEntries.push({
      refId: lore.id,
      kind: 'lore',
      label: lore.name,
      subtitle: lore.category || 'Lore',
      notes: lore.summary,
    });
  }
  const scenes = getAllScenes(project);
  for (const item of scenes) {
    ringEntries.push({
      refId: item.scene.id,
      kind: 'scene',
      label: item.scene.title,
      subtitle: item.chapter.title,
      notes: item.scene.synopsis,
    });
  }

  const cols = 4;
  const colStep = 195;
  const rowStep = 112;

  ringEntries.forEach((entry, i) => {
    const prev = byRefId.get(entry.refId);
    const col = i % cols;
    const row = Math.floor(i / cols);
    seededNodes.push({
      ...(prev ?? {}),
      id: prev?.id ?? `gnode-${entry.refId}`,
      kind: prev?.kind ?? entry.kind,
      refId: entry.refId,
      label: entry.label,
      subtitle: entry.subtitle,
      x: prev ? prev.x : 36 + col * colStep,
      y: prev ? prev.y : 36 + row * rowStep,
      color: prev?.color ?? GRAPH_KIND_COLORS[entry.kind],
      notes: entry.notes || prev?.notes || '',
    });
  });

  // Preserve custom or plot nodes added directly in Graph view
  for (const node of existingNodes) {
    if (!node.refId || !seededNodes.some((n) => n.id === node.id)) {
      seededNodes.push(node);
    }
  }

  // Generate scene-mention links cleanly if graph had no edges yet
  const edges: StoryGraphEdge[] = [...existingEdges];
  const hasEdge = (a: string, b: string) =>
    edges.some((e) => (e.sourceId === a && e.targetId === b) || (e.sourceId === b && e.targetId === a));

  if (existingEdges.length === 0) {
    const nodeByRef = new Map(seededNodes.map((n) => [n.refId, n]));
    for (const item of scenes) {
      const sceneNode = nodeByRef.get(item.scene.id);
      if (!sceneNode) continue;
      const body = `${item.scene.title}\n${item.scene.content}\n${item.scene.pov}\n${item.scene.location}`;

      for (const ch of project.bible.characters) {
        const chNode = nodeByRef.get(ch.id);
        if (!chNode) continue;
        const terms = [ch.name, ...ch.aliases.split(',')].map((s) => s.trim()).filter(Boolean);
        if (countTermOccurrences(body, terms) > 0 && !hasEdge(chNode.id, sceneNode.id)) {
          edges.push({
            id: `gedge-${chNode.id}-${sceneNode.id}`,
            sourceId: chNode.id,
            targetId: sceneNode.id,
            label: item.scene.pov === ch.name ? 'POV' : 'appears in',
            style: 'solid',
            color: '#6e7684',
          });
        }
      }

      for (const loc of project.bible.locations) {
        const locNode = nodeByRef.get(loc.id);
        if (!locNode) continue;
        if (countTermOccurrences(body, [loc.name]) > 0 && !hasEdge(sceneNode.id, locNode.id)) {
          edges.push({
            id: `gedge-${sceneNode.id}-${locNode.id}`,
            sourceId: sceneNode.id,
            targetId: locNode.id,
            label: 'set at',
            style: 'dashed',
            color: '#6b9cd4',
          });
        }
      }
    }
  }

  const validIds = new Set(seededNodes.map((n) => n.id));
  return {
    nodes: seededNodes,
    edges: edges.filter((e) => validIds.has(e.sourceId) && validIds.has(e.targetId)),
    groups: project.storyGraph?.groups,
    colorRules: project.storyGraph?.colorRules,
    boardTheme: project.storyGraph?.boardTheme ?? 'obsidian-dots',
    autoSyncWithBook: project.storyGraph?.autoSyncWithBook ?? true,
  };
}

/**
 * Propagates edits made on a linked Story Graph node back into the corresponding
 * Character, Location, Lore, or Scene record in the BookProject.
 */
export function syncGraphNodeBackToBook(
  project: BookProject,
  nodeId: string,
  patch: { label?: string; subtitle?: string; notes?: string },
): BookProject {
  const node = project.storyGraph?.nodes.find((n) => n.id === nodeId);
  if (!node?.refId) return project;
  const next = structuredClone(project);
  const refId = node.refId;

  if (node.kind === 'character') {
    const ch = next.bible.characters.find((c) => c.id === refId);
    if (ch) {
      if (patch.label !== undefined && patch.label.trim()) ch.name = patch.label.trim();
      if (patch.subtitle !== undefined) ch.role = patch.subtitle;
      if (patch.notes !== undefined) ch.motivation = patch.notes;
    }
  } else if (node.kind === 'location') {
    const loc = next.bible.locations.find((l) => l.id === refId);
    if (loc) {
      if (patch.label !== undefined && patch.label.trim()) loc.name = patch.label.trim();
      if (patch.subtitle !== undefined) loc.region = patch.subtitle;
      if (patch.notes !== undefined) loc.atmosphere = patch.notes;
    }
  } else if (node.kind === 'lore') {
    const lore = next.bible.lore.find((l) => l.id === refId);
    if (lore) {
      if (patch.label !== undefined && patch.label.trim()) lore.name = patch.label.trim();
      if (patch.subtitle !== undefined) lore.category = patch.subtitle;
      if (patch.notes !== undefined) lore.summary = patch.notes;
    }
  } else if (node.kind === 'scene') {
    for (const part of next.parts) {
      for (const chap of part.chapters) {
        const sc = chap.scenes.find((s) => s.id === refId);
        if (sc) {
          if (patch.label !== undefined && patch.label.trim()) sc.title = patch.label.trim();
          if (patch.notes !== undefined) sc.synopsis = patch.notes;
          sc.updatedAt = new Date().toISOString();
          return next;
        }
      }
    }
  }
  return next;
}

export function addGraphNode(
  graph: StoryGraph,
  input: { kind: GraphNodeKind; label: string; subtitle?: string; x?: number; y?: number; notes?: string },
): { graph: StoryGraph; node: StoryGraphNode } {
  const node: StoryGraphNode = {
    id: newId('gnode'),
    kind: input.kind,
    label: input.label.trim() || 'New Node',
    subtitle: input.subtitle?.trim() || GRAPH_KIND_LABELS[input.kind],
    x: input.x ?? 420 + (graph.nodes.length % 5) * 40,
    y: input.y ?? 240 + (graph.nodes.length % 4) * 40,
    color: GRAPH_KIND_COLORS[input.kind],
    notes: input.notes ?? '',
  };
  return {
    graph: { ...graph, nodes: [...graph.nodes, node] },
    node,
  };
}

export function updateGraphNode(
  graph: StoryGraph,
  nodeId: string,
  patch: Partial<StoryGraphNode>,
): StoryGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
  };
}

export function changeGraphNodeKind(
  graph: StoryGraph,
  nodeId: string,
  kind: GraphNodeKind,
): StoryGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      const wasDefaultSub = n.subtitle === GRAPH_KIND_LABELS[n.kind];
      return {
        ...n,
        kind,
        color: GRAPH_KIND_COLORS[kind],
        subtitle: wasDefaultSub ? GRAPH_KIND_LABELS[kind] : n.subtitle,
      };
    }),
  };
}

export function deleteGraphNode(graph: StoryGraph, nodeId: string): StoryGraph {
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    edges: graph.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId),
  };
}

export function addGraphGroup(
  graph: StoryGraph,
  input: { label?: string; x?: number; y?: number; width?: number; height?: number; color?: string },
): StoryGraph {
  const groups = graph.groups ?? [];
  const next = {
    id: newId('gg'),
    label: input.label?.trim() || `Act ${groups.length + 1}`,
    x: input.x ?? 80 + groups.length * 40,
    y: input.y ?? 60 + groups.length * 40,
    width: Math.max(220, input.width ?? 420),
    height: Math.max(160, input.height ?? 300),
    color: input.color ?? '#c7a97b',
    collapsed: false,
  };
  return {
    ...graph,
    groups: [...groups, next],
  };
}

export function updateGraphGroup(
  graph: StoryGraph,
  groupId: string,
  patch: Partial<NonNullable<StoryGraph['groups']>[number]>,
): StoryGraph {
  return {
    ...graph,
    groups: (graph.groups ?? []).map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
  };
}

export function deleteGraphGroup(graph: StoryGraph, groupId: string): StoryGraph {
  return {
    ...graph,
    groups: (graph.groups ?? []).filter((g) => g.id !== groupId),
  };
}

export function addGraphEdge(
  graph: StoryGraph,
  sourceId: string,
  targetId: string,
  label = 'connects to',
): { graph: StoryGraph; edge?: StoryGraphEdge } {
  if (sourceId === targetId) return { graph };
  const edge: StoryGraphEdge = {
    id: newId('gedge'),
    sourceId,
    targetId,
    label: label.trim() || 'relates to',
    style: 'solid',
    color: '#a2a9b5',
  };
  return {
    graph: { ...graph, edges: [...graph.edges, edge] },
    edge,
  };
}

export function updateGraphEdge(
  graph: StoryGraph,
  edgeId: string,
  patch: Partial<StoryGraphEdge>,
): StoryGraph {
  return {
    ...graph,
    edges: graph.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
  };
}

export function reverseGraphEdge(graph: StoryGraph, edgeId: string): StoryGraph {
  return {
    ...graph,
    edges: graph.edges.map((e) =>
      e.id === edgeId ? { ...e, sourceId: e.targetId, targetId: e.sourceId } : e,
    ),
  };
}

export function deleteGraphEdge(graph: StoryGraph, edgeId: string): StoryGraph {
  return {
    ...graph,
    edges: graph.edges.filter((e) => e.id !== edgeId),
  };
}

/**
 * Arranges nodes into categorized non-overlapping columns with generous gap room for edge labels.
 */
export function applyAutoLayout(graph: StoryGraph): StoryGraph {
  const order: GraphNodeKind[] = [
    'character',
    'storyline',
    'plot',
    'scene',
    'faction',
    'location',
    'item',
    'lore',
    'note',
    'custom',
  ];
  const activeGroups = order
    .map((kind) => graph.nodes.filter((n) => n.kind === kind))
    .filter((g) => g.length > 0);

  const maxCols = 4;
  const colStep = 248;
  const rowStep = 132;
  const nextNodes: StoryGraphNode[] = [];

  let bandY = 42;
  for (let start = 0; start < activeGroups.length; start += maxCols) {
    const rowGroups = activeGroups.slice(start, start + maxCols);
    let maxRowsInBand = 1;
    rowGroups.forEach((group, colIdx) => {
      maxRowsInBand = Math.max(maxRowsInBand, group.length);
      group.forEach((node, rowIdx) => {
        nextNodes.push({
          ...node,
          x: 42 + colIdx * colStep,
          y: bandY + rowIdx * rowStep,
        });
      });
    });
    bandY += maxRowsInBand * rowStep + 56;
  }

  return {
    ...graph,
    nodes: nextNodes,
  };
}

/**
 * Places characters/plot hubs around the inner core and scenes/locations around an outer orbit.
 */
export function applyRadialLayout(graph: StoryGraph): StoryGraph {
  const inner = graph.nodes.filter((n) => n.kind === 'character' || n.kind === 'plot');
  const outer = graph.nodes.filter((n) => n.kind !== 'character' && n.kind !== 'plot');
  const cx = 560;
  const cy = 380;
  const nextNodes: StoryGraphNode[] = [];

  inner.forEach((node, idx) => {
    const angle = (idx / Math.max(1, inner.length)) * Math.PI * 2 - Math.PI / 2;
    const r = inner.length === 1 ? 0 : 185;
    nextNodes.push({
      ...node,
      x: Math.max(24, Math.round(cx + Math.cos(angle) * r - 84)),
      y: Math.max(24, Math.round(cy + Math.sin(angle) * r - 30)),
    });
  });

  outer.forEach((node, idx) => {
    const angle = (idx / Math.max(1, outer.length)) * Math.PI * 2 - Math.PI / 2;
    const r = 365;
    nextNodes.push({
      ...node,
      x: Math.max(24, Math.round(cx + Math.cos(angle) * r - 84)),
      y: Math.max(24, Math.round(cy + Math.sin(angle) * r - 30)),
    });
  });

  return { ...graph, nodes: nextNodes };
}

/**
 * Places Scenes in left-to-right story order with cast above and locations/lore below.
 */
export function applyTimelineFlowLayout(graph: StoryGraph): StoryGraph {
  const scenes = graph.nodes.filter((n) => n.kind === 'scene');
  const topBand = graph.nodes.filter((n) => n.kind === 'character' || n.kind === 'plot');
  const bottomBand = graph.nodes.filter(
    (n) => n.kind === 'location' || n.kind === 'lore' || n.kind === 'custom',
  );

  const nextNodes: StoryGraphNode[] = [];
  topBand.forEach((n, idx) =>
    nextNodes.push({ ...n, x: 48 + idx * 240, y: 42 }),
  );
  scenes.forEach((n, idx) =>
    nextNodes.push({ ...n, x: 48 + idx * 245, y: 220 }),
  );
  bottomBand.forEach((n, idx) =>
    nextNodes.push({ ...n, x: 48 + idx * 240, y: 400 }),
  );
  return { ...graph, nodes: nextNodes };
}

function escSvg(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportGraphAsSvgString(graph: StoryGraph): string {
  const maxX = Math.max(960, ...graph.nodes.map((n) => n.x + 240));
  const maxY = Math.max(640, ...graph.nodes.map((n) => n.y + 140));
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeEls: string[] = [];

  for (const edge of graph.edges) {
    const s = nodeMap.get(edge.sourceId);
    const d = nodeMap.get(edge.targetId);
    if (!s || !d) continue;
    const nodeW = 192;
    const nodeH = 74;
    const sMidX = s.x + nodeW / 2;
    const dMidX = d.x + nodeW / 2;
    const x1 = dMidX >= sMidX ? s.x + nodeW : s.x;
    const y1 = s.y + nodeH / 2;
    const x2 = dMidX >= sMidX ? d.x : d.x + nodeW;
    const y2 = d.y + nodeH / 2;
    const outDir = dMidX >= sMidX ? 1 : -1;
    const inDir = dMidX >= sMidX ? -1 : 1;
    const bend = Math.max(42, Math.min(160, Math.abs(x2 - x1) * 0.45));
    const c1x = x1 + outDir * bend;
    const c2x = x2 + inDir * bend;
    const mx = 0.125 * x1 + 0.375 * c1x + 0.375 * c2x + 0.125 * x2;
    const my = (y1 + y2) / 2 - 8;
    const dash = edge.style === 'dashed' ? ' stroke-dasharray="5 4"' : '';
    edgeEls.push(
      `<path d="M ${x1} ${y1} C ${c1x.toFixed(1)} ${y1}, ${c2x.toFixed(1)} ${y2}, ${x2} ${y2}" fill="none" stroke="${escSvg(edge.color || '#6e7684')}" stroke-width="1.6"${dash}/>`,
      `<text x="${mx}" y="${my}" fill="#a2a9b5" font-size="11" text-anchor="middle" font-family="Inter, sans-serif">${escSvg(edge.label)}</text>`,
    );
  }

  const nodeEls = graph.nodes.map(
    (n) => `<g transform="translate(${n.x}, ${n.y})">
  <rect width="192" height="74" rx="7" fill="#101218" stroke="#323642" />
  <rect width="192" height="3" rx="1.5" fill="${escSvg(n.color)}" />
  <text x="12" y="22" fill="${escSvg(n.color)}" font-size="10" font-family="monospace">${escSvg(GRAPH_KIND_LABELS[n.kind])}</text>
  <text x="12" y="42" fill="#eceef2" font-size="12.5" font-weight="600" font-family="Inter, sans-serif">${escSvg(n.label)}</text>
  <text x="12" y="58" fill="#6e7684" font-size="10.5" font-family="Inter, sans-serif">${escSvg(n.subtitle)}</text>
</g>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}">
  <rect width="${maxX}" height="${maxY}" fill="#08080a" />
  ${edgeEls.join('\n  ')}
  ${nodeEls.join('\n  ')}
</svg>
`;
}
