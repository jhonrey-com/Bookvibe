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
  custom: '#b995cc',
};

export const GRAPH_KIND_LABELS: Record<GraphNodeKind, string> = {
  character: 'Character',
  location: 'Location',
  lore: 'Lore / Item',
  plot: 'Plot Beat',
  scene: 'Scene',
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
      id: prev?.id ?? `gnode-${entry.refId}`,
      kind: prev?.kind ?? entry.kind,
      refId: entry.refId,
      label: entry.label,
      subtitle: entry.subtitle,
      x: prev ? prev.x : 36 + col * colStep,
      y: prev ? prev.y : 36 + row * rowStep,
      color: prev?.color ?? GRAPH_KIND_COLORS[entry.kind],
      notes: prev?.notes || entry.notes,
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
  };
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
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    edges: graph.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId),
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
 * Arranges nodes cleanly into categorized non-overlapping columns bounded inside the graph viewport.
 */
export function applyAutoLayout(graph: StoryGraph): StoryGraph {
  const order: GraphNodeKind[] = ['character', 'plot', 'scene', 'location', 'lore', 'custom'];
  const activeGroups = order
    .map((kind) => graph.nodes.filter((n) => n.kind === kind))
    .filter((g) => g.length > 0);

  const maxCols = 4;
  const colStep = 192;
  const rowStep = 104;
  const nextNodes: StoryGraphNode[] = [];

  let bandY = 36;
  for (let start = 0; start < activeGroups.length; start += maxCols) {
    const rowGroups = activeGroups.slice(start, start + maxCols);
    let maxRowsInBand = 1;
    rowGroups.forEach((group, colIdx) => {
      maxRowsInBand = Math.max(maxRowsInBand, group.length);
      group.forEach((node, rowIdx) => {
        nextNodes.push({
          ...node,
          x: 36 + colIdx * colStep,
          y: bandY + rowIdx * rowStep,
        });
      });
    });
    bandY += maxRowsInBand * rowStep + 48;
  }

  return {
    ...graph,
    nodes: nextNodes,
  };
}
