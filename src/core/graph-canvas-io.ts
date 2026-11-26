import { safeJsonParse } from './extensions';
import { newId } from './manuscript';
import type {
  GraphAnchorSide,
  GraphArrowHead,
  StoryGraph,
  StoryGraphEdge,
  StoryGraphGroup,
  StoryGraphNode,
} from './types';

export interface ParsedWikilinkResult {
  links: string[];
  tags: string[];
}

/**
 * Extracts [[Wikilink]] entity references and #tags from entity Markdown notes.
 */
export function extractWikilinksAndTags(markdownText: string): ParsedWikilinkResult {
  const scrubbed = markdownText.replace(/`[^`]*`/g, ' ');
  const links: string[] = [];
  const seenLinks = new Set<string>();
  const linkRe = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(scrubbed)) !== null) {
    const name = m[1].trim();
    const key = name.toLowerCase();
    if (name && !seenLinks.has(key)) {
      seenLinks.add(key);
      links.push(name);
    }
  }

  const tags: string[] = [];
  const seenTags = new Set<string>();
  const tagRe = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]{1,32})/g;
  while ((m = tagRe.exec(scrubbed)) !== null) {
    const t = m[1].trim();
    const key = t.toLowerCase();
    if (t && !seenTags.has(key)) {
      seenTags.add(key);
      tags.push(t);
    }
  }

  return { links, tags };
}

/**
 * Synchronizes outgoing wikilink edges for a given node while preserving manual edges.
 */
export function syncWikilinkEdgesInGraph(
  graph: StoryGraph,
  sourceNodeId: string,
  markdownText: string,
): StoryGraph {
  const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return graph;

  const { links, tags } = extractWikilinksAndTags(markdownText);
  const nodes = graph.nodes.map((n) =>
    n.id === sourceNodeId ? { ...n, notes: markdownText, tags } : { ...n },
  );

  const desiredTargetIds = new Set<string>();
  for (const linkLabel of links) {
    const existing = nodes.find(
      (n) => n.label.trim().toLowerCase() === linkLabel.toLowerCase(),
    );
    if (existing) {
      if (existing.id !== sourceNodeId) desiredTargetIds.add(existing.id);
    } else {
      const created: StoryGraphNode = {
        id: newId('gn'),
        kind: 'note',
        label: linkLabel,
        subtitle: 'Wikilink Entity',
        x: Math.round(sourceNode.x + 280),
        y: Math.round(sourceNode.y + (desiredTargetIds.size * 70 - 35)),
        width: 196,
        height: 82,
        color: '#8aa4c8',
        notes: `# ${linkLabel}\n\nLinked from [[${sourceNode.label}]].`,
        tags: [],
      };
      nodes.push(created);
      desiredTargetIds.add(created.id);
    }
  }

  // Retain edges unrelated to wikilinks, or existing wikilink edges that remain valid
  const keptEdges: StoryGraphEdge[] = [];
  const coveredTargets = new Set<string>();
  for (const e of graph.edges) {
    if (e.sourceId === sourceNodeId && e.label === 'wikilink') {
      if (desiredTargetIds.has(e.targetId)) {
        keptEdges.push(e);
        coveredTargets.add(e.targetId);
      }
    } else {
      keptEdges.push(e);
      if (e.sourceId === sourceNodeId && desiredTargetIds.has(e.targetId)) {
        coveredTargets.add(e.targetId);
      }
    }
  }

  for (const targetId of desiredTargetIds) {
    if (!coveredTargets.has(targetId)) {
      keptEdges.push({
        id: newId('ge'),
        sourceId: sourceNodeId,
        targetId,
        label: 'wikilink',
        style: 'dashed',
        color: '#8aa4c8',
        sourceAnchor: 'auto',
        targetAnchor: 'auto',
        routingMode: 'curved',
        endArrow: 'arrow',
      });
    }
  }

  return {
    ...graph,
    nodes,
    edges: keptEdges,
  };
}

export interface JsonCanvasNode {
  id: string;
  type: 'text' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  label?: string;
  color?: string;
  qvKind?: string;
  qvSubtitle?: string;
  qvNotes?: string;
  qvTags?: string[];
}

export interface JsonCanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: GraphAnchorSide;
  toNode: string;
  toSide?: GraphAnchorSide;
  toEnd?: GraphArrowHead;
  fromEnd?: GraphArrowHead;
  color?: string;
  label?: string;
  qvRoutingMode?: 'elbow' | 'curved' | 'straight';
  qvStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface JsonCanvasDocument {
  nodes: JsonCanvasNode[];
  edges: JsonCanvasEdge[];
}

export function exportStoryGraphToJsonCanvas(graph: StoryGraph): string {
  const nodes: JsonCanvasNode[] = [
    ...(graph.groups ?? []).map((g) => ({
      id: g.id,
      type: 'group' as const,
      x: Math.round(g.x),
      y: Math.round(g.y),
      width: Math.round(g.width),
      height: Math.round(g.height),
      label: g.label,
      color: g.color,
    })),
    ...graph.nodes.map((n) => ({
      id: n.id,
      type: 'text' as const,
      x: Math.round(n.x),
      y: Math.round(n.y),
      width: Math.round(n.width ?? 196),
      height: Math.round(n.height ?? 86),
      text: n.notes ? `**${n.label}**\n\n${n.notes}` : `**${n.label}**\n${n.subtitle}`,
      color: n.color,
      qvKind: n.kind,
      qvSubtitle: n.subtitle,
      qvNotes: n.notes,
      qvTags: n.tags ?? [],
    })),
  ];

  const edges: JsonCanvasEdge[] = graph.edges.map((e) => ({
    id: e.id,
    fromNode: e.sourceId,
    fromSide: e.sourceAnchor && e.sourceAnchor !== 'auto' ? e.sourceAnchor : undefined,
    toNode: e.targetId,
    toSide: e.targetAnchor && e.targetAnchor !== 'auto' ? e.targetAnchor : undefined,
    toEnd: e.endArrow ?? 'arrow',
    fromEnd: e.startArrow ?? 'none',
    color: e.color,
    label: e.label,
    qvRoutingMode: e.routingMode,
    qvStyle: e.style,
  }));

  return JSON.stringify({ nodes, edges } satisfies JsonCanvasDocument, null, 2);
}

export function importJsonCanvasToStoryGraph(rawJson: string): StoryGraph {
  const parsed = safeJsonParse<Partial<JsonCanvasDocument>>(rawJson);
  const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];

  const groups: StoryGraphGroup[] = [];
  const nodes: StoryGraphNode[] = [];

  for (const rn of rawNodes) {
    if (!rn || typeof rn !== 'object') continue;
    if (rn.type === 'group') {
      groups.push({
        id: String(rn.id || newId('gg')),
        label: String(rn.label || 'Act Group'),
        x: Number(rn.x) || 0,
        y: Number(rn.y) || 0,
        width: Math.max(180, Number(rn.width) || 360),
        height: Math.max(140, Number(rn.height) || 260),
        color: String(rn.color || '#c7a97b'),
      });
    } else {
      const rawText = String(rn.text || '');
      const firstLine = rawText.split(/\r?\n/)[0]?.replace(/\*\*/g, '').trim() || 'Canvas Node';
      nodes.push({
        id: String(rn.id || newId('gn')),
        kind: (rn.qvKind as StoryGraphNode['kind']) || 'note',
        label: firstLine.slice(0, 60),
        subtitle: String(rn.qvSubtitle || 'Imported Card'),
        x: Number(rn.x) || 0,
        y: Number(rn.y) || 0,
        width: Math.max(140, Number(rn.width) || 196),
        height: Math.max(68, Number(rn.height) || 86),
        color: String(rn.color || '#8aa4c8'),
        notes: String(rn.qvNotes ?? rawText),
        tags: Array.isArray(rn.qvTags) ? rn.qvTags.map(String) : [],
      });
    }
  }

  const edges: StoryGraphEdge[] = rawEdges
    .filter((re) => re && re.fromNode && re.toNode)
    .map((re) => ({
      id: String(re.id || newId('ge')),
      sourceId: String(re.fromNode),
      targetId: String(re.toNode),
      label: String(re.label || ''),
      style: re.qvStyle ?? 'solid',
      color: String(re.color || '#c7a97b'),
      sourceAnchor: re.fromSide ?? 'auto',
      targetAnchor: re.toSide ?? 'auto',
      routingMode: re.qvRoutingMode ?? 'elbow',
      startArrow: re.fromEnd ?? 'none',
      endArrow: re.toEnd ?? 'arrow',
    }));

  return { nodes, edges, groups, colorRules: [] };
}
