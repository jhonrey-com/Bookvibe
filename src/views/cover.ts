import type { AppActions } from '../core/app-context';
import {
  BUILT_IN_COVER_ORNAMENTS,
  COVER_TEMPLATES,
  computeCoverBackgroundCss,
  computeSmartAlignSnap,
  createGraphicLayerFromDataUrl,
  createShapeLayer,
  createTextLayer,
  defaultBookCover,
  downscaleImageFileToDataUrl,
  encodeSvgStringToDataUrl,
  estimateSpineInches,
} from '../core/cover';
import { TRIM_SPECS } from '../core/export';
import { getAllAvailableFontChoices, resolveEffectiveFontCss } from '../core/fonts';
import { ensureAuthorIdentity } from '../core/identity';
import { normalizeProjectDefaults } from '../core/library';
import { newId } from '../core/manuscript';
import type {
  BookCoverConfig,
  CoverFaceId,
  CoverShapeKind,
  CoverTemplateId,
  ToolbarDisplayMode,
} from '../core/types';
import { attachContextMenu } from '../ui/context-menu';
import { clearNode, el, icon, type IconName } from '../ui/dom';
import { createVerticalResizer } from '../ui/resizer';

type CoverPreviewMode = 'front' | 'back' | 'spine' | 'full-wrap' | 'dust-jacket';
type CoverElementKey = keyof BookCoverConfig['elements'];
type StudioToolTab = 'templates' | 'text' | 'shapes' | 'ornaments' | 'uploads' | 'background' | 'jacket';
type InspectorTab = 'properties' | 'layers';

let coverWrapMode: CoverPreviewMode = 'front';
let activeToolTab: StudioToolTab = 'templates';
let activeInspectorTab: InspectorTab = 'properties';
let activeSelectionKind: 'element' | 'text' | 'shape' | 'graphic' = 'element';
let activeElementKey: CoverElementKey = 'title';
let activeLayerId = '';
let studioZoom = 1.0;

let savedStudioLeftScroll = 0;
let savedStudioRightScroll = 0;
let savedStudioStageScrollTop = 0;

const undoStack: BookCoverConfig[] = [];
const redoStack: BookCoverConfig[] = [];
const MAX_UNDO = 30;

function activeTargetFace(): CoverFaceId {
  if (coverWrapMode === 'back' || coverWrapMode === 'spine') return coverWrapMode;
  return 'front';
}

function recordCoverUndoSnapshot(cover: BookCoverConfig): void {
  undoStack.push(structuredClone(cover));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function captureStudioScroll(root?: HTMLElement): void {
  const scope = root ?? document;
  const left = scope.querySelector('.qv-studio-left-body') as HTMLElement | null;
  const right = scope.querySelector('.qv-studio-right-body') as HTMLElement | null;
  const stage = scope.querySelector('.qv-studio-canvas-scroll') as HTMLElement | null;
  if (left) savedStudioLeftScroll = left.scrollTop;
  if (right) savedStudioRightScroll = right.scrollTop;
  if (stage) savedStudioStageScrollTop = stage.scrollTop;
}

function mutateCover(
  actions: AppActions,
  updater: (cover: BookCoverConfig) => BookCoverConfig,
  rerender = true,
  pushUndo = true,
): void {
  captureStudioScroll();
  actions.mutateProject((prev) => {
    const next = normalizeProjectDefaults(prev);
    const currentCover = next.cover ?? defaultBookCover(next);
    if (pushUndo) {
      recordCoverUndoSnapshot(currentCover);
    }
    next.cover = updater(currentCover);
    return next;
  }, rerender);
}

export function hasCoverHistory(): { undo: boolean; redo: boolean } {
  return { undo: undoStack.length > 0, redo: redoStack.length > 0 };
}

export function performCoverUndo(actions: AppActions): boolean {
  if (undoStack.length === 0) {
    actions.notify('Nothing to undo in Cover Studio.');
    return false;
  }
  const previous = undoStack.pop()!;
  const current = actions.getState().project.cover;
  if (current) {
    redoStack.push(structuredClone(current));
  }
  captureStudioScroll();
  actions.mutateProject((prev) => {
    const next = normalizeProjectDefaults(prev);
    next.cover = structuredClone(previous);
    return next;
  }, true);
  actions.notify('Undid cover edit');
  return true;
}

export function performCoverRedo(actions: AppActions): boolean {
  if (redoStack.length === 0) {
    actions.notify('Nothing to redo in Cover Studio.');
    return false;
  }
  const restored = redoStack.pop()!;
  const current = actions.getState().project.cover;
  if (current) {
    undoStack.push(structuredClone(current));
  }
  captureStudioScroll();
  actions.mutateProject((prev) => {
    const next = normalizeProjectDefaults(prev);
    next.cover = structuredClone(restored);
    return next;
  }, true);
  actions.notify('Redid cover edit');
  return true;
}

function applyDragToStyle(node: HTMLElement, xPct: number, yPct: number, rotDeg = 0, flipX = false, flipY = false): void {
  node.style.left = `${xPct}%`;
  node.style.top = `${yPct}%`;
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  node.style.transform = `translate(-50%, -50%) rotate(${rotDeg}deg) scale(${sx}, ${sy})`;
}

export function renderCoverStudio(container: HTMLElement, actions: AppActions): void {
  captureStudioScroll(container);
  clearNode(container);

  const state = actions.getState();
  const project = normalizeProjectDefaults(state.project);
  const cover = project.cover ?? defaultBookCover(project);
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author;
  const trim = TRIM_SPECS[project.typography.trimSize];

  const graphicLayers = cover.graphicLayers ?? [];
  const shapeLayers = cover.shapeLayers ?? [];
  const textLayers = cover.textLayers ?? [];

  const frontW = Math.round(trim.widthIn * 64);
  const frontH = Math.round(trim.heightIn * 64);
  const spineInches = estimateSpineInches(project);
  const snapGridEnabled = cover.snapToGrid !== false;
  const showGridOverlay = Boolean(cover.showGrid);
  const showBleedGuides = cover.showGuides !== false;
  const gridStepPct = Math.max(2, Math.min(10, cover.gridSizePx ?? 4));
  const detailMode: ToolbarDisplayMode = state.settings.toolbarDisplayMode;

  const selectedTextLayer = activeSelectionKind === 'text'
    ? textLayers.find((t) => t.id === activeLayerId) ?? null
    : null;
  const selectedShapeLayer = activeSelectionKind === 'shape'
    ? shapeLayers.find((s) => s.id === activeLayerId) ?? null
    : null;
  const selectedGraphicLayer = activeSelectionKind === 'graphic'
    ? graphicLayers.find((g) => g.id === activeLayerId) ?? null
    : null;

  // Fallback safely if activeLayerId was deleted
  if (
    (activeSelectionKind === 'text' && !selectedTextLayer) ||
    (activeSelectionKind === 'shape' && !selectedShapeLayer) ||
    (activeSelectionKind === 'graphic' && !selectedGraphicLayer)
  ) {
    activeSelectionKind = 'element';
    activeElementKey = 'title';
    activeLayerId = '';
  }

  // Hidden file pickers
  const artFileInput = el('input', {
    attrs: { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.svg' },
    style: { display: 'none' },
    on: {
      change: async () => {
        const file = artFileInput.files?.[0];
        artFileInput.value = '';
        if (!file) return;
        try {
          const url = await downscaleImageFileToDataUrl(file, 1400);
          mutateCover(actions, (c) => ({ ...c, backgroundImageDataUrl: url }));
          actions.notify('Updated front cover background image');
        } catch (err) {
          actions.notify(err instanceof Error ? err.message : 'Cover upload failed.');
        }
      },
    },
  });

  const layerFileInput = el('input', {
    attrs: { type: 'file', accept: '.svg,image/svg+xml,image/png,image/webp,image/jpeg' },
    style: { display: 'none' },
    on: {
      change: async () => {
        const file = layerFileInput.files?.[0];
        layerFileInput.value = '';
        if (!file) return;
        await addDroppedGraphicToFace(activeTargetFace(), file);
      },
    },
  });

  const addDroppedGraphicToFace = async (face: CoverFaceId, file: File) => {
    try {
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      const url = await downscaleImageFileToDataUrl(file, 1000);
      const layer = createGraphicLayerFromDataUrl(face, file.name, url, isSvg ? 'svg' : 'image');
      activeSelectionKind = 'graphic';
      activeLayerId = layer.id;
      mutateCover(actions, (c) => ({
        ...c,
        graphicLayers: [...(c.graphicLayers ?? []), layer],
      }));
      actions.notify(`Placed "${layer.name}" on ${face} cover`);
    } catch (err) {
      actions.notify(err instanceof Error ? err.message : 'Unsupported image or SVG file.');
    }
  };

  // --- Studio Top Command Bar (Face, Undo/Redo, Grid/Snap/Guides, Zoom, Detail Mode, Export) ---
  const wrapModeSel = el(
    'select',
    {
      className: 'bv-select',
      attrs: { 'aria-label': 'Cover face view' },
      on: {
        change: () => {
          coverWrapMode = wrapModeSel.value as CoverPreviewMode;
          renderCoverStudio(container, actions);
        },
      },
    },
    el('option', { text: 'Front Cover', attrs: { value: 'front', selected: coverWrapMode === 'front' } }),
    el('option', { text: 'Back Cover', attrs: { value: 'back', selected: coverWrapMode === 'back' } }),
    el('option', { text: `Spine (${spineInches}")`, attrs: { value: 'spine', selected: coverWrapMode === 'spine' } }),
    el('option', { text: 'Full Print Wrap', attrs: { value: 'full-wrap', selected: coverWrapMode === 'full-wrap' } }),
    el('option', { text: 'Dust Jacket (+ Flaps)', attrs: { value: 'dust-jacket', selected: coverWrapMode === 'dust-jacket' } }),
  );

  const detailModeSel = el(
    'select',
    {
      className: 'bv-select',
      attrs: { 'aria-label': 'Studio tool detail level' },
      on: {
        change: () => {
          actions.updateSettings({ toolbarDisplayMode: detailModeSel.value as ToolbarDisplayMode });
          actions.setState({}, true);
        },
      },
    },
    el('option', { text: 'Icons Only', attrs: { value: 'icons', selected: detailMode === 'icons' } }),
    el('option', { text: 'Balanced Labels', attrs: { value: 'balanced', selected: detailMode === 'balanced' } }),
    el('option', { text: 'Full Details', attrs: { value: 'detailed', selected: detailMode === 'detailed' } }),
  );

  const makeToolToggleBtn = (
    ic: IconName,
    label: string,
    active: boolean,
    titleTip: string,
    onClick: () => void,
    disabled = false,
  ) =>
    el(
      'button',
      {
        className: `bv-fmt-btn qv-studio-toolbtn${active ? ' is-active' : ''}`,
        attrs: { type: 'button', 'aria-label': label, disabled: disabled ? true : undefined },
        tooltip: { title: label, short: titleTip },
        on: { click: onClick },
      },
      icon(ic, 14),
      detailMode !== 'icons' ? el('span', { className: 'qv-tool-label', text: label }) : null,
    );

  const studioBar = el(
    'div',
    { className: 'qv-studio-topbar' },
    el(
      'div',
      { className: 'bv-subbar-group' },
      wrapModeSel,
      makeToolToggleBtn('undo', 'Undo', false, 'Undo last cover edit (Ctrl+Z)', () => performCoverUndo(actions), undoStack.length === 0),
      makeToolToggleBtn('redo', 'Redo', false, 'Redo undone cover edit (Ctrl+Y)', () => performCoverRedo(actions), redoStack.length === 0),
      makeToolToggleBtn(
        'grid-snap',
        'Grid',
        showGridOverlay,
        'Toggle visual alignment grid overlay',
        () => mutateCover(actions, (c) => ({ ...c, showGrid: !showGridOverlay }), true, false),
      ),
      makeToolToggleBtn(
        'magnet',
        'Snap',
        snapGridEnabled,
        'Snap layers to grid intervals and magnetic center guides',
        () => mutateCover(actions, (c) => ({ ...c, snapToGrid: !snapGridEnabled }), true, false),
      ),
      makeToolToggleBtn(
        'guides',
        'Bleed',
        showBleedGuides,
        'Show print trim and 0.125" safe-zone guides',
        () => mutateCover(actions, (c) => ({ ...c, showGuides: !showBleedGuides }), true, false),
      ),
    ),
    el(
      'div',
      { className: 'bv-subbar-group' },
      makeToolToggleBtn('zoom-out', 'Zoom Out', false, 'Zoom canvas out', () => {
        studioZoom = Math.max(0.55, Number((studioZoom - 0.1).toFixed(2)));
        renderCoverStudio(container, actions);
      }),
      el('button', {
        className: 'bv-mini-btn',
        text: `${Math.round(studioZoom * 100)}%`,
        tooltip: { title: 'Reset Zoom', short: 'Click to reset canvas scale to 100%.' },
        attrs: { type: 'button' },
        on: {
          click: () => {
            studioZoom = 1;
            renderCoverStudio(container, actions);
          },
        },
      }),
      makeToolToggleBtn('zoom-in', 'Zoom In', false, 'Zoom canvas in', () => {
        studioZoom = Math.min(1.85, Number((studioZoom + 0.1).toFixed(2)));
        renderCoverStudio(container, actions);
      }),
      detailModeSel,
      el(
        'button',
        {
          className: 'bv-btn',
          attrs: { type: 'button' },
          tooltip: { title: 'Print Interior PDF', short: 'Print formatted pages or save to PDF.' },
          on: { click: () => actions.printTypeset() },
        },
        icon('printer', 13),
        'Print',
      ),
      el(
        'button',
        {
          className: 'bv-btn',
          attrs: { type: 'button' },
          tooltip: { title: 'Export Interior PDF (.pdf)', short: 'Generate trim-sized print interior PDF file.' },
          on: { click: () => void actions.exportPdf() },
        },
        icon('download', 13),
        'PDF',
      ),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-primary',
          attrs: { type: 'button' },
          on: { click: () => void actions.exportCoverPng() },
        },
        icon('download', 13),
        'PNG',
      ),
    ),
  );

  // --- Left Vector & Layout Tool Rail + Drawer ---
  const toolTabs: Array<{ id: StudioToolTab; ic: IconName; label: string; desc: string }> = [
    { id: 'templates', ic: 'cover', label: 'Templates', desc: 'Style presets & palette' },
    { id: 'text', ic: 'type-tool', label: 'Text', desc: 'Add display headlines' },
    { id: 'shapes', ic: 'shapes', label: 'Shapes', desc: 'Vector geometry & rules' },
    { id: 'ornaments', ic: 'ornament', label: 'Elements', desc: 'Seals, dividers & crests' },
    { id: 'uploads', ic: 'image', label: 'Uploads', desc: 'SVG & transparent PNGs' },
    { id: 'background', ic: 'palette', label: 'Backdrop', desc: 'Gradients & photo FX' },
    { id: 'jacket', ic: 'book', label: 'Jacket', desc: 'Back, spine & flaps' },
  ];

  const rail = el('nav', { className: 'qv-studio-rail', attrs: { 'aria-label': 'Cover design tools' } });
  for (const t of toolTabs) {
    rail.appendChild(
      el(
        'button',
        {
          className: `qv-rail-btn${activeToolTab === t.id ? ' is-active' : ''}`,
          attrs: { type: 'button', 'aria-label': t.label },
          tooltip: { title: t.label, short: t.desc },
          on: {
            click: () => {
              activeToolTab = t.id;
              renderCoverStudio(container, actions);
            },
          },
        },
        icon(t.ic, 17),
        detailMode !== 'icons' ? el('span', { className: 'qv-rail-label', text: t.label }) : null,
      ),
    );
  }

  const leftBody = el('div', { className: 'qv-studio-left-body' });
  const fontChoices = getAllAvailableFontChoices();

  if (activeToolTab === 'templates') {
    const presetGrid = el('div', { className: 'qv-template-grid' });
    for (const preset of COVER_TEMPLATES) {
      presetGrid.appendChild(
        el(
          'button',
          {
            className: `qv-template-swatch${cover.template === preset.id ? ' is-active' : ''}`,
            attrs: { type: 'button' },
            on: {
              click: () =>
                mutateCover(actions, (c) => ({
                  ...c,
                  template: preset.id as CoverTemplateId,
                  backgroundColor: preset.backgroundColor,
                  backBackgroundColor: preset.backgroundColor,
                  spineBackgroundColor: preset.backgroundColor,
                  accentColor: preset.accentColor,
                  textColor: preset.textColor,
                })),
            },
          },
          el('span', {
            className: 'qv-swatch-chip',
            style: { background: preset.backgroundColor, borderColor: preset.accentColor },
          }),
          el('span', { className: 'qv-swatch-name', text: preset.label }),
        ),
      );
    }

    const coverFontSel = el(
      'select',
      {
        className: 'bv-input',
        on: {
          change: () =>
            mutateCover(actions, (c) => ({
              ...c,
              customFontFamily: coverFontSel.value || undefined,
            })),
        },
      },
      el('option', {
        text: 'Use Interior Book Typeface',
        attrs: { value: '', selected: !cover.customFontFamily },
      }),
      ...fontChoices.map((f) =>
        el('option', {
          text: f.label,
          attrs: { value: f.id, selected: cover.customFontFamily === f.id },
        }),
      ),
    );

    const colorInput = (val: string, cb: (hex: string) => void) =>
      el('input', {
        attrs: { type: 'color', value: val },
        style: { width: '100%', height: '30px', border: '1px solid var(--border-hairline)', background: 'transparent', borderRadius: '4px', cursor: 'pointer' },
        on: { change: (e) => cb((e.target as HTMLInputElement).value) },
      });

    leftBody.append(
      el('span', { className: 'bv-panel-title', text: 'Style Templates' }),
      presetGrid,
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Master Cover Font' }), coverFontSel),
      el(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' } },
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Front' }), colorInput(cover.backgroundColor, (v) => mutateCover(actions, (c) => ({ ...c, backgroundColor: v })))),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back' }), colorInput(cover.backBackgroundColor || cover.backgroundColor, (v) => mutateCover(actions, (c) => ({ ...c, backBackgroundColor: v })))),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Spine' }), colorInput(cover.spineBackgroundColor || cover.backgroundColor, (v) => mutateCover(actions, (c) => ({ ...c, spineBackgroundColor: v })))),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Accent' }), colorInput(cover.accentColor, (v) => mutateCover(actions, (c) => ({ ...c, accentColor: v })))),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Ink' }), colorInput(cover.textColor, (v) => mutateCover(actions, (c) => ({ ...c, textColor: v })))),
      ),
    );
  } else if (activeToolTab === 'text') {
    const addTextBtn = (label: string, sample: string, size: number, weight: '400' | '500' | '600' | '700', upper = false) =>
      el(
        'button',
        {
          className: 'bv-btn',
          style: { justifyContent: 'flex-start', width: '100%' },
          attrs: { type: 'button' },
          on: {
            click: () => {
              const created = createTextLayer(activeTargetFace(), sample, cover.textColor);
              created.fontSize = size;
              created.fontWeight = weight;
              created.uppercase = upper;
              activeSelectionKind = 'text';
              activeLayerId = created.id;
              mutateCover(actions, (c) => ({
                ...c,
                textLayers: [...(c.textLayers ?? []), created],
              }));
            },
          },
        },
        icon('type-tool', 14),
        label,
      );

    leftBody.append(
      el('span', { className: 'bv-panel-title', text: 'Add Typography Layers' }),
      addTextBtn('Display Headline', 'A NEW EDITION', 28, '700', true),
      addTextBtn('Review / Praise Quote', '“A luminous work of rare craft.” — Review', 13, '400', false),
      addTextBtn('Award / Series Tagline', 'VOLUME ONE · UNABRIDGED', 11, '600', true),
      el('span', { className: 'bv-panel-title', text: 'Core Book Fields', style: { marginTop: '8px' } }),
      ...(['title', 'subtitle', 'author', 'edition', 'signature'] as CoverElementKey[]).map((key) =>
        el('button', {
          className: `bv-mini-btn${activeSelectionKind === 'element' && activeElementKey === key ? ' is-active' : ''}`,
          text: ['Select', key.charAt(0).toUpperCase() + key.slice(1)].join(' '),
          attrs: { type: 'button' },
          on: {
            click: () => {
              activeSelectionKind = 'element';
              activeElementKey = key;
              activeInspectorTab = 'properties';
              renderCoverStudio(container, actions);
            },
          },
        }),
      ),
    );
  } else if (activeToolTab === 'shapes') {
    const shapesCatalog: Array<{ kind: CoverShapeKind; label: string }> = [
      { kind: 'rect', label: 'Solid Block / Panel' },
      { kind: 'rounded-rect', label: 'Rounded Card Box' },
      { kind: 'circle', label: 'Geometric Circle Seal' },
      { kind: 'line', label: 'Horizontal Rule Line' },
      { kind: 'frame', label: 'Foil Border Frame' },
      { kind: 'badge', label: 'Top Ribbon Pill' },
    ];
    leftBody.append(
      el('span', { className: 'bv-panel-title', text: 'Vector Shapes & Frames' }),
      ...shapesCatalog.map((item) =>
        el(
          'button',
          {
            className: 'bv-btn',
            style: { justifyContent: 'flex-start', width: '100%' },
            attrs: { type: 'button' },
            on: {
              click: () => {
                const shape = createShapeLayer(activeTargetFace(), item.kind, cover.accentColor);
                activeSelectionKind = 'shape';
                activeLayerId = shape.id;
                mutateCover(actions, (c) => ({
                  ...c,
                  shapeLayers: [...(c.shapeLayers ?? []), shape],
                }));
              },
            },
          },
          icon('shapes', 14),
          item.label,
        ),
      ),
    );
  } else if (activeToolTab === 'ornaments') {
    leftBody.append(
      el('span', { className: 'bv-panel-title', text: 'Vector Ornaments & Emblems' }),
      ...BUILT_IN_COVER_ORNAMENTS.map((orn) =>
        el(
          'button',
          {
            className: 'bv-btn',
            style: { justifyContent: 'flex-start', width: '100%' },
            attrs: { type: 'button' },
            on: {
              click: () => {
                const layer = createGraphicLayerFromDataUrl(
                  activeTargetFace(),
                  orn.name,
                  encodeSvgStringToDataUrl(orn.svgMarkup),
                  'svg',
                );
                activeSelectionKind = 'graphic';
                activeLayerId = layer.id;
                mutateCover(actions, (c) => ({
                  ...c,
                  graphicLayers: [...(c.graphicLayers ?? []), layer],
                }));
              },
            },
          },
          icon('ornament', 14),
          orn.name,
        ),
      ),
    );
  } else if (activeToolTab === 'uploads') {
    leftBody.append(
      el('span', { className: 'bv-panel-title', text: 'Upload Graphics & Artwork' }),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-primary',
          attrs: { type: 'button' },
          on: { click: () => layerFileInput.click() },
        },
        icon('image', 14),
        'Add SVG / Transparent PNG…',
      ),
      el(
        'button',
        {
          className: 'bv-btn',
          attrs: { type: 'button' },
          on: { click: () => artFileInput.click() },
        },
        cover.backgroundImageDataUrl ? 'Replace Cover Background…' : 'Upload Full Cover Photo…',
      ),
      ...(cover.backgroundImageDataUrl
        ? [
            el('button', {
              className: 'bv-mini-btn',
              text: 'Remove Background Photo',
              attrs: { type: 'button' },
              on: { click: () => mutateCover(actions, (c) => ({ ...c, backgroundImageDataUrl: '' })) },
            }),
          ]
        : []),
      artFileInput,
      layerFileInput,
    );
  } else if (activeToolTab === 'background') {
    const bgModeSel = el(
      'select',
      {
        className: 'bv-input',
        on: {
          change: () =>
            mutateCover(actions, (c) => ({
              ...c,
              bgMode: bgModeSel.value as 'solid' | 'linear-gradient' | 'radial-gradient',
            })),
        },
      },
      el('option', { text: 'Solid Color', attrs: { value: 'solid', selected: (cover.bgMode ?? 'solid') === 'solid' } }),
      el('option', { text: 'Linear Gradient', attrs: { value: 'linear-gradient', selected: cover.bgMode === 'linear-gradient' } }),
      el('option', { text: 'Radial Vignette', attrs: { value: 'radial-gradient', selected: cover.bgMode === 'radial-gradient' } }),
    );
    const gradEndIn = el('input', {
      attrs: { type: 'color', value: cover.bgGradientEnd || cover.accentColor },
      style: { width: '100%', height: '30px', border: '1px solid var(--border-hairline)', background: 'transparent', borderRadius: '4px' },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, bgGradientEnd: gradEndIn.value })) },
    });

    let dimLabelEl: HTMLElement | null = null;
    const overlayRange = el('input', {
      attrs: { type: 'range', min: 0, max: 0.85, step: 0.05, value: cover.imageOverlayOpacity },
      on: {
        input: () => {
          const val = Number(overlayRange.value);
          if (dimLabelEl) dimLabelEl.textContent = `Overlay Dim (${Math.round(val * 100)}%)`;
          container.querySelectorAll<HTMLElement>('.bv-cover-bg-dim').forEach((n) => {
            n.style.opacity = String(val);
          });
          mutateCover(actions, (c) => ({ ...c, imageOverlayOpacity: val }), false, false);
        },
        change: () =>
          mutateCover(actions, (c) => ({ ...c, imageOverlayOpacity: Number(overlayRange.value) }), true),
      },
    });

    const brightIn = el('input', {
      attrs: { type: 'range', min: 60, max: 140, step: 5, value: cover.bgBrightnessPct ?? 100 },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, bgBrightnessPct: Number(brightIn.value) })) },
    });
    const contrastIn = el('input', {
      attrs: { type: 'range', min: 70, max: 140, step: 5, value: cover.bgContrastPct ?? 100 },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, bgContrastPct: Number(contrastIn.value) })) },
    });
    const blurIn = el('input', {
      attrs: { type: 'range', min: 0, max: 12, step: 1, value: cover.bgBlurPx ?? 0 },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, bgBlurPx: Number(blurIn.value) })) },
    });

    leftBody.append(
      el('span', { className: 'bv-panel-title', text: 'Backdrop & Photo FX' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Fill Style' }), bgModeSel),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Gradient Secondary Color' }), gradEndIn),
      el('div', { className: 'bv-field' }, (dimLabelEl = el('label', { className: 'bv-label', text: `Overlay Dim (${Math.round(cover.imageOverlayOpacity * 100)}%)` })), overlayRange),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Photo Brightness (${cover.bgBrightnessPct ?? 100}%)` }), brightIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Photo Contrast (${cover.bgContrastPct ?? 100}%)` }), contrastIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Background Blur (${cover.bgBlurPx ?? 0}px)` }), blurIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Grid Spacing' }), el('input', {
        attrs: { type: 'range', min: 2, max: 10, step: 1, value: gridStepPct },
        on: { change: (e) => mutateCover(actions, (c) => ({ ...c, gridSizePx: Number((e.target as HTMLInputElement).value) })) },
      })),
    );
  } else {
    const spineTitleIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: cover.spineTitle || '', placeholder: project.title },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, spineTitle: spineTitleIn.value })) },
    });
    const backHeadIn = el('input', {
      className: 'bv-input',
      attrs: { type: 'text', value: cover.backHeadline || '' },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, backHeadline: backHeadIn.value })) },
    });
    const blurbIn = el('textarea', {
      className: 'bv-textarea',
      attrs: { rows: 3, placeholder: 'Back cover synopsis blurb…' },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, backBlurb: blurbIn.value })) },
    });
    blurbIn.value = cover.backBlurb;
    const bioIn = el('textarea', {
      className: 'bv-textarea',
      attrs: { rows: 2, placeholder: 'Author biography…' },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, authorBio: bioIn.value })) },
    });
    bioIn.value = cover.authorBio || '';
    const frontFlapIn = el('textarea', {
      className: 'bv-textarea',
      attrs: { rows: 2 },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, frontFlapText: frontFlapIn.value })) },
    });
    frontFlapIn.value = cover.frontFlapText || '';
    const backFlapIn = el('textarea', {
      className: 'bv-textarea',
      attrs: { rows: 2 },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, backFlapText: backFlapIn.value })) },
    });
    backFlapIn.value = cover.backFlapText || '';
    const barcodeChk = el('input', {
      className: 'bv-lever',
      attrs: { type: 'checkbox', role: 'switch', checked: cover.showBarcodeBox !== false },
      on: { change: () => mutateCover(actions, (c) => ({ ...c, showBarcodeBox: barcodeChk.checked })) },
    });

    leftBody.append(
      el('span', { className: 'bv-panel-title', text: 'Back, Spine, Flaps & Exports' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Spine Title Override' }), spineTitleIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back Headline' }), backHeadIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back Blurb' }), blurbIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Author Bio' }), bioIn),
      el('label', { className: 'bv-check-row' }, barcodeChk, el('span', { text: 'Include ISBN Barcode Box' })),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Front Jacket Flap' }), frontFlapIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back Jacket Flap' }), backFlapIn),
      el('button', {
        className: 'bv-btn bv-btn-primary',
        attrs: { type: 'button' },
        on: { click: () => void actions.exportCoverPng() },
      }, icon('download', 14), 'Export Front Cover PNG'),
      el('button', {
        className: 'bv-btn',
        attrs: { type: 'button' },
        on: { click: () => void actions.exportFullWrapPng() },
      }, icon('download', 14), 'Export Full Print Wrap PNG'),
      el('button', {
        className: 'bv-btn',
        attrs: { type: 'button' },
        on: { click: () => void actions.exportEpub() },
      }, icon('book', 14), 'Export EPUB 3 with Cover'),
    );
  }

  const leftDock = el('aside', { className: 'qv-studio-left' }, rail, leftBody);

  // --- Center Interactive Artboard Stage ---
  const fontCss = cover.customFontFamily
    ? resolveEffectiveFontCss(project.typography.fontFamily, cover.customFontFamily)
    : resolveEffectiveFontCss(project.typography.fontFamily, project.typography.customFontFamily);

  const stageWrap = el('div', { className: 'qv-studio-stage-wrap' });
  const stageScroll = el('div', { className: 'qv-studio-canvas-scroll' });
  const guideV = el('div', { className: 'qv-smart-guide qv-smart-guide-v' });
  const guideH = el('div', { className: 'qv-smart-guide qv-smart-guide-h' });

  const renderFaceLayers = (faceEl: HTMLElement, face: CoverFaceId) => {
    faceEl.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
    faceEl.addEventListener('drop', async (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      e.preventDefault();
      await addDroppedGraphicToFace(face, file);
    });

    if (showGridOverlay) {
      faceEl.appendChild(
        el('div', {
          className: 'qv-cover-grid-overlay',
          style: {
            backgroundSize: `${gridStepPct}% ${gridStepPct}%`,
          },
        }),
      );
    }

    if (showBleedGuides) {
      faceEl.appendChild(
        el('div', {
          className: 'qv-cover-bleed-guide',
          attrs: { 'aria-hidden': 'true' },
        }),
      );
    }

    const bindMagneticDrag = (
      node: HTMLElement,
      isLocked: boolean | undefined,
      getRot: () => number,
      getFlip: () => [boolean, boolean],
      onSelect: () => void,
      onCommit: (xPct: number, yPct: number) => void,
    ) => {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let lastX = 50;
      let lastY = 50;
      node.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect();
        if (isLocked) {
          actions.notify('Layer is locked. Unlock it in Layers or right-click menu.');
          return;
        }
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        lastX = parseFloat(node.style.left) || 50;
        lastY = parseFloat(node.style.top) || 50;
        try {
          node.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      });
      node.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const rect = faceEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const rawX = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
        const rawY = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
        const snapped = computeSmartAlignSnap(rawX, rawY, {
          snapGrid: snapGridEnabled,
          gridStepPct,
        });
        lastX = snapped.xPct;
        lastY = snapped.yPct;
        const [fx, fy] = getFlip();
        applyDragToStyle(node, lastX, lastY, getRot(), fx, fy);
        guideV.style.display = snapped.guideX !== null ? 'block' : 'none';
        if (snapped.guideX !== null) guideV.style.left = `${snapped.guideX}%`;
        guideH.style.display = snapped.guideY !== null ? 'block' : 'none';
        if (snapped.guideY !== null) guideH.style.top = `${snapped.guideY}%`;
      });
      node.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        guideV.style.display = 'none';
        guideH.style.display = 'none';
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 2) {
          renderCoverStudio(container, actions);
          return;
        }
        onCommit(lastX, lastY);
      });
      node.addEventListener('pointercancel', () => {
        dragging = false;
        guideV.style.display = 'none';
        guideH.style.display = 'none';
      });
    };

    const appendSelectionHandles = (
      node: HTMLElement,
      onResizeDelta?: (dxPct: number, dyPct: number) => void,
    ) => {
      const handles = el('div', { className: 'qv-cover-sel-box' },
        el('span', { className: 'qv-cover-handle is-nw' }),
        el('span', { className: 'qv-cover-handle is-ne' }),
        el('span', { className: 'qv-cover-handle is-sw' }),
        el('span', {
          className: 'qv-cover-handle is-se',
          attrs: { title: onResizeDelta ? 'Drag corner to resize' : '' },
          on: onResizeDelta
            ? {
                pointerdown: (e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const faceRect = faceEl.getBoundingClientRect();
                  const target = e.currentTarget as HTMLElement;
                  target.setPointerCapture?.(e.pointerId);
                  const onMove = (mv: PointerEvent) => {
                    if (faceRect.width <= 0 || faceRect.height <= 0) return;
                    const dx = ((mv.clientX - startX) / faceRect.width) * 100;
                    const dy = ((mv.clientY - startY) / faceRect.height) * 100;
                    onResizeDelta(dx, dy);
                  };
                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                  };
                  window.addEventListener('pointermove', onMove);
                  window.addEventListener('pointerup', onUp);
                },
              }
            : undefined,
        }),
      );
      node.appendChild(handles);
    };

    // Vector Shape Layers (sorted by zIndex)
    for (const s of [...shapeLayers]
      .filter((item) => item.face === face && item.visible !== false)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
      const isSelected = activeSelectionKind === 'shape' && activeLayerId === s.id;
      const shapeNode = el('div', {
        className: `bv-cover-drag-item qv-cover-shape${isSelected ? ' is-selected' : ''}`,
        attrs: { 'data-shape-id': s.id },
        style: {
          left: `${s.xPct}%`,
          top: `${s.yPct}%`,
          width: `${s.widthPct}%`,
          height: s.shape === 'line' ? `${Math.max(2, s.strokeWidth || 2)}px` : `${s.heightPct}%`,
          opacity: String(s.opacity),
          zIndex: String(2 + (s.zIndex ?? 0)),
          transform: `translate(-50%, -50%) rotate(${s.rotationDeg}deg)`,
          borderRadius: s.shape === 'circle' || s.shape === 'badge' ? '999px' : `${s.cornerRadius}px`,
          background:
            s.shape === 'line'
              ? s.strokeColor
              : s.gradientEndColor
                ? `linear-gradient(135deg, ${s.fillColor}, ${s.gradientEndColor})`
                : s.fillColor,
          border: s.shape !== 'line' && s.strokeWidth > 0 ? `${s.strokeWidth}px solid ${s.strokeColor}` : 'none',
        },
      });
      if (isSelected) {
        const baseW = s.widthPct;
        const baseH = s.heightPct;
        appendSelectionHandles(shapeNode, (dxPct, dyPct) => {
          const nw = Math.max(4, Math.min(100, Math.round(baseW + dxPct * 1.4)));
          const nh = Math.max(2, Math.min(100, Math.round(baseH + dyPct * 1.4)));
          shapeNode.style.width = `${nw}%`;
          if (s.shape !== 'line') shapeNode.style.height = `${nh}%`;
          mutateCover(actions, (c) => ({
            ...c,
            shapeLayers: (c.shapeLayers ?? []).map((item) =>
              item.id === s.id ? { ...item, widthPct: nw, heightPct: nh } : item,
            ),
          }), false, false);
        });
      }
      bindMagneticDrag(
        shapeNode,
        s.locked,
        () => s.rotationDeg,
        () => [false, false],
        () => {
          activeSelectionKind = 'shape';
          activeLayerId = s.id;
          activeInspectorTab = 'properties';
        },
        (nx, ny) =>
          mutateCover(actions, (c) => ({
            ...c,
            shapeLayers: (c.shapeLayers ?? []).map((item) =>
              item.id === s.id ? { ...item, xPct: nx, yPct: ny } : item,
            ),
          })),
      );
      attachLayerContextMenu(shapeNode, 'shape', s.id, s.locked ?? false);
      faceEl.appendChild(shapeNode);
    }

    // Graphic SVG / PNG Layers (sorted by zIndex)
    for (const gLayer of [...graphicLayers]
      .filter((item) => item.face === face && item.visible !== false)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
      const isSelected = activeSelectionKind === 'graphic' && activeLayerId === gLayer.id;
      const sx = gLayer.flipX ? -1 : 1;
      const sy = gLayer.flipY ? -1 : 1;
      const filterStr = `brightness(${gLayer.brightnessPct ?? 100}%) contrast(${gLayer.contrastPct ?? 100}%) blur(${gLayer.blurPx ?? 0}px)`;
      const gNode = el(
        'div',
        {
          className: `bv-cover-drag-item bv-cover-graphic-layer${isSelected ? ' is-selected' : ''}`,
          attrs: { 'data-graphic-id': gLayer.id },
          style: {
            left: `${gLayer.xPct}%`,
            top: `${gLayer.yPct}%`,
            width: `${gLayer.widthPct}%`,
            opacity: String(gLayer.opacity),
            zIndex: String(2 + (gLayer.zIndex ?? 0)),
            transform: `translate(-50%, -50%) rotate(${gLayer.rotationDeg}deg) scale(${sx}, ${sy})`,
            filter: filterStr,
          },
        },
        el('img', {
          attrs: { src: gLayer.dataUrl, alt: gLayer.name },
          style: { width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' },
        }),
      );
      if (isSelected) {
        const baseW = gLayer.widthPct;
        appendSelectionHandles(gNode, (dxPct) => {
          const nw = Math.max(8, Math.min(95, Math.round(baseW + dxPct * 1.4)));
          gNode.style.width = `${nw}%`;
          mutateCover(actions, (c) => ({
            ...c,
            graphicLayers: (c.graphicLayers ?? []).map((item) =>
              item.id === gLayer.id ? { ...item, widthPct: nw } : item,
            ),
          }), false, false);
        });
      }
      bindMagneticDrag(
        gNode,
        gLayer.locked,
        () => gLayer.rotationDeg,
        () => [Boolean(gLayer.flipX), Boolean(gLayer.flipY)],
        () => {
          activeSelectionKind = 'graphic';
          activeLayerId = gLayer.id;
          activeInspectorTab = 'properties';
        },
        (nx, ny) =>
          mutateCover(actions, (c) => ({
            ...c,
            graphicLayers: (c.graphicLayers ?? []).map((item) =>
              item.id === gLayer.id ? { ...item, xPct: nx, yPct: ny } : item,
            ),
          })),
      );
      attachLayerContextMenu(gNode, 'graphic', gLayer.id, gLayer.locked ?? false);
      faceEl.appendChild(gNode);
    }

    // Custom Typography Layers (sorted by zIndex + double-click edit)
    for (const tl of [...textLayers]
      .filter((item) => item.face === face && item.visible !== false)
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
      const isSelected = activeSelectionKind === 'text' && activeLayerId === tl.id;
      const layerFont = tl.fontFamily ? resolveEffectiveFontCss('garamond', tl.fontFamily) : fontCss;
      const tNode = el('div', {
        className: `bv-cover-drag-item${isSelected ? ' is-selected' : ''}`,
        attrs: { 'data-text-id': tl.id },
        text: tl.uppercase ? tl.text.toUpperCase() : tl.text,
        style: {
          left: `${tl.xPct}%`,
          top: `${tl.yPct}%`,
          fontSize: `${tl.fontSize}px`,
          fontFamily: layerFont,
          color: tl.color,
          textAlign: tl.align,
          fontWeight: tl.fontWeight,
          fontStyle: tl.italic ? 'italic' : 'normal',
          letterSpacing: `${tl.letterSpacingEm}em`,
          lineHeight: String(tl.lineHeight),
          opacity: String(tl.opacity),
          zIndex: String(3 + (tl.zIndex ?? 0)),
          transform: `translate(-50%, -50%) rotate(${tl.rotationDeg}deg)`,
          textShadow: tl.shadowBlur ? `0 2px ${tl.shadowBlur}px rgba(0,0,0,0.6)` : 'none',
          webkitTextStroke: tl.strokeWidth ? `${tl.strokeWidth}px ${tl.strokeColor || '#000'}` : undefined,
        },
        on: {
          dblclick: (e) => {
            e.stopPropagation();
            activeSelectionKind = 'text';
            activeLayerId = tl.id;
            activeInspectorTab = 'properties';
            renderCoverStudio(container, actions);
            requestAnimationFrame(() => {
              const box = container.querySelector('.qv-studio-right-body textarea') as HTMLTextAreaElement | null;
              box?.focus();
              box?.select();
            });
          },
        },
      });
      if (isSelected) appendSelectionHandles(tNode);
      bindMagneticDrag(
        tNode,
        tl.locked,
        () => tl.rotationDeg,
        () => [false, false],
        () => {
          activeSelectionKind = 'text';
          activeLayerId = tl.id;
          activeInspectorTab = 'properties';
        },
        (nx, ny) =>
          mutateCover(actions, (c) => ({
            ...c,
            textLayers: (c.textLayers ?? []).map((item) =>
              item.id === tl.id ? { ...item, xPct: nx, yPct: ny } : item,
            ),
          })),
      );
      attachLayerContextMenu(tNode, 'text', tl.id, tl.locked ?? false);
      faceEl.appendChild(tNode);
    }
  };

  const bumpLayerZ = (kind: 'text' | 'shape' | 'graphic', id: string, delta: number) => {
    mutateCover(actions, (c) => ({
      ...c,
      textLayers: (c.textLayers ?? []).map((l) => (kind === 'text' && l.id === id ? { ...l, zIndex: (l.zIndex ?? 0) + delta } : l)),
      shapeLayers: (c.shapeLayers ?? []).map((l) => (kind === 'shape' && l.id === id ? { ...l, zIndex: (l.zIndex ?? 0) + delta } : l)),
      graphicLayers: (c.graphicLayers ?? []).map((l) => (kind === 'graphic' && l.id === id ? { ...l, zIndex: (l.zIndex ?? 0) + delta } : l)),
    }));
  };

  function attachLayerContextMenu(
    node: HTMLElement,
    kind: 'text' | 'shape' | 'graphic',
    id: string,
    locked: boolean,
  ): void {
    attachContextMenu(node, () => [
      {
        heading: 'Cover Layer Actions',
        items: [
          {
            label: 'Bring Forward',
            icon: 'bring-front',
            onSelect: () => bumpLayerZ(kind, id, 1),
          },
          {
            label: 'Send Backward',
            icon: 'send-back',
            onSelect: () => bumpLayerZ(kind, id, -1),
          },
          {
            label: 'Align Center Horizontally',
            icon: 'align-center',
            onSelect: () => {
              if (kind === 'text') {
                mutateCover(actions, (c) => ({
                  ...c,
                  textLayers: (c.textLayers ?? []).map((l) => (l.id === id ? { ...l, xPct: 50 } : l)),
                }));
              } else if (kind === 'shape') {
                mutateCover(actions, (c) => ({
                  ...c,
                  shapeLayers: (c.shapeLayers ?? []).map((l) => (l.id === id ? { ...l, xPct: 50 } : l)),
                }));
              } else {
                mutateCover(actions, (c) => ({
                  ...c,
                  graphicLayers: (c.graphicLayers ?? []).map((l) => (l.id === id ? { ...l, xPct: 50 } : l)),
                }));
              }
            },
          },
          {
            label: 'Duplicate Layer',
            icon: 'copy-layer',
            onSelect: () => {
              const dupId = newId('dup');
              activeSelectionKind = kind;
              activeLayerId = dupId;
              mutateCover(actions, (c) => {
                if (kind === 'text') {
                  const src = (c.textLayers ?? []).find((l) => l.id === id);
                  if (!src) return c;
                  return {
                    ...c,
                    textLayers: [...(c.textLayers ?? []), { ...src, id: dupId, xPct: Math.min(92, src.xPct + 4), yPct: Math.min(92, src.yPct + 4) }],
                  };
                }
                if (kind === 'shape') {
                  const src = (c.shapeLayers ?? []).find((l) => l.id === id);
                  if (!src) return c;
                  return {
                    ...c,
                    shapeLayers: [...(c.shapeLayers ?? []), { ...src, id: dupId, xPct: Math.min(92, src.xPct + 4), yPct: Math.min(92, src.yPct + 4) }],
                  };
                }
                const src = (c.graphicLayers ?? []).find((l) => l.id === id);
                if (!src) return c;
                return {
                  ...c,
                  graphicLayers: [...(c.graphicLayers ?? []), { ...src, id: dupId, xPct: Math.min(92, src.xPct + 4), yPct: Math.min(92, src.yPct + 4) }],
                };
              });
            },
          },
          {
            label: locked ? 'Unlock Position' : 'Lock Position',
            icon: locked ? 'unlock' : 'lock',
            onSelect: () => {
              mutateCover(actions, (c) => ({
                ...c,
                textLayers: (c.textLayers ?? []).map((l) => (kind === 'text' && l.id === id ? { ...l, locked: !locked } : l)),
                shapeLayers: (c.shapeLayers ?? []).map((l) => (kind === 'shape' && l.id === id ? { ...l, locked: !locked } : l)),
                graphicLayers: (c.graphicLayers ?? []).map((l) => (kind === 'graphic' && l.id === id ? { ...l, locked: !locked } : l)),
              }));
            },
          },
        ],
      },
      {
        items: [
          {
            label: 'Delete Layer',
            icon: 'trash',
            danger: true,
            onSelect: () => {
              activeSelectionKind = 'element';
              activeElementKey = 'title';
              activeLayerId = '';
              mutateCover(actions, (c) => ({
                ...c,
                textLayers: (c.textLayers ?? []).filter((l) => !(kind === 'text' && l.id === id)),
                shapeLayers: (c.shapeLayers ?? []).filter((l) => !(kind === 'shape' && l.id === id)),
                graphicLayers: (c.graphicLayers ?? []).filter((l) => !(kind === 'graphic' && l.id === id)),
              }));
            },
          },
        ],
      },
    ]);
  }

  const buildFrontFace = (): HTMLElement => {
    const frontCanvas = el('div', {
      className: 'bv-cover-front',
      style: {
        width: `${frontW}px`,
        height: `${frontH}px`,
        background: computeCoverBackgroundCss(cover, cover.backgroundColor),
        color: cover.textColor,
        fontFamily: fontCss,
      },
    });

    if (cover.backgroundImageDataUrl) {
      frontCanvas.appendChild(
        el('img', {
          attrs: { src: cover.backgroundImageDataUrl, alt: 'Cover artwork' },
          style: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            filter: `brightness(${cover.bgBrightnessPct ?? 100}%) contrast(${cover.bgContrastPct ?? 100}%) blur(${cover.bgBlurPx ?? 0}px)`,
          },
        }),
      );
      frontCanvas.appendChild(
        el('div', {
          className: 'bv-cover-bg-dim',
          style: { position: 'absolute', inset: '0', background: cover.backgroundColor, opacity: String(cover.imageOverlayOpacity), pointerEvents: 'none' },
        }),
      );
    }

    if (cover.template === 'obsidian-foil' || cover.template === 'ivory-classic') {
      frontCanvas.appendChild(
        el('div', {
          style: { position: 'absolute', inset: '24px', border: `1.5px solid ${cover.accentColor}`, pointerEvents: 'none' },
        }),
      );
    } else if (cover.template === 'editorial-band') {
      frontCanvas.appendChild(
        el('div', {
          style: { position: 'absolute', left: '0', right: '0', top: '62%', height: '6px', background: cover.accentColor, pointerEvents: 'none' },
        }),
      );
    } else if (cover.template === 'minimal-spine') {
      frontCanvas.appendChild(
        el('div', {
          style: { position: 'absolute', left: '24px', top: '24px', bottom: '24px', width: '5px', background: cover.accentColor, pointerEvents: 'none' },
        }),
      );
    }

    renderFaceLayers(frontCanvas, 'front');
    frontCanvas.append(guideV, guideH);

    const makeDraggableElement = (key: CoverElementKey, content: HTMLElement | string) => {
      const placement = cover.elements[key];
      if (!placement.visible) return;
      let dragging = false;
      let startX = 0;
      let startY = 0;
      const node = el(
        'div',
        {
          className: `bv-cover-drag-item${activeSelectionKind === 'element' && activeElementKey === key ? ' is-selected' : ''}`,
          attrs: { 'data-cover-el': key },
          style: {
            left: `${placement.xPct}%`,
            top: `${placement.yPct}%`,
            fontSize: `${placement.fontSize}px`,
            textAlign: placement.align,
            color: placement.color,
            opacity: String(placement.opacity ?? 1),
            letterSpacing: placement.letterSpacingEm !== undefined ? `${placement.letterSpacingEm}em` : undefined,
          },
          on: {
            pointerdown: (e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              activeSelectionKind = 'element';
              activeElementKey = key;
              activeLayerId = '';
              activeInspectorTab = 'properties';
              if (placement.locked) return;
              dragging = true;
              startX = e.clientX;
              startY = e.clientY;
              try {
                node.setPointerCapture(e.pointerId);
              } catch {
                // Ignore
              }
            },
            pointermove: (e) => {
              if (!dragging) return;
              const rect = frontCanvas.getBoundingClientRect();
              const rawX = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
              const rawY = Math.max(6, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100));
              const snapped = computeSmartAlignSnap(rawX, rawY, { snapGrid: snapGridEnabled, gridStepPct });
              applyDragToStyle(node, snapped.xPct, snapped.yPct);
              placement.xPct = snapped.xPct;
              placement.yPct = snapped.yPct;
              guideV.style.display = snapped.guideX !== null ? 'block' : 'none';
              if (snapped.guideX !== null) guideV.style.left = `${snapped.guideX}%`;
              guideH.style.display = snapped.guideY !== null ? 'block' : 'none';
              if (snapped.guideY !== null) guideH.style.top = `${snapped.guideY}%`;
            },
            pointerup: (e) => {
              if (!dragging) return;
              dragging = false;
              guideV.style.display = 'none';
              guideH.style.display = 'none';
              if (Math.hypot(e.clientX - startX, e.clientY - startY) < 2) {
                renderCoverStudio(container, actions);
                return;
              }
              mutateCover(actions, (c) => ({
                ...c,
                elements: { ...c.elements, [key]: { ...c.elements[key], xPct: placement.xPct, yPct: placement.yPct } },
              }));
            },
          },
        },
        content,
      );
      attachContextMenu(node, () => [
        {
          heading: `Element · ${key}`,
          items: [
            {
              label: 'Center Horizontally',
              icon: 'align-center',
              onSelect: () =>
                mutateCover(actions, (c) => ({
                  ...c,
                  elements: { ...c.elements, [key]: { ...c.elements[key], xPct: 50 } },
                })),
            },
            {
              label: placement.locked ? 'Unlock Position' : 'Lock Position',
              icon: placement.locked ? 'unlock' : 'lock',
              onSelect: () =>
                mutateCover(actions, (c) => ({
                  ...c,
                  elements: { ...c.elements, [key]: { ...c.elements[key], locked: !placement.locked } },
                })),
            },
            {
              label: 'Hide Element',
              icon: 'eye-off',
              onSelect: () =>
                mutateCover(actions, (c) => ({
                  ...c,
                  elements: { ...c.elements, [key]: { ...c.elements[key], visible: false } },
                })),
            },
          ],
        },
      ]);
      frontCanvas.appendChild(node);
    };

    makeDraggableElement(
      'edition',
      el('div', {
        text: cover.editionLabel,
        style: { letterSpacing: '0.16em', textTransform: 'uppercase', color: cover.elements.edition.color || cover.accentColor, fontWeight: '600' },
      }),
    );
    makeDraggableElement('title', el('div', { text: project.title, style: { fontWeight: cover.elements.title.fontWeight || '600', lineHeight: '1.12' } }));
    makeDraggableElement('subtitle', el('div', { text: project.subtitle, style: { fontStyle: 'italic', opacity: '0.88' } }));
    makeDraggableElement(
      'author',
      el('div', { text: penName, style: { letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: '600' } }),
    );
    if (identity.signatureSvgDataUrl) {
      makeDraggableElement(
        'signature',
        el('img', {
          attrs: { src: identity.signatureSvgDataUrl, alt: `${penName} signature` },
          style: { maxWidth: '120px', maxHeight: '48px', pointerEvents: 'none' },
        }),
      );
    } else if (identity.signatureText) {
      makeDraggableElement(
        'signature',
        el('div', { text: identity.signatureText, style: { fontStyle: 'italic', color: cover.accentColor } }),
      );
    }

    return frontCanvas;
  };

  const buildBackFace = (): HTMLElement => {
    const back = el('div', {
      className: 'bv-cover-back',
      style: {
        width: `${frontW}px`,
        height: `${frontH}px`,
        background: cover.backBackgroundColor || cover.backgroundColor,
        color: cover.textColor,
        fontFamily: fontCss,
      },
    });
    renderFaceLayers(back, 'back');
    back.append(
      el('div', {
        text: cover.backHeadline || project.title,
        style: { fontSize: '18px', fontWeight: '600', color: cover.accentColor, lineHeight: '1.2', position: 'relative', zIndex: '3' },
      }),
      el('p', {
        text: cover.backBlurb,
        style: { margin: '0', fontSize: '13px', lineHeight: '1.6', opacity: '0.9', position: 'relative', zIndex: '3' },
      }),
      ...(cover.authorBio
        ? [
            el('p', {
              text: cover.authorBio,
              style: { margin: 'auto 0 0', fontSize: '11.5px', lineHeight: '1.5', opacity: '0.72', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '10px', position: 'relative', zIndex: '3' },
            }),
          ]
        : []),
      ...(cover.showBarcodeBox !== false
        ? [
            el(
              'div',
              { className: 'bv-cover-barcode', style: { position: 'relative', zIndex: '3' } },
              el('div', { className: 'bv-barcode-bars' }),
              el('span', { text: project.publishing?.isbn || '978-0-000-00000-0' }),
            ),
          ]
        : []),
    );
    return back;
  };

  const buildSpineFace = (): HTMLElement => {
    const spineW = Math.max(38, Math.round(spineInches * 64));
    const spine = el(
      'div',
      {
        className: 'bv-cover-spine',
        style: {
          width: `${spineW}px`,
          height: `${frontH}px`,
          background: cover.spineBackgroundColor || cover.backgroundColor,
          color: cover.accentColor,
          fontFamily: fontCss,
        },
      },
      el('span', { text: `${cover.spineTitle || project.title}  ·  ${penName}` }),
    );
    renderFaceLayers(spine, 'spine');
    return spine;
  };

  const buildFlapFace = (side: 'front-flap' | 'back-flap'): HTMLElement => {
    const flap = el(
      'div',
      {
        className: 'bv-cover-flap',
        style: {
          position: 'relative',
          width: `${Math.round(frontW * 0.44)}px`,
          height: `${frontH}px`,
          background: cover.backBackgroundColor || cover.backgroundColor,
          color: cover.textColor,
          fontFamily: fontCss,
        },
      },
      el('span', { className: 'bv-mono-tag', text: side === 'front-flap' ? 'FRONT FLAP' : 'BACK FLAP', style: { color: cover.accentColor } }),
      el('p', {
        text: side === 'front-flap' ? (cover.frontFlapText || '') : (cover.backFlapText || ''),
        style: { fontSize: '11.5px', lineHeight: '1.55', opacity: '0.88' },
      }),
    );
    renderFaceLayers(flap, side);
    return flap;
  };

  const wrap = el('div', {
    className: 'bv-cover-wrap',
    style: { transform: `scale(${studioZoom})`, transformOrigin: 'top center' },
  });
  if (coverWrapMode === 'front') {
    wrap.appendChild(buildFrontFace());
  } else if (coverWrapMode === 'back') {
    wrap.appendChild(buildBackFace());
  } else if (coverWrapMode === 'spine') {
    wrap.appendChild(buildSpineFace());
  } else if (coverWrapMode === 'full-wrap') {
    wrap.append(buildBackFace(), buildSpineFace(), buildFrontFace());
  } else {
    wrap.append(
      buildFlapFace('back-flap'),
      buildBackFace(),
      buildSpineFace(),
      buildFrontFace(),
      buildFlapFace('front-flap'),
    );
  }

  attachContextMenu(stageScroll, () => [
    {
      heading: 'Cover Canvas',
      items: [
        {
          label: showGridOverlay ? 'Hide Grid Overlay' : 'Show Grid Overlay',
          icon: 'grid-snap',
          checked: showGridOverlay,
          onSelect: () => mutateCover(actions, (c) => ({ ...c, showGrid: !showGridOverlay }), true, false),
        },
        {
          label: snapGridEnabled ? 'Disable Snap to Grid' : 'Enable Snap to Grid',
          icon: 'magnet',
          checked: snapGridEnabled,
          onSelect: () => mutateCover(actions, (c) => ({ ...c, snapToGrid: !snapGridEnabled }), true, false),
        },
        {
          label: showBleedGuides ? 'Hide Print Safe Guides' : 'Show Print Safe Guides',
          icon: 'guides',
          checked: showBleedGuides,
          onSelect: () => mutateCover(actions, (c) => ({ ...c, showGuides: !showBleedGuides }), true, false),
        },
        {
          label: 'Reset Zoom (100%)',
          onSelect: () => {
            studioZoom = 1;
            renderCoverStudio(container, actions);
          },
        },
        {
          label: 'Export Front Cover PNG',
          icon: 'download',
          onSelect: () => void actions.exportCoverPng(),
        },
      ],
    },
  ]);

  stageScroll.appendChild(wrap);
  const bottomStatusStrip = el(
    'div',
    { className: 'qv-studio-status-strip' },
    el('span', { className: 'bv-mono-tag', text: `Trim ${trim.label} · Spine ${spineInches}" · Zoom ${Math.round(studioZoom * 100)}%` }),
    el('span', { className: 'bv-mono-tag', text: 'Drop .svg or .png onto any cover face · Right-click layers for options' }),
  );
  stageWrap.append(stageScroll, bottomStatusStrip);

  // --- Right Contextual Properties + Layers Panel ---
  const rightDock = el('aside', { className: 'qv-studio-right' });
  const rightTabs = el(
    'div',
    { className: 'qv-studio-right-tabs' },
    el('button', {
      className: `bv-fmt-btn${activeInspectorTab === 'properties' ? ' is-active' : ''}`,
      text: 'Properties',
      attrs: { type: 'button' },
      on: {
        click: () => {
          activeInspectorTab = 'properties';
          renderCoverStudio(container, actions);
        },
      },
    }),
    el('button', {
      className: `bv-fmt-btn${activeInspectorTab === 'layers' ? ' is-active' : ''}`,
      text: `Layers (${5 + textLayers.length + shapeLayers.length + graphicLayers.length})`,
      attrs: { type: 'button' },
      on: {
        click: () => {
          activeInspectorTab = 'layers';
          renderCoverStudio(container, actions);
        },
      },
    }),
  );

  const rightBody = el('div', { className: 'qv-studio-right-body' });

  if (activeInspectorTab === 'layers') {
    const buildLayerRow = (
      label: string,
      badge: string,
      selected: boolean,
      visible: boolean,
      locked: boolean,
      onSelect: () => void,
      onToggleVis: () => void,
      onToggleLock: () => void,
      onDelete?: () => void,
    ) =>
      el(
        'div',
        {
          className: `qv-layer-row${selected ? ' is-active' : ''}`,
          on: { click: onSelect },
        },
        el(
          'div',
          { style: { minWidth: '0', flex: '1' } },
          el('div', { text: label, style: { fontWeight: '600', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
          el('span', { className: 'bv-mono-tag', text: badge }),
        ),
        el(
          'div',
          { style: { display: 'flex', gap: '3px', alignItems: 'center' } },
          el('button', {
            className: 'bv-icon-tiny',
            attrs: { type: 'button', 'aria-label': visible ? 'Hide layer' : 'Show layer' },
            on: { click: (e) => { e.stopPropagation(); onToggleVis(); } },
          }, icon(visible ? 'eye' : 'eye-off', 13)),
          el('button', {
            className: 'bv-icon-tiny',
            attrs: { type: 'button', 'aria-label': locked ? 'Unlock layer' : 'Lock layer' },
            on: { click: (e) => { e.stopPropagation(); onToggleLock(); } },
          }, icon(locked ? 'lock' : 'unlock', 13)),
          onDelete
            ? el('button', {
                className: 'bv-icon-tiny',
                attrs: { type: 'button', 'aria-label': 'Delete layer' },
                on: { click: (e) => { e.stopPropagation(); onDelete(); } },
              }, icon('trash', 13))
            : null,
        ),
      );

    for (const g of [...graphicLayers].reverse()) {
      rightBody.appendChild(
        buildLayerRow(
          g.name,
          `${g.kind.toUpperCase()} · ${g.face}`,
          activeSelectionKind === 'graphic' && activeLayerId === g.id,
          g.visible !== false,
          Boolean(g.locked),
          () => {
            activeSelectionKind = 'graphic';
            activeLayerId = g.id;
            renderCoverStudio(container, actions);
          },
          () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((x) => x.id === g.id ? { ...x, visible: !(x.visible !== false) } : x) })),
          () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((x) => x.id === g.id ? { ...x, locked: !x.locked } : x) })),
          () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).filter((x) => x.id !== g.id) })),
        ),
      );
    }

    for (const tl of [...textLayers].reverse()) {
      rightBody.appendChild(
        buildLayerRow(
          tl.text.slice(0, 28) || 'Text Box',
          `TEXT · ${tl.face}`,
          activeSelectionKind === 'text' && activeLayerId === tl.id,
          tl.visible !== false,
          Boolean(tl.locked),
          () => {
            activeSelectionKind = 'text';
            activeLayerId = tl.id;
            renderCoverStudio(container, actions);
          },
          () => mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).map((x) => x.id === tl.id ? { ...x, visible: !(x.visible !== false) } : x) })),
          () => mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).map((x) => x.id === tl.id ? { ...x, locked: !x.locked } : x) })),
          () => mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).filter((x) => x.id !== tl.id) })),
        ),
      );
    }

    for (const sh of [...shapeLayers].reverse()) {
      rightBody.appendChild(
        buildLayerRow(
          sh.name,
          `SHAPE · ${sh.face}`,
          activeSelectionKind === 'shape' && activeLayerId === sh.id,
          sh.visible !== false,
          Boolean(sh.locked),
          () => {
            activeSelectionKind = 'shape';
            activeLayerId = sh.id;
            renderCoverStudio(container, actions);
          },
          () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((x) => x.id === sh.id ? { ...x, visible: !(x.visible !== false) } : x) })),
          () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((x) => x.id === sh.id ? { ...x, locked: !x.locked } : x) })),
          () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).filter((x) => x.id !== sh.id) })),
        ),
      );
    }

    for (const key of ['edition', 'title', 'subtitle', 'author', 'signature'] as CoverElementKey[]) {
      const elCfg = cover.elements[key];
      rightBody.appendChild(
        buildLayerRow(
          key.charAt(0).toUpperCase() + key.slice(1),
          'CORE FIELD',
          activeSelectionKind === 'element' && activeElementKey === key,
          elCfg.visible,
          Boolean(elCfg.locked),
          () => {
            activeSelectionKind = 'element';
            activeElementKey = key;
            renderCoverStudio(container, actions);
          },
          () => mutateCover(actions, (c) => ({ ...c, elements: { ...c.elements, [key]: { ...c.elements[key], visible: !c.elements[key].visible } } })),
          () => mutateCover(actions, (c) => ({ ...c, elements: { ...c.elements, [key]: { ...c.elements[key], locked: !c.elements[key].locked } } })),
        ),
      );
    }
  } else {
    // Properties Inspector tailored to current selection
    const alignRow = (onAlign: (xPct: number | null, yPct: number | null) => void) =>
      el(
        'div',
        { className: 'bv-field' },
        el('label', { className: 'bv-label', text: 'Quick Align on Face' }),
        el(
          'div',
          { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
          el('button', { className: 'bv-mini-btn', text: 'Left', attrs: { type: 'button' }, on: { click: () => onAlign(18, null) } }),
          el('button', { className: 'bv-mini-btn', text: 'Center X', attrs: { type: 'button' }, on: { click: () => onAlign(50, null) } }),
          el('button', { className: 'bv-mini-btn', text: 'Right', attrs: { type: 'button' }, on: { click: () => onAlign(82, null) } }),
          el('button', { className: 'bv-mini-btn', text: 'Center Y', attrs: { type: 'button' }, on: { click: () => onAlign(null, 50) } }),
        ),
      );

    if (selectedTextLayer) {
      const txtVal = el('textarea', {
        className: 'bv-textarea',
        attrs: { rows: 2 },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).map((l) => l.id === selectedTextLayer.id ? { ...l, text: txtVal.value } : l) })) },
      });
      txtVal.value = selectedTextLayer.text;

      let sizeLbl: HTMLElement | null = null;
      const sizeRange = el('input', {
        attrs: { type: 'range', min: 8, max: 64, step: 1, value: selectedTextLayer.fontSize },
        on: {
          input: () => {
            const val = Number(sizeRange.value);
            if (sizeLbl) sizeLbl.textContent = `Font Size (${val}px)`;
            container.querySelectorAll<HTMLElement>(`[data-text-id="${selectedTextLayer.id}"]`).forEach((n) => {
              n.style.fontSize = `${val}px`;
            });
            mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).map((l) => l.id === selectedTextLayer.id ? { ...l, fontSize: val } : l) }), false, false);
          },
          change: () => mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).map((l) => l.id === selectedTextLayer.id ? { ...l, fontSize: Number(sizeRange.value) } : l) }), true),
        },
      });
      const colorIn = el('input', {
        attrs: { type: 'color', value: selectedTextLayer.color },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).map((l) => l.id === selectedTextLayer.id ? { ...l, color: colorIn.value } : l) })) },
      });
      const upperChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: selectedTextLayer.uppercase },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).map((l) => l.id === selectedTextLayer.id ? { ...l, uppercase: upperChk.checked } : l) })) },
      });

      const fontSel = el(
        'select',
        {
          className: 'bv-input',
          on: {
            change: () =>
              mutateCover(actions, (c) => ({
                ...c,
                textLayers: (c.textLayers ?? []).map((l) =>
                  l.id === selectedTextLayer.id ? { ...l, fontFamily: fontSel.value || undefined } : l,
                ),
              })),
          },
        },
        el('option', { text: 'Cover Default Typeface', attrs: { value: '', selected: !selectedTextLayer.fontFamily } }),
        ...fontChoices.map((fc) =>
          el('option', {
            text: fc.label,
            attrs: { value: fc.id, selected: selectedTextLayer.fontFamily === fc.id },
          }),
        ),
      );
      const italicChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: selectedTextLayer.italic },
        on: {
          change: () =>
            mutateCover(actions, (c) => ({
              ...c,
              textLayers: (c.textLayers ?? []).map((l) =>
                l.id === selectedTextLayer.id ? { ...l, italic: italicChk.checked } : l,
              ),
            })),
        },
      });
      const zRow = el(
        'div',
        { style: { display: 'flex', gap: '6px' } },
        el('button', {
          className: 'bv-mini-btn',
          text: 'Send Back',
          attrs: { type: 'button' },
          on: { click: () => bumpLayerZ('text', selectedTextLayer.id, -1) },
        }),
        el('button', {
          className: 'bv-mini-btn',
          text: 'Bring Forward',
          attrs: { type: 'button' },
          on: { click: () => bumpLayerZ('text', selectedTextLayer.id, 1) },
        }),
      );

      rightBody.append(
        el('span', { className: 'bv-panel-title', text: 'Custom Text Layer' }),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Copy' }), txtVal),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Font' }), fontSel),
        el('div', { className: 'bv-field' }, (sizeLbl = el('label', { className: 'bv-label', text: `Font Size (${selectedTextLayer.fontSize}px)` })), sizeRange),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Text Color' }), colorIn),
        el('label', { className: 'bv-check-row' }, italicChk, el('span', { text: 'Italic Style' })),
        el('label', { className: 'bv-check-row' }, upperChk, el('span', { text: 'Uppercase Display' })),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Layer Order' }), zRow),
        alignRow((nx, ny) =>
          mutateCover(actions, (c) => ({
            ...c,
            textLayers: (c.textLayers ?? []).map((l) =>
              l.id === selectedTextLayer.id
                ? { ...l, xPct: nx ?? l.xPct, yPct: ny ?? l.yPct }
                : l,
            ),
          })),
        ),
        el('button', {
          className: 'bv-mini-btn',
          text: 'Delete Text Layer',
          attrs: { type: 'button' },
          on: {
            click: () => {
              const delId = selectedTextLayer.id;
              activeSelectionKind = 'element';
              activeLayerId = '';
              mutateCover(actions, (c) => ({ ...c, textLayers: (c.textLayers ?? []).filter((l) => l.id !== delId) }));
            },
          },
        }),
      );
    } else if (selectedShapeLayer) {
      let wLbl: HTMLElement | null = null;
      const wRange = el('input', {
        attrs: { type: 'range', min: 5, max: 100, step: 1, value: selectedShapeLayer.widthPct },
        on: {
          input: () => {
            const val = Number(wRange.value);
            if (wLbl) wLbl.textContent = `Width (${val}%)`;
            container.querySelectorAll<HTMLElement>(`[data-shape-id="${selectedShapeLayer.id}"]`).forEach((n) => {
              n.style.width = `${val}%`;
            });
            mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, widthPct: val } : l) }), false, false);
          },
          change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, widthPct: Number(wRange.value) } : l) }), true),
        },
      });
      const fillIn = el('input', {
        attrs: { type: 'color', value: selectedShapeLayer.fillColor.startsWith('#') ? selectedShapeLayer.fillColor : cover.accentColor },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, fillColor: fillIn.value } : l) })) },
      });
      const opRange = el('input', {
        attrs: { type: 'range', min: 0.05, max: 1, step: 0.05, value: selectedShapeLayer.opacity },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, opacity: Number(opRange.value) } : l) })) },
      });
      const rotRange = el('input', {
        attrs: { type: 'range', min: -180, max: 180, step: 5, value: selectedShapeLayer.rotationDeg },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, rotationDeg: Number(rotRange.value) } : l) })) },
      });

      let hLbl: HTMLElement | null = null;
      const hRange = el('input', {
        attrs: { type: 'range', min: 2, max: 100, step: 1, value: selectedShapeLayer.heightPct },
        on: {
          input: () => {
            const val = Number(hRange.value);
            if (hLbl) hLbl.textContent = `Height (${val}%)`;
            container.querySelectorAll<HTMLElement>(`[data-shape-id="${selectedShapeLayer.id}"]`).forEach((n) => {
              if (selectedShapeLayer.shape !== 'line') n.style.height = `${val}%`;
            });
            mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, heightPct: val } : l) }), false, false);
          },
          change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, heightPct: Number(hRange.value) } : l) }), true),
        },
      });
      const strokeColorIn = el('input', {
        attrs: { type: 'color', value: selectedShapeLayer.strokeColor || cover.accentColor },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, strokeColor: strokeColorIn.value } : l) })) },
      });
      const strokeWRange = el('input', {
        attrs: { type: 'range', min: 0, max: 14, step: 1, value: selectedShapeLayer.strokeWidth },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, strokeWidth: Number(strokeWRange.value) } : l) })) },
      });
      const radiusRange = el('input', {
        attrs: { type: 'range', min: 0, max: 48, step: 2, value: selectedShapeLayer.cornerRadius },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, cornerRadius: Number(radiusRange.value) } : l) })) },
      });
      const gradEndIn = el('input', {
        attrs: { type: 'color', value: selectedShapeLayer.gradientEndColor || selectedShapeLayer.fillColor || cover.accentColor },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).map((l) => l.id === selectedShapeLayer.id ? { ...l, gradientEndColor: gradEndIn.value } : l) })) },
      });
      const shapeZRow = el(
        'div',
        { style: { display: 'flex', gap: '6px' } },
        el('button', {
          className: 'bv-mini-btn',
          text: 'Send Back',
          attrs: { type: 'button' },
          on: { click: () => bumpLayerZ('shape', selectedShapeLayer.id, -1) },
        }),
        el('button', {
          className: 'bv-mini-btn',
          text: 'Bring Forward',
          attrs: { type: 'button' },
          on: { click: () => bumpLayerZ('shape', selectedShapeLayer.id, 1) },
        }),
      );

      rightBody.append(
        el('span', { className: 'bv-panel-title', text: `Shape · ${selectedShapeLayer.name}` }),
        el('div', { className: 'bv-field' }, (wLbl = el('label', { className: 'bv-label', text: `Width (${selectedShapeLayer.widthPct}%)` })), wRange),
        el('div', { className: 'bv-field' }, (hLbl = el('label', { className: 'bv-label', text: `Height (${selectedShapeLayer.heightPct}%)` })), hRange),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Fill Color' }), fillIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Gradient End (Optional)' }), gradEndIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Border / Stroke Color' }), strokeColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Stroke Width (${selectedShapeLayer.strokeWidth}px)` }), strokeWRange),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Corner Radius (${selectedShapeLayer.cornerRadius}px)` }), radiusRange),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Opacity (${Math.round(selectedShapeLayer.opacity * 100)}%)` }), opRange),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Rotation (${selectedShapeLayer.rotationDeg}°)` }), rotRange),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Layer Order' }), shapeZRow),
        alignRow((nx, ny) =>
          mutateCover(actions, (c) => ({
            ...c,
            shapeLayers: (c.shapeLayers ?? []).map((l) =>
              l.id === selectedShapeLayer.id ? { ...l, xPct: nx ?? l.xPct, yPct: ny ?? l.yPct } : l,
            ),
          })),
        ),
        el('button', {
          className: 'bv-mini-btn',
          text: 'Delete Shape Layer',
          attrs: { type: 'button' },
          on: {
            click: () => {
              const delId = selectedShapeLayer.id;
              activeSelectionKind = 'element';
              activeLayerId = '';
              mutateCover(actions, (c) => ({ ...c, shapeLayers: (c.shapeLayers ?? []).filter((l) => l.id !== delId) }));
            },
          },
        }),
      );
    } else if (selectedGraphicLayer) {
      let widthLbl: HTMLElement | null = null;
      let rotLbl: HTMLElement | null = null;
      let opLbl: HTMLElement | null = null;
      let liveW = selectedGraphicLayer.widthPct;
      let liveRot = selectedGraphicLayer.rotationDeg;
      let liveOp = selectedGraphicLayer.opacity;

      const applyGraphicLive = () => {
        const sx = selectedGraphicLayer.flipX ? -1 : 1;
        const sy = selectedGraphicLayer.flipY ? -1 : 1;
        container.querySelectorAll<HTMLElement>(`[data-graphic-id="${selectedGraphicLayer.id}"]`).forEach((n) => {
          n.style.width = `${liveW}%`;
          n.style.opacity = String(liveOp);
          n.style.transform = `translate(-50%, -50%) rotate(${liveRot}deg) scale(${sx}, ${sy})`;
        });
      };

      const widthRange = el('input', {
        attrs: { type: 'range', min: 8, max: 95, step: 2, value: selectedGraphicLayer.widthPct },
        on: {
          input: () => {
            liveW = Number(widthRange.value);
            if (widthLbl) widthLbl.textContent = `Scale (${liveW}%)`;
            applyGraphicLive();
            mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, widthPct: liveW } : g) }), false, false);
          },
          change: () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, widthPct: Number(widthRange.value) } : g) }), true),
        },
      });
      const rotRange = el('input', {
        attrs: { type: 'range', min: -180, max: 180, step: 5, value: selectedGraphicLayer.rotationDeg },
        on: {
          input: () => {
            liveRot = Number(rotRange.value);
            if (rotLbl) rotLbl.textContent = `Rotation (${liveRot}°)`;
            applyGraphicLive();
            mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, rotationDeg: liveRot } : g) }), false, false);
          },
          change: () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, rotationDeg: Number(rotRange.value) } : g) }), true),
        },
      });
      const opRange = el('input', {
        attrs: { type: 'range', min: 0.1, max: 1, step: 0.05, value: selectedGraphicLayer.opacity },
        on: {
          input: () => {
            liveOp = Number(opRange.value);
            if (opLbl) opLbl.textContent = `Opacity (${Math.round(liveOp * 100)}%)`;
            applyGraphicLive();
            mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, opacity: liveOp } : g) }), false, false);
          },
          change: () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, opacity: Number(opRange.value) } : g) }), true),
        },
      });

      rightBody.append(
        el('span', { className: 'bv-panel-title', text: `Graphic · ${selectedGraphicLayer.name}` }),
        el('div', { className: 'bv-field' }, (widthLbl = el('label', { className: 'bv-label', text: `Scale (${selectedGraphicLayer.widthPct}%)` })), widthRange),
        el('div', { className: 'bv-field' }, (rotLbl = el('label', { className: 'bv-label', text: `Rotation (${selectedGraphicLayer.rotationDeg}°)` })), rotRange),
        el('div', { className: 'bv-field' }, (opLbl = el('label', { className: 'bv-label', text: `Opacity (${Math.round(selectedGraphicLayer.opacity * 100)}%)` })), opRange),
        el(
          'div',
          { style: { display: 'flex', gap: '6px' } },
          el('button', {
            className: `bv-mini-btn${selectedGraphicLayer.flipX ? ' is-active' : ''}`,
            attrs: { type: 'button' },
            on: { click: () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, flipX: !g.flipX } : g) })) },
          }, icon('flip-h', 12), 'Flip H'),
          el('button', {
            className: `bv-mini-btn${selectedGraphicLayer.flipY ? ' is-active' : ''}`,
            attrs: { type: 'button' },
            on: { click: () => mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).map((g) => g.id === selectedGraphicLayer.id ? { ...g, flipY: !g.flipY } : g) })) },
          }, icon('flip-v', 12), 'Flip V'),
        ),
        alignRow((nx, ny) =>
          mutateCover(actions, (c) => ({
            ...c,
            graphicLayers: (c.graphicLayers ?? []).map((g) =>
              g.id === selectedGraphicLayer.id ? { ...g, xPct: nx ?? g.xPct, yPct: ny ?? g.yPct } : g,
            ),
          })),
        ),
        el('button', {
          className: 'bv-mini-btn',
          attrs: { type: 'button' },
          on: {
            click: () => {
              const delId = selectedGraphicLayer.id;
              activeSelectionKind = 'element';
              activeLayerId = '';
              mutateCover(actions, (c) => ({ ...c, graphicLayers: (c.graphicLayers ?? []).filter((g) => g.id !== delId) }));
            },
          },
        }, icon('trash', 12), 'Remove Layer'),
      );
    } else {
      const activeEl = cover.elements[activeElementKey];
      const elKeySel = el(
        'select',
        {
          className: 'bv-input',
          on: {
            change: () => {
              activeElementKey = elKeySel.value as CoverElementKey;
              renderCoverStudio(container, actions);
            },
          },
        },
        el('option', { text: 'Title', attrs: { value: 'title', selected: activeElementKey === 'title' } }),
        el('option', { text: 'Subtitle', attrs: { value: 'subtitle', selected: activeElementKey === 'subtitle' } }),
        el('option', { text: 'Pen Name / Author', attrs: { value: 'author', selected: activeElementKey === 'author' } }),
        el('option', { text: 'Edition Banner', attrs: { value: 'edition', selected: activeElementKey === 'edition' } }),
        el('option', { text: 'Author Signature', attrs: { value: 'signature', selected: activeElementKey === 'signature' } }),
      );

      let elFontSizeLbl: HTMLElement | null = null;
      const elFontSizeIn = el('input', {
        attrs: { type: 'range', min: 10, max: 54, step: 1, value: activeEl.fontSize },
        on: {
          input: () => {
            const val = Number(elFontSizeIn.value);
            if (elFontSizeLbl) elFontSizeLbl.textContent = `Size (${val}px)`;
            container.querySelectorAll<HTMLElement>(`[data-cover-el="${activeElementKey}"]`).forEach((n) => {
              n.style.fontSize = `${val}px`;
            });
            mutateCover(
              actions,
              (c) => ({
                ...c,
                elements: { ...c.elements, [activeElementKey]: { ...c.elements[activeElementKey], fontSize: val } },
              }),
              false,
              false,
            );
          },
          change: () =>
            mutateCover(actions, (c) => ({
              ...c,
              elements: { ...c.elements, [activeElementKey]: { ...c.elements[activeElementKey], fontSize: Number(elFontSizeIn.value) } },
            }), true),
        },
      });
      const editionIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: cover.editionLabel },
        on: { change: () => mutateCover(actions, (c) => ({ ...c, editionLabel: editionIn.value })) },
      });
      const elColorIn = el('input', {
        attrs: { type: 'color', value: activeEl.color || cover.textColor },
        on: {
          change: () =>
            mutateCover(actions, (c) => ({
              ...c,
              elements: { ...c.elements, [activeElementKey]: { ...c.elements[activeElementKey], color: elColorIn.value } },
            })),
        },
      });
      const elAlignSel = el(
        'select',
        {
          className: 'bv-input',
          on: {
            change: () =>
              mutateCover(actions, (c) => ({
                ...c,
                elements: { ...c.elements, [activeElementKey]: { ...c.elements[activeElementKey], align: elAlignSel.value as 'left' | 'center' | 'right' } },
              })),
          },
        },
        el('option', { text: 'Left', attrs: { value: 'left', selected: activeEl.align === 'left' } }),
        el('option', { text: 'Center', attrs: { value: 'center', selected: activeEl.align === 'center' } }),
        el('option', { text: 'Right', attrs: { value: 'right', selected: activeEl.align === 'right' } }),
      );
      const bookFieldVal =
        activeElementKey === 'title'
          ? project.title
          : activeElementKey === 'subtitle'
            ? project.subtitle
            : activeElementKey === 'author'
              ? penName
              : '';
      const bookFieldInput =
        activeElementKey === 'title' || activeElementKey === 'subtitle' || activeElementKey === 'author'
          ? el('input', {
              className: 'bv-input',
              attrs: { type: 'text', value: bookFieldVal },
              on: {
                change: (ev) => {
                  const val = (ev.target as HTMLInputElement).value;
                  actions.mutateProject((prev) => {
                    if (activeElementKey === 'title') return { ...prev, title: val };
                    if (activeElementKey === 'subtitle') return { ...prev, subtitle: val };
                    const next = normalizeProjectDefaults(prev);
                    if (next.authorIdentity) next.authorIdentity.penName = val;
                    return { ...next, author: val };
                  });
                },
              },
            })
          : null;
      const elVisibleChk = el('input', {
        className: 'bv-lever',
        attrs: { type: 'checkbox', role: 'switch', checked: activeEl.visible },
        on: {
          change: () =>
            mutateCover(actions, (c) => ({
              ...c,
              elements: { ...c.elements, [activeElementKey]: { ...c.elements[activeElementKey], visible: elVisibleChk.checked } },
            })),
        },
      });

      rightBody.append(
        el('span', { className: 'bv-panel-title', text: 'Front Text Element' }),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Layer' }), elKeySel),
        ...(bookFieldInput
          ? [el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `${activeElementKey === 'author' ? 'Author / Pen Name' : activeElementKey.charAt(0).toUpperCase() + activeElementKey.slice(1)} Text` }), bookFieldInput)]
          : []),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Edition Banner Text' }), editionIn),
        el('div', { className: 'bv-field' }, (elFontSizeLbl = el('label', { className: 'bv-label', text: `Size (${activeEl.fontSize}px)` })), elFontSizeIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Text Color' }), elColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Alignment' }), elAlignSel),
        el('label', { className: 'bv-check-row' }, elVisibleChk, el('span', { text: 'Visible on Front Cover' })),
        alignRow((nx, ny) =>
          mutateCover(actions, (c) => ({
            ...c,
            elements: {
              ...c.elements,
              [activeElementKey]: {
                ...c.elements[activeElementKey],
                xPct: nx ?? c.elements[activeElementKey].xPct,
                yPct: ny ?? c.elements[activeElementKey].yPct,
              },
            },
          })),
        ),
      );
    }
  }

  rightDock.append(rightTabs, rightBody);

  const leftResizer = createVerticalResizer({
    side: 'left',
    minWidth: 220,
    maxWidth: 440,
    cssVarName: '--qv-studio-left-w',
    ariaLabel: 'Resize Cover Studio tool panel',
    getWidth: () => actions.getState().settings.studioLeftWidthPx,
    onResizeEnd: (w) => actions.updateSettings({ studioLeftWidthPx: w }),
    onDoubleClickReset: () => 296,
  });

  const rightResizer = createVerticalResizer({
    side: 'right',
    minWidth: 220,
    maxWidth: 440,
    cssVarName: '--qv-studio-right-w',
    ariaLabel: 'Resize Cover Studio properties panel',
    getWidth: () => actions.getState().settings.studioRightWidthPx,
    onResizeEnd: (w) => actions.updateSettings({ studioRightWidthPx: w }),
    onDoubleClickReset: () => 276,
  });

  const workspace = el(
    'div',
    { className: 'qv-studio-layout' },
    leftDock,
    leftResizer,
    stageWrap,
    rightResizer,
    rightDock,
  );

  const shell = el('div', { className: 'qv-studio-shell' }, studioBar, workspace);
  container.appendChild(shell);

  leftBody.scrollTop = savedStudioLeftScroll;
  rightBody.scrollTop = savedStudioRightScroll;
  stageScroll.scrollTop = savedStudioStageScrollTop;
  requestAnimationFrame(() => {
    leftBody.scrollTop = savedStudioLeftScroll;
    rightBody.scrollTop = savedStudioRightScroll;
    stageScroll.scrollTop = savedStudioStageScrollTop;
  });
}
