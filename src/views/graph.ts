import type { AppActions } from '../core/app-context';
import {
  GRAPH_KIND_COLORS,
  GRAPH_KIND_LABELS,
  addGraphEdge,
  addGraphNode,
  applyAutoLayout,
  applyRadialLayout,
  applyTimelineFlowLayout,
  changeGraphNodeKind,
  deleteGraphEdge,
  deleteGraphNode,
  exportGraphAsSvgString,
  reverseGraphEdge,
  seedGraphFromProject,
  updateGraphEdge,
  updateGraphNode,
} from '../core/graph';
import { normalizeProjectDefaults } from '../core/library';
import { newId } from '../core/manuscript';
import type { GraphNodeKind, StoryGraph, StoryGraphEdge, StoryGraphNode } from '../core/types';
import { clearNode, el, icon, svgEl } from '../ui/dom';

type GraphDensity = 'detailed' | 'standard' | 'compact';
type GraphEdgeStyle = 'curved' | 'step' | 'straight';
type GraphLayoutMode = 'columns' | 'radial' | 'flow';

let zoomScale = 1;
let panX = 0;
let panY = 0;
let selectedEdgeId = '';
let connectMode = false;
let connectSourceId = '';
let activeKindFilter: GraphNodeKind | 'all' = 'all';
let graphDensity: GraphDensity = 'detailed';
let edgeRouting: GraphEdgeStyle = 'curved';
let snapToGrid = true;
let showEdgeLabels = true;
let graphSearchQuery = '';

function withGraph(
  actions: AppActions,
  updater: (graph: StoryGraph) => StoryGraph,
  rerender = true,
): void {
  actions.mutateProject((prev) => {
    const next = normalizeProjectDefaults(prev);
    next.storyGraph = updater(next.storyGraph!);
    return next;
  }, rerender);
}

function nodeCardBox(_node: StoryGraphNode, cardEl?: HTMLElement): { w: number; h: number } {
  if (cardEl && cardEl.offsetWidth > 0 && cardEl.offsetHeight > 0) {
    return { w: cardEl.offsetWidth, h: cardEl.offsetHeight };
  }
  if (graphDensity === 'compact') return { w: 152, h: 38 };
  if (graphDensity === 'standard') return { w: 174, h: 64 };
  return { w: 192, h: 92 };
}

function computeEdgeSvgPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  mode: GraphEdgeStyle,
): { d: string; labelX: number; labelY: number } {
  const dx = tx - sx;
  const dy = ty - sy;
  if (mode === 'straight') {
    return { d: `M ${sx} ${sy} L ${tx} ${ty}`, labelX: (sx + tx) / 2, labelY: (sy + ty) / 2 - 7 };
  }
  if (mode === 'step') {
    const midX = Math.round((sx + tx) / 2);
    return {
      d: `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`,
      labelX: midX,
      labelY: (sy + ty) / 2 - 7,
    };
  }
  // Curved cubic Bezier anchored gently along horizontal/major direction
  const bend = Math.max(42, Math.min(180, Math.abs(dx) * 0.45));
  const sign = dx >= 0 ? 1 : -1;
  const c1x = sx + bend * sign;
  const c1y = sy + dy * 0.08;
  const c2x = tx - bend * sign;
  const c2y = ty - dy * 0.08;
  const midX = 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * tx;
  const midY = 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ty;
  return {
    d: `M ${sx} ${sy} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${tx} ${ty}`,
    labelX: midX,
    labelY: midY - 6,
  };
}

export function renderGraphView(container: HTMLElement, actions: AppActions): void {
  clearNode(container);
  const state = actions.getState();
  const project = normalizeProjectDefaults(state.project);
  const graph = project.storyGraph!;

  if (state.activeGraphNodeId && !graph.nodes.some((n) => n.id === state.activeGraphNodeId)) {
    state.activeGraphNodeId = graph.nodes[0]?.id ?? '';
  }

  const filterSelect = el(
    'select',
    {
      className: 'bv-select',
      tooltip: { title: 'Filter Node Types', short: 'Show all nodes or focus on one category.' },
      attrs: { 'aria-label': 'Filter graph node types' },
      on: {
        change: () => {
          activeKindFilter = filterSelect.value as GraphNodeKind | 'all';
          renderGraphView(container, actions);
        },
      },
    },
    el('option', { text: 'All Types', attrs: { value: 'all', selected: activeKindFilter === 'all' } }),
    ...(['character', 'plot', 'scene', 'location', 'lore', 'custom'] as const).map((k) =>
      el('option', { text: GRAPH_KIND_LABELS[k], attrs: { value: k, selected: activeKindFilter === k } }),
    ),
  );

  const densitySelect = el(
    'select',
    {
      className: 'bv-select',
      tooltip: { title: 'Card Density', short: 'Switch cards between Detailed, Standard, and Compact pills.' },
      attrs: { 'aria-label': 'Graph card density' },
      on: {
        change: () => {
          graphDensity = densitySelect.value as GraphDensity;
          renderGraphView(container, actions);
        },
      },
    },
    el('option', { text: 'View: Detailed', attrs: { value: 'detailed', selected: graphDensity === 'detailed' } }),
    el('option', { text: 'View: Standard', attrs: { value: 'standard', selected: graphDensity === 'standard' } }),
    el('option', { text: 'View: Compact', attrs: { value: 'compact', selected: graphDensity === 'compact' } }),
  );

  const edgeStyleSel = el(
    'select',
    {
      className: 'bv-select',
      tooltip: { title: 'Connector Style', short: 'Choose Curved Bezier, Orthogonal Step, or Straight lines.' },
      attrs: { 'aria-label': 'Graph edge routing style' },
      on: {
        change: () => {
          edgeRouting = edgeStyleSel.value as GraphEdgeStyle;
          renderGraphView(container, actions);
        },
      },
    },
    el('option', { text: 'Lines: Curved', attrs: { value: 'curved', selected: edgeRouting === 'curved' } }),
    el('option', { text: 'Lines: Step', attrs: { value: 'step', selected: edgeRouting === 'step' } }),
    el('option', { text: 'Lines: Straight', attrs: { value: 'straight', selected: edgeRouting === 'straight' } }),
  );

  const layoutSelect = el(
    'select',
    {
      className: 'bv-select',
      tooltip: { title: 'Auto-Arrange Graph', short: 'Arrange nodes into Columns, Radial hub, or Story Flow.' },
      attrs: { 'aria-label': 'Auto-arrange graph layout' },
      on: {
        change: () => {
          const val = layoutSelect.value as GraphLayoutMode;
          panX = 0;
          panY = 0;
          zoomScale = 1;
          withGraph(actions, (g) =>
            val === 'radial'
              ? applyRadialLayout(g)
              : val === 'flow'
                ? applyTimelineFlowLayout(g)
                : applyAutoLayout(g),
          );
        },
      },
    },
    el('option', { text: 'Layout: Choose…', attrs: { value: '', selected: true, disabled: true } }),
    el('option', { text: 'Arrange Columns', attrs: { value: 'columns' } }),
    el('option', { text: 'Radial Cast Hub', attrs: { value: 'radial' } }),
    el('option', { text: 'Timeline Story Flow', attrs: { value: 'flow' } }),
  );

  const newKindSelect = el(
    'select',
    { className: 'bv-select', attrs: { 'aria-label': 'New node type' } },
    ...(['character', 'plot', 'location', 'lore', 'scene', 'custom'] as const).map((k) =>
      el('option', { text: GRAPH_KIND_LABELS[k], attrs: { value: k } }),
    ),
  );

  const newLabelInput = el('input', {
    className: 'bv-input',
    style: { width: '132px', height: '26px' },
    attrs: { type: 'text', placeholder: 'Add node…', 'aria-label': 'New graph node title' },
  });

  const searchInput = el('input', {
    className: 'bv-input',
    style: { width: '125px', height: '26px' },
    attrs: { type: 'search', value: graphSearchQuery, placeholder: 'Find node…', 'aria-label': 'Search graph nodes' },
    on: {
      input: () => {
        graphSearchQuery = searchInput.value;
        renderGraphView(container, actions);
      },
    },
  });

  const visibleNodes = graph.nodes.filter(
    (n) => activeKindFilter === 'all' || n.kind === activeKindFilter,
  );
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = graph.edges.filter(
    (e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId),
  );
  const edgeCounts = new Map<string, number>();
  for (const e of graph.edges) {
    edgeCounts.set(e.sourceId, (edgeCounts.get(e.sourceId) ?? 0) + 1);
    edgeCounts.set(e.targetId, (edgeCounts.get(e.targetId) ?? 0) + 1);
  }

  const subbar = el(
    'div',
    { className: 'bv-subbar' },
    el(
      'div',
      { className: 'bv-subbar-group' },
      newKindSelect,
      newLabelInput,
      el(
        'button',
        {
          className: 'bv-mini-btn',
          tooltip: { title: 'Add Node', short: 'Create a node of the selected type on the canvas.' },
          attrs: { type: 'button' },
          on: {
            click: () => {
              const kind = newKindSelect.value as GraphNodeKind;
              const label = newLabelInput.value.trim() || `New ${GRAPH_KIND_LABELS[kind]}`;
              let createdId = '';
              withGraph(actions, (g) => {
                const res = addGraphNode(g, {
                  kind,
                  label,
                  x: Math.round(280 - panX + (g.nodes.length % 5) * 45),
                  y: Math.round(180 - panY + (g.nodes.length % 4) * 45),
                });
                createdId = res.node.id;
                return res.graph;
              }, false);
              selectedEdgeId = '';
              actions.setState({ activeGraphNodeId: createdId }, true);
            },
          },
        },
        icon('plus', 12),
        'Node',
      ),
      el('button', {
        className: `bv-fmt-btn${connectMode ? ' is-active' : ''}`,
        text: connectMode ? 'Click 2 Nodes…' : 'Connect',
        tooltip: {
          title: 'Connect Nodes',
          short: 'Click two nodes, or drag from any card port dot onto another card.',
        },
        attrs: { type: 'button' },
        on: {
          click: () => {
            connectMode = !connectMode;
            connectSourceId = '';
            renderGraphView(container, actions);
          },
        },
      }),
      searchInput,
    ),
    el(
      'div',
      { className: 'bv-subbar-group' },
      densitySelect,
      edgeStyleSel,
      layoutSelect,
      filterSelect,
      el('button', {
        className: `bv-mini-btn${snapToGrid ? ' is-active' : ''}`,
        text: 'Grid',
        tooltip: { title: 'Snap to 24px Grid', short: 'Aligns dragged cards neatly to the canvas dots.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            snapToGrid = !snapToGrid;
            renderGraphView(container, actions);
          },
        },
      }),
      el('button', {
        className: `bv-mini-btn${showEdgeLabels ? ' is-active' : ''}`,
        text: 'Labels',
        tooltip: { title: 'Toggle Edge Labels', short: 'Show or hide text tags along connecting lines.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            showEdgeLabels = !showEdgeLabels;
            renderGraphView(container, actions);
          },
        },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'Sync Book',
        tooltip: { title: 'Sync Graph from Book', short: 'Pull characters, locations, lore, and scenes into nodes.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            actions.mutateProject((prev) => ({
              ...prev,
              storyGraph: seedGraphFromProject(prev),
            }));
            actions.notify('Synced graph with Story Bible and Manuscript');
          },
        },
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: 'Fit',
        tooltip: { title: 'Fit Canvas View', short: 'Reset zoom and pan to show all nodes.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            panX = 0;
            panY = 0;
            zoomScale = 1;
            renderGraphView(container, actions);
          },
        },
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: 'SVG',
        tooltip: { title: 'Export Graph as SVG', short: 'Download clean vector diagram of the story graph.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            const svgOut = exportGraphAsSvgString(graph);
            const blob = new Blob([svgOut], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'story'}-graph.svg`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2500);
            actions.notify('Exported Story Graph SVG');
          },
        },
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: '−',
        tooltip: { title: 'Zoom Out', short: 'Shrink graph canvas.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            zoomScale = Math.max(0.45, Number((zoomScale - 0.1).toFixed(2)));
            renderGraphView(container, actions);
          },
        },
      }),
      el('span', { className: 'bv-mono-tag', text: `${Math.round(zoomScale * 100)}%` }),
      el('button', {
        className: 'bv-mini-btn',
        text: '+',
        tooltip: { title: 'Zoom In', short: 'Magnify graph canvas.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            zoomScale = Math.min(1.8, Number((zoomScale + 0.1).toFixed(2)));
            renderGraphView(container, actions);
          },
        },
      }),
    ),
  );

  const viewport = el('div', {
    className: 'bv-graph-viewport',
    style: {
      transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`,
    },
  });

  const svg = svgEl('svg', {
    class: 'bv-graph-svg',
    width: 2400,
    height: 1600,
    viewBox: '0 0 2400 1600',
  });
  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'bv-arrow',
    markerWidth: 8,
    markerHeight: 8,
    refX: 7,
    refY: 3.5,
    orient: 'auto',
  });
  marker.appendChild(svgEl('path', { d: 'M0,0 L8,3.5 L0,7 z', fill: '#8e96a4' }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Rubber-band line during drag-to-connect from node port
  const rubberLine = svgEl('path', {
    fill: 'none',
    stroke: '#67b08c',
    'stroke-width': '2',
    'stroke-dasharray': '5 4',
    visibility: 'hidden',
  });

  const nodeMap = new Map(visibleNodes.map((n) => [n.id, n]));
  const nodeCards = new Map<string, HTMLElement>();

  interface EdgeRenderRef {
    edge: StoryGraphEdge;
    pathEl: SVGPathElement;
    labelEl: SVGTextElement;
    pillEl: SVGRectElement;
  }
  const edgeRefs: EdgeRenderRef[] = [];
  const labelLayer = svgEl('g');

  const queryLower = graphSearchQuery.trim().toLowerCase();

  for (const edge of visibleEdges) {
    const src = nodeMap.get(edge.sourceId);
    const dst = nodeMap.get(edge.targetId);
    if (!src || !dst) continue;

    const sBox = nodeCardBox(src);
    const dBox = nodeCardBox(dst);
    const geom = computeEdgeSvgPath(
      src.x + sBox.w / 2,
      src.y + sBox.h / 2,
      dst.x + dBox.w / 2,
      dst.y + dBox.h / 2,
      edgeRouting,
    );

    const isEdgeSelected = edge.id === selectedEdgeId;
    const isIncidentToSelected =
      Boolean(state.activeGraphNodeId) &&
      (edge.sourceId === state.activeGraphNodeId || edge.targetId === state.activeGraphNodeId);

    const pathEl = svgEl('path', {
      d: geom.d,
      fill: 'none',
      stroke: isEdgeSelected
        ? '#f2efe8'
        : isIncidentToSelected
          ? '#c7a97b'
          : edge.color || '#6e7684',
      'stroke-width': isEdgeSelected || isIncidentToSelected ? '2.2' : '1.4',
      'stroke-opacity': queryLower && !isIncidentToSelected ? '0.28' : '0.92',
      'stroke-dasharray': edge.style === 'dashed' ? '5 4' : '',
      'marker-end': 'url(#bv-arrow)',
    });
    pathEl.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedEdgeId = edge.id;
      actions.setState({ activeGraphNodeId: '' }, true);
    });

    const pillW = Math.max(30, edge.label.length * 6.4 + 12);
    const pillEl = svgEl('rect', {
      x: Math.round(geom.labelX - pillW / 2),
      y: Math.round(geom.labelY - 12),
      width: Math.round(pillW),
      height: 16,
      rx: 4,
      fill: '#0b0c10',
      'fill-opacity': showEdgeLabels ? '0.92' : '0',
      stroke: isEdgeSelected ? '#e8e2d5' : '#1f232e',
      'stroke-width': '1',
      visibility: showEdgeLabels ? 'visible' : 'hidden',
    });

    const labelEl = svgEl('text', {
      x: Math.round(geom.labelX),
      y: Math.round(geom.labelY),
      fill: isEdgeSelected || isIncidentToSelected ? '#f2efe8' : '#a2a9b5',
      'font-size': '10.5',
      'text-anchor': 'middle',
      'font-family': 'Inter, sans-serif',
      visibility: showEdgeLabels ? 'visible' : 'hidden',
    });
    labelEl.textContent = edge.label;

    const selectEdge = (e: Event) => {
      e.stopPropagation();
      selectedEdgeId = edge.id;
      actions.setState({ activeGraphNodeId: '' }, true);
    };
    pillEl.addEventListener('click', selectEdge);
    labelEl.addEventListener('click', selectEdge);

    svg.appendChild(pathEl);
    labelLayer.append(pillEl, labelEl);
    edgeRefs.push({ edge, pathEl, labelEl, pillEl });
  }

  svg.append(labelLayer, rubberLine);
  viewport.appendChild(svg);

  // Real-time 60fps edge updater called on EVERY pointermove frame while dragging a node card!
  const updateConnectedEdgesLive = (movedNodeId: string) => {
    for (const ref of edgeRefs) {
      if (ref.edge.sourceId !== movedNodeId && ref.edge.targetId !== movedNodeId) continue;
      const src = nodeMap.get(ref.edge.sourceId);
      const dst = nodeMap.get(ref.edge.targetId);
      if (!src || !dst) continue;
      const sBox = nodeCardBox(src, nodeCards.get(src.id));
      const dBox = nodeCardBox(dst, nodeCards.get(dst.id));
      const geom = computeEdgeSvgPath(
        src.x + sBox.w / 2,
        src.y + sBox.h / 2,
        dst.x + dBox.w / 2,
        dst.y + dBox.h / 2,
        edgeRouting,
      );
      ref.pathEl.setAttribute('d', geom.d);
      const pillW = Math.max(30, ref.edge.label.length * 6.4 + 12);
      ref.pillEl.setAttribute('x', String(Math.round(geom.labelX - pillW / 2)));
      ref.pillEl.setAttribute('y', String(Math.round(geom.labelY - 12)));
      ref.labelEl.setAttribute('x', String(Math.round(geom.labelX)));
      ref.labelEl.setAttribute('y', String(Math.round(geom.labelY)));
    }
  };

  let draggingNodeId: string | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let movedNode = false;

  let portDragSourceId: string | null = null;

  let panning = false;
  let panStartClientX = 0;
  let panStartClientY = 0;
  let panOriginX = 0;
  let panOriginY = 0;

  for (const node of visibleNodes) {
    const isSelected = node.id === state.activeGraphNodeId;
    const isSource = connectMode && node.id === connectSourceId;
    const matchesSearch =
      !queryLower ||
      `${node.label} ${node.subtitle} ${node.notes}`.toLowerCase().includes(queryLower);

    const makePort = (side: 'left' | 'right') =>
      el('div', {
        className: `bv-graph-port is-${side}`,
        tooltip: { title: 'Drag to Connect', short: 'Drag from this port to another node to create a link.' },
        on: {
          pointerdown: (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            portDragSourceId = node.id;
            const box = nodeCardBox(node, nodeCards.get(node.id));
            const sx = side === 'right' ? node.x + box.w : node.x;
            const sy = node.y + box.h / 2;
            rubberLine.setAttribute('d', `M ${sx} ${sy} L ${sx} ${sy}`);
            rubberLine.setAttribute('visibility', 'visible');
          },
        },
      });

    const countBadge = edgeCounts.get(node.id) ?? 0;
    const cardChildren = [
      el(
        'div',
        { className: 'bv-graph-node-head' },
        el('span', {
          className: 'bv-mono-tag',
          text: GRAPH_KIND_LABELS[node.kind],
          style: { color: node.color || GRAPH_KIND_COLORS[node.kind] },
        }),
        graphDensity === 'detailed'
          ? el('span', { className: 'bv-mono-tag', text: `${countBadge} link${countBadge === 1 ? '' : 's'}` })
          : null,
      ),
      el('div', {
        text: node.label,
        style: { fontWeight: '600', fontSize: graphDensity === 'compact' ? '11.5px' : '12.5px' },
      }),
      graphDensity !== 'compact' && node.subtitle
        ? el('div', { className: 'bv-label', text: node.subtitle })
        : null,
      graphDensity === 'detailed' && node.notes
        ? el('div', { className: 'bv-graph-note-excerpt', text: node.notes })
        : null,
      makePort('left'),
      makePort('right'),
    ];

    const card = el(
      'div',
      {
        className: `bv-graph-node is-${graphDensity}${isSelected ? ' is-selected' : ''}${isSource ? ' is-connect-source' : ''}${!matchesSearch ? ' is-dimmed' : ''}`,
        dataset: { nodeId: node.id },
        style: {
          left: `${node.x}px`,
          top: `${node.y}px`,
          borderTop: `3px solid ${node.color || GRAPH_KIND_COLORS[node.kind]}`,
        },
        on: {
          pointerdown: (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (connectMode) {
              if (!connectSourceId) {
                connectSourceId = node.id;
                renderGraphView(container, actions);
              } else if (connectSourceId !== node.id) {
                const srcId = connectSourceId;
                connectSourceId = '';
                connectMode = false;
                let createdEdgeId = '';
                withGraph(actions, (g) => {
                  const res = addGraphEdge(g, srcId, node.id, 'connects to');
                  createdEdgeId = res.edge?.id ?? '';
                  return res.graph;
                }, false);
                selectedEdgeId = createdEdgeId;
                actions.setState({ activeGraphNodeId: '' }, true);
              }
              return;
            }

            draggingNodeId = node.id;
            movedNode = false;
            dragOffsetX = e.clientX / zoomScale - node.x;
            dragOffsetY = e.clientY / zoomScale - node.y;
          },
          dblclick: (e) => {
            e.stopPropagation();
            if (node.kind === 'scene' && node.refId) {
              actions.selectScene(node.refId, true);
            } else if (
              (node.kind === 'character' || node.kind === 'location' || node.kind === 'lore') &&
              node.refId
            ) {
              const cat =
                node.kind === 'character'
                  ? 'characters'
                  : node.kind === 'location'
                    ? 'locations'
                    : 'lore';
              actions.openBibleEntry(cat, node.refId);
            }
          },
        },
      },
      ...cardChildren,
    );
    nodeCards.set(node.id, card);
    viewport.appendChild(card);
  }

  const canvasWrap = el(
    'div',
    {
      className: 'bv-graph-canvas-wrap',
      on: {
        wheel: (e) => {
          e.preventDefault();
          const step = e.deltaY < 0 ? 0.08 : -0.08;
          zoomScale = Math.max(0.45, Math.min(1.8, Number((zoomScale + step).toFixed(2))));
          viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
        },
        pointerdown: (e) => {
          if (e.button !== 0) return;
          panning = true;
          panStartClientX = e.clientX;
          panStartClientY = e.clientY;
          panOriginX = panX;
          panOriginY = panY;
        },
        pointermove: (e) => {
          if (portDragSourceId) {
            const srcNode = nodeMap.get(portDragSourceId);
            if (!srcNode) return;
            const wrapRect = canvasWrap.getBoundingClientRect();
            const curX = (e.clientX - wrapRect.left - panX) / zoomScale;
            const curY = (e.clientY - wrapRect.top - panY) / zoomScale;
            const box = nodeCardBox(srcNode, nodeCards.get(srcNode.id));
            const sx = srcNode.x + box.w / 2;
            const sy = srcNode.y + box.h / 2;
            rubberLine.setAttribute('d', `M ${sx} ${sy} L ${curX.toFixed(1)} ${curY.toFixed(1)}`);
            return;
          }

          if (draggingNodeId) {
            movedNode = true;
            let nx = Math.max(12, Math.round(e.clientX / zoomScale - dragOffsetX));
            let ny = Math.max(12, Math.round(e.clientY / zoomScale - dragOffsetY));
            if (snapToGrid) {
              nx = Math.max(12, Math.round(nx / 24) * 24);
              ny = Math.max(12, Math.round(ny / 24) * 24);
            }
            const targetCard = nodeCards.get(draggingNodeId);
            if (targetCard) {
              targetCard.style.left = `${nx}px`;
              targetCard.style.top = `${ny}px`;
            }
            const nodeRef = nodeMap.get(draggingNodeId);
            if (nodeRef) {
              nodeRef.x = nx;
              nodeRef.y = ny;
            }
            // Live connector update every pointer frame during drag!
            updateConnectedEdgesLive(draggingNodeId);
          } else if (panning) {
            panX = Math.round(panOriginX + (e.clientX - panStartClientX));
            panY = Math.round(panOriginY + (e.clientY - panStartClientY));
            viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
          }
        },
        pointerup: (e) => {
          if (portDragSourceId) {
            const srcId = portDragSourceId;
            portDragSourceId = null;
            rubberLine.setAttribute('visibility', 'hidden');
            const dropTargetEl = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(
              '.bv-graph-node',
            );
            const targetId = dropTargetEl?.dataset.nodeId;
            if (targetId && targetId !== srcId) {
              let createdEdgeId = '';
              withGraph(actions, (g) => {
                const res = addGraphEdge(g, srcId, targetId, 'connects to');
                createdEdgeId = res.edge?.id ?? '';
                return res.graph;
              }, false);
              selectedEdgeId = createdEdgeId;
              actions.setState({ activeGraphNodeId: '' }, true);
            }
            return;
          }

          if (draggingNodeId) {
            const id = draggingNodeId;
            draggingNodeId = null;
            if (movedNode) {
              const moved = nodeMap.get(id);
              if (moved) {
                withGraph(actions, (g) => updateGraphNode(g, id, { x: moved.x, y: moved.y }));
              }
            } else {
              selectedEdgeId = '';
              actions.setState({ activeGraphNodeId: id }, true);
            }
          }
          panning = false;
        },
      },
    },
    viewport,
  );

  // Right Sidebar for selected Node or Edge
  const sidebar = el('aside', { className: 'bv-graph-sidebar' });
  const selectedNode = graph.nodes.find((n) => n.id === state.activeGraphNodeId);
  const selectedEdge = graph.edges.find((e) => e.id === selectedEdgeId);

  if (selectedNode) {
    const labelIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: selectedNode.label },
      on: {
        change: () =>
          withGraph(actions, (g) => updateGraphNode(g, selectedNode.id, { label: labelIn.value })),
      },
    });
    const subIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: selectedNode.subtitle },
      on: {
        change: () =>
          withGraph(actions, (g) =>
            updateGraphNode(g, selectedNode.id, { subtitle: subIn.value }),
          ),
      },
    });
    const kindSel = el(
      'select',
      {
        className: 'bv-input',
        on: {
          change: () =>
            withGraph(actions, (g) =>
              changeGraphNodeKind(g, selectedNode.id, kindSel.value as GraphNodeKind),
            ),
        },
      },
      ...(['character', 'plot', 'location', 'lore', 'scene', 'custom'] as const).map((k) =>
        el('option', {
          text: GRAPH_KIND_LABELS[k],
          attrs: { value: k, selected: selectedNode.kind === k },
        }),
      ),
    );
    const notesIn = el('textarea', {
      className: 'bv-textarea',
      attrs: { rows: 4 },
      on: {
        change: () =>
          withGraph(actions, (g) =>
            updateGraphNode(g, selectedNode.id, { notes: notesIn.value }),
          ),
      },
    });
    notesIn.value = selectedNode.notes;

    const connectedEdges = graph.edges.filter(
      (e) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id,
    );

    const promoteBtn =
      !selectedNode.refId &&
      (selectedNode.kind === 'character' ||
        selectedNode.kind === 'location' ||
        selectedNode.kind === 'lore')
        ? el('button', {
            className: 'bv-btn',
            text: `Add to Story Bible (${GRAPH_KIND_LABELS[selectedNode.kind]})`,
            attrs: { type: 'button' },
            on: {
              click: () => {
                const newRefId = newId('bib');
                actions.mutateProject((prev) => {
                  const next = normalizeProjectDefaults(prev);
                  if (selectedNode.kind === 'character') {
                    next.bible.characters.push({
                      id: newRefId,
                      name: selectedNode.label,
                      aliases: '',
                      role: selectedNode.subtitle || 'Character',
                      motivation: selectedNode.notes,
                      appearance: '',
                      notes: '',
                      customFields: [],
                    });
                  } else if (selectedNode.kind === 'location') {
                    next.bible.locations.push({
                      id: newRefId,
                      name: selectedNode.label,
                      region: selectedNode.subtitle || '',
                      atmosphere: selectedNode.notes,
                      notes: '',
                      customFields: [],
                    });
                  } else {
                    next.bible.lore.push({
                      id: newRefId,
                      name: selectedNode.label,
                      category: selectedNode.subtitle || 'Lore',
                      summary: selectedNode.notes,
                      notes: '',
                      customFields: [],
                    });
                  }
                  next.storyGraph = updateGraphNode(next.storyGraph!, selectedNode.id, {
                    refId: newRefId,
                  });
                  return next;
                });
                actions.notify(`Added “${selectedNode.label}” to Story Bible`);
              },
            },
          })
        : null;

    sidebar.append(
      el('span', { className: 'bv-panel-title', text: 'Node Properties' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Title' }), labelIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Interchange Type' }), kindSel),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Subtitle / Role' }), subIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Plot / Link Notes' }), notesIn),
      el('div', {
        className: 'bv-mono-tag',
        text: `${connectedEdges.length} connection(s)`,
      }),
    );
    if (promoteBtn) sidebar.appendChild(promoteBtn);
    sidebar.append(
      el('button', {
        className: 'bv-btn',
        text: 'Connect From This Node',
        attrs: { type: 'button' },
        on: {
          click: () => {
            connectMode = true;
            connectSourceId = selectedNode.id;
            renderGraphView(container, actions);
          },
        },
      }),
      el(
        'button',
        {
          className: 'bv-mini-btn',
          attrs: { type: 'button' },
          on: {
            click: () => {
              withGraph(actions, (g) => deleteGraphNode(g, selectedNode.id), false);
              actions.setState({ activeGraphNodeId: '' }, true);
            },
          },
        },
        icon('trash', 12),
        'Delete Node',
      ),
    );
  } else if (selectedEdge) {
    const edgeLabelIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: selectedEdge.label },
      on: {
        change: () =>
          withGraph(actions, (g) =>
            updateGraphEdge(g, selectedEdge.id, { label: edgeLabelIn.value }),
          ),
      },
    });
    const styleSel = el(
      'select',
      {
        className: 'bv-input',
        on: {
          change: () =>
            withGraph(actions, (g) =>
              updateGraphEdge(g, selectedEdge.id, {
                style: styleSel.value as 'solid' | 'dashed',
              }),
            ),
        },
      },
      el('option', { text: 'Solid Line', attrs: { value: 'solid', selected: selectedEdge.style === 'solid' } }),
      el('option', { text: 'Dashed Line', attrs: { value: 'dashed', selected: selectedEdge.style === 'dashed' } }),
    );

    sidebar.append(
      el('span', { className: 'bv-panel-title', text: 'Connection Properties' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Relationship Label' }), edgeLabelIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Line Style' }), styleSel),
      el('button', {
        className: 'bv-btn',
        text: 'Reverse Direction',
        attrs: { type: 'button' },
        on: {
          click: () => withGraph(actions, (g) => reverseGraphEdge(g, selectedEdge.id)),
        },
      }),
      el(
        'button',
        {
          className: 'bv-mini-btn',
          attrs: { type: 'button' },
          on: {
            click: () => {
              withGraph(actions, (g) => deleteGraphEdge(g, selectedEdge.id), false);
              selectedEdgeId = '';
              renderGraphView(container, actions);
            },
          },
        },
        icon('trash', 12),
        'Delete Connection',
      ),
    );
  } else {
    sidebar.append(
      el('span', { className: 'bv-panel-title', text: 'Story Graph' }),
      el('p', {
        className: 'bv-label',
        text: 'Drag any card and connecting lines follow live. Drag from a port dot on the edge of a card onto another card to link them. Double-click a linked Scene or Bible node to open it.',
      }),
      el('div', {
        className: 'bv-mono-tag',
        text: `${graph.nodes.length} nodes · ${graph.edges.length} connections`,
      }),
    );
  }

  const layout = el('div', { className: 'bv-graph-layout' }, canvasWrap, sidebar);
  container.append(subbar, layout);
}
