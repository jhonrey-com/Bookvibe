import type { AppActions } from '../core/app-context';
import {
  GRAPH_KIND_COLORS,
  GRAPH_KIND_LABELS,
  addGraphEdge,
  addGraphNode,
  applyAutoLayout,
  changeGraphNodeKind,
  deleteGraphEdge,
  deleteGraphNode,
  reverseGraphEdge,
  seedGraphFromProject,
  updateGraphEdge,
  updateGraphNode,
} from '../core/graph';
import { normalizeProjectDefaults } from '../core/library';
import { newId } from '../core/manuscript';
import type { GraphNodeKind, StoryGraph } from '../core/types';
import { clearNode, el, icon, svgEl } from '../ui/dom';

let zoomScale = 1;
let panX = 0;
let panY = 0;
let selectedEdgeId = '';
let connectMode = false;
let connectSourceId = '';
let activeKindFilter: GraphNodeKind | 'all' = 'all';

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

export function renderGraphView(container: HTMLElement, actions: AppActions): void {
  clearNode(container);
  const state = actions.getState();
  const project = normalizeProjectDefaults(state.project);
  const graph = project.storyGraph!;

  if (
    state.activeGraphNodeId &&
    !graph.nodes.some((n) => n.id === state.activeGraphNodeId)
  ) {
    state.activeGraphNodeId = graph.nodes[0]?.id ?? '';
  }

  const filterSelect = el(
    'select',
    {
      className: 'bv-select',
      attrs: { 'aria-label': 'Filter graph node types' },
      on: {
        change: () => {
          activeKindFilter = filterSelect.value as GraphNodeKind | 'all';
          renderGraphView(container, actions);
        },
      },
    },
    el('option', {
      text: 'All Node Types',
      attrs: { value: 'all', selected: activeKindFilter === 'all' },
    }),
    ...(['character', 'plot', 'scene', 'location', 'lore', 'custom'] as const).map((k) =>
      el('option', {
        text: GRAPH_KIND_LABELS[k],
        attrs: { value: k, selected: activeKindFilter === k },
      }),
    ),
  );

  const newKindSelect = el(
    'select',
    {
      className: 'bv-select',
      attrs: { 'aria-label': 'New node type' },
    },
    ...(['character', 'plot', 'location', 'lore', 'scene', 'custom'] as const).map((k) =>
      el('option', { text: GRAPH_KIND_LABELS[k], attrs: { value: k } }),
    ),
  );

  const newLabelInput = el('input', {
    className: 'bv-input',
    style: { width: '148px', height: '28px' },
    attrs: { type: 'text', placeholder: 'Node title…', 'aria-label': 'New graph node title' },
  });

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
        text: connectMode ? 'Connect: Click 2 Nodes…' : 'Connect Nodes',
        attrs: { type: 'button', title: 'Click two nodes to create a relationship edge' },
        on: {
          click: () => {
            connectMode = !connectMode;
            connectSourceId = '';
            renderGraphView(container, actions);
          },
        },
      }),
    ),
    el(
      'div',
      { className: 'bv-subbar-group' },
      filterSelect,
      el('button', {
        className: 'bv-fmt-btn',
        text: 'Sync from Book',
        attrs: { type: 'button', title: 'Refresh nodes & links from Story Bible and Scenes' },
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
        className: 'bv-fmt-btn',
        text: 'Auto-Layout',
        attrs: { type: 'button' },
        on: {
          click: () => {
            panX = 0;
            panY = 0;
            zoomScale = 1;
            withGraph(actions, (g) => applyAutoLayout(g));
          },
        },
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: '−',
        attrs: { type: 'button', title: 'Zoom Out' },
        on: {
          click: () => {
            zoomScale = Math.max(0.55, Number((zoomScale - 0.1).toFixed(2)));
            renderGraphView(container, actions);
          },
        },
      }),
      el('span', { className: 'bv-mono-tag', text: `${Math.round(zoomScale * 100)}%` }),
      el('button', {
        className: 'bv-mini-btn',
        text: '+',
        attrs: { type: 'button', title: 'Zoom In' },
        on: {
          click: () => {
            zoomScale = Math.min(1.6, Number((zoomScale + 0.1).toFixed(2)));
            renderGraphView(container, actions);
          },
        },
      }),
    ),
  );

  const visibleNodes = graph.nodes.filter(
    (n) => activeKindFilter === 'all' || n.kind === activeKindFilter,
  );
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = graph.edges.filter(
    (e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId),
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

  const nodeMap = new Map(visibleNodes.map((n) => [n.id, n]));
  for (const edge of visibleEdges) {
    const src = nodeMap.get(edge.sourceId);
    const dst = nodeMap.get(edge.targetId);
    if (!src || !dst) continue;

    const sx = src.x + 80;
    const sy = src.y + 28;
    const tx = dst.x + 80;
    const ty = dst.y + 28;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const isEdgeSelected = edge.id === selectedEdgeId;

    const line = svgEl('line', {
      x1: sx,
      y1: sy,
      x2: tx,
      y2: ty,
      stroke: isEdgeSelected ? '#e8e2d5' : edge.color || '#6e7684',
      'stroke-width': isEdgeSelected ? '2.4' : '1.5',
      'stroke-dasharray': edge.style === 'dashed' ? '5 4' : '',
      'marker-end': 'url(#bv-arrow)',
    });
    line.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedEdgeId = edge.id;
      actions.setState({ activeGraphNodeId: '' }, true);
    });

    const label = svgEl('text', {
      x: mx,
      y: my - 6,
      fill: isEdgeSelected ? '#ffffff' : '#a2a9b5',
      'font-size': '11',
      'text-anchor': 'middle',
      'font-family': 'Inter, sans-serif',
    });
    label.textContent = edge.label;
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedEdgeId = edge.id;
      actions.setState({ activeGraphNodeId: '' }, true);
    });

    svg.append(line, label);
  }
  viewport.appendChild(svg);

  // Render draggable graph nodes
  let draggingNodeId: string | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let movedNode = false;

  let panning = false;
  let panStartClientX = 0;
  let panStartClientY = 0;
  let panOriginX = 0;
  let panOriginY = 0;

  const nodeCards = new Map<string, HTMLElement>();

  for (const node of visibleNodes) {
    const isSelected = node.id === state.activeGraphNodeId;
    const isSource = connectMode && node.id === connectSourceId;

    const card = el(
      'div',
      {
        className: `bv-graph-node${isSelected ? ' is-selected' : ''}${isSource ? ' is-connect-source' : ''}`,
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
      el('div', {
        className: 'bv-mono-tag',
        text: GRAPH_KIND_LABELS[node.kind],
        style: { color: node.color || GRAPH_KIND_COLORS[node.kind], marginBottom: '2px' },
      }),
      el('div', { text: node.label, style: { fontWeight: '600', fontSize: '12.5px' } }),
      node.subtitle
        ? el('div', { className: 'bv-label', text: node.subtitle })
        : null,
    );
    nodeCards.set(node.id, card);
    viewport.appendChild(card);
  }

  const canvasWrap = el(
    'div',
    {
      className: 'bv-graph-canvas-wrap',
      on: {
        pointerdown: (e) => {
          if (e.button !== 0) return;
          panning = true;
          panStartClientX = e.clientX;
          panStartClientY = e.clientY;
          panOriginX = panX;
          panOriginY = panY;
        },
        pointermove: (e) => {
          if (draggingNodeId) {
            movedNode = true;
            const nx = Math.max(12, Math.round(e.clientX / zoomScale - dragOffsetX));
            const ny = Math.max(12, Math.round(e.clientY / zoomScale - dragOffsetY));
            const targetCard = nodeCards.get(draggingNodeId);
            if (targetCard) {
              targetCard.style.left = `${nx}px`;
              targetCard.style.top = `${ny}px`;
            }
            const nodeRef = graph.nodes.find((n) => n.id === draggingNodeId);
            if (nodeRef) {
              nodeRef.x = nx;
              nodeRef.y = ny;
            }
          } else if (panning) {
            panX = Math.round(panOriginX + (e.clientX - panStartClientX));
            panY = Math.round(panOriginY + (e.clientY - panStartClientY));
            viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
          }
        },
        pointerup: () => {
          if (draggingNodeId) {
            const id = draggingNodeId;
            draggingNodeId = null;
            if (movedNode) {
              const moved = graph.nodes.find((n) => n.id === id);
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

  // Right Inspector Sidebar for selected Node or Edge
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
                actions.notify(`Promoted “${selectedNode.label}” to Story Bible`);
              },
            },
          })
        : null;

    sidebar.append(
      el('span', { className: 'bv-panel-title', text: 'Node Properties' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Title' }), labelIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Interchange Node Type' }), kindSel),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Subtitle / Role' }), subIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Plot / Relationship Notes' }), notesIn),
    );
    if (promoteBtn) sidebar.appendChild(promoteBtn);
    sidebar.append(
      el(
        'button',
        {
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
        },
      ),
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
        text: 'Drag any node to rearrange. Click a node or edge line to inspect, edit labels, or interchange types. Double-click a linked Scene or Bible node to open it.',
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
