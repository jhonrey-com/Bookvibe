import type { AppActions } from '../core/app-context';
import {
  BUILT_IN_COVER_ORNAMENTS,
  COVER_TEMPLATES,
  createGraphicLayerFromDataUrl,
  defaultBookCover,
  downscaleImageFileToDataUrl,
  encodeSvgStringToDataUrl,
  estimateSpineInches,
} from '../core/cover';
import { TRIM_SPECS } from '../core/export';
import { getAllAvailableFontChoices, resolveEffectiveFontCss } from '../core/fonts';
import { ensureAuthorIdentity } from '../core/identity';
import { normalizeProjectDefaults } from '../core/library';
import type {
  BookCoverConfig,
  CoverFaceId,
  CoverGraphicLayer,
  CoverTemplateId,
} from '../core/types';
import { clearNode, el, icon } from '../ui/dom';

type CoverPreviewMode = 'front' | 'back' | 'spine' | 'full-wrap' | 'dust-jacket';
let coverWrapMode: CoverPreviewMode = 'front';
type CoverElementKey = keyof BookCoverConfig['elements'];
let activeElementKey: CoverElementKey = 'title';
let activeGraphicLayerId = '';

function mutateCover(
  actions: AppActions,
  updater: (cover: BookCoverConfig) => BookCoverConfig,
  rerender = true,
): void {
  actions.mutateProject((prev) => {
    const next = normalizeProjectDefaults(prev);
    next.cover = updater(next.cover ?? defaultBookCover(next));
    return next;
  }, rerender);
}

export function renderCoverStudio(container: HTMLElement, actions: AppActions): void {
  clearNode(container);
  const project = normalizeProjectDefaults(actions.getState().project);
  const cover = project.cover ?? defaultBookCover(project);
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author;
  const trim = TRIM_SPECS[project.typography.trimSize];

  const frontW = Math.round(trim.widthIn * 62);
  const frontH = Math.round(trim.heightIn * 62);
  const spineInches = estimateSpineInches(project);
  const graphicLayers = cover.graphicLayers ?? [];
  const selectedGraphic = graphicLayers.find((g) => g.id === activeGraphicLayerId) ?? null;

  const controls = el('aside', { className: 'bv-typeset-controls' });

  const wrapModeSel = el(
    'select',
    {
      className: 'bv-input',
      on: {
        change: () => {
          coverWrapMode = wrapModeSel.value as CoverPreviewMode;
          renderCoverStudio(container, actions);
        },
      },
    },
    el('option', { text: 'Front Cover', attrs: { value: 'front', selected: coverWrapMode === 'front' } }),
    el('option', { text: 'Back Cover', attrs: { value: 'back', selected: coverWrapMode === 'back' } }),
    el('option', { text: `Spine / Side (${spineInches}")`, attrs: { value: 'spine', selected: coverWrapMode === 'spine' } }),
    el('option', { text: `Full Print Wrap (Back + Spine + Front)`, attrs: { value: 'full-wrap', selected: coverWrapMode === 'full-wrap' } }),
    el('option', { text: 'Dust Jacket (+ Flaps)', attrs: { value: 'dust-jacket', selected: coverWrapMode === 'dust-jacket' } }),
  );

  const templateSel = el(
    'select',
    {
      className: 'bv-input',
      on: {
        change: () => {
          const preset = COVER_TEMPLATES.find((t) => t.id === templateSel.value);
          if (!preset) return;
          mutateCover(actions, (c) => ({
            ...c,
            template: preset.id as CoverTemplateId,
            backgroundColor: preset.backgroundColor,
            backBackgroundColor: preset.backgroundColor,
            spineBackgroundColor: preset.backgroundColor,
            accentColor: preset.accentColor,
            textColor: preset.textColor,
          }));
        },
      },
    },
    ...COVER_TEMPLATES.map((t) =>
      el('option', {
        text: t.label,
        attrs: { value: t.id, selected: cover.template === t.id },
      }),
    ),
  );

  const fontChoices = getAllAvailableFontChoices();
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
      text: 'Inherit Book Interior Font',
      attrs: { value: '', selected: !cover.customFontFamily },
    }),
    ...fontChoices.map((fc) =>
      el('option', {
        text: fc.label,
        attrs: { value: fc.builtInKey ?? fc.id, selected: cover.customFontFamily === (fc.builtInKey ?? fc.id) },
      }),
    ),
  );

  const bgColorIn = el('input', {
    className: 'bv-color-input',
    attrs: { type: 'color', value: cover.backgroundColor },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, backgroundColor: bgColorIn.value })) },
  });
  const backColorIn = el('input', {
    className: 'bv-color-input',
    attrs: { type: 'color', value: cover.backBackgroundColor || cover.backgroundColor },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, backBackgroundColor: backColorIn.value })) },
  });
  const spineColorIn = el('input', {
    className: 'bv-color-input',
    attrs: { type: 'color', value: cover.spineBackgroundColor || cover.backgroundColor },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, spineBackgroundColor: spineColorIn.value })) },
  });
  const accentColorIn = el('input', {
    className: 'bv-color-input',
    attrs: { type: 'color', value: cover.accentColor },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, accentColor: accentColorIn.value })) },
  });
  const textColorIn = el('input', {
    className: 'bv-color-input',
    attrs: { type: 'color', value: cover.textColor },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, textColor: textColorIn.value })) },
  });

  const editionIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: cover.editionLabel },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, editionLabel: editionIn.value })) },
  });

  const spineTitleIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: cover.spineTitle || '', placeholder: project.title },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, spineTitle: spineTitleIn.value })) },
  });

  const backHeadIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: cover.backHeadline || '', placeholder: 'Back cover headline…' },
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
    attrs: { rows: 2, placeholder: 'Author biography for back cover…' },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, authorBio: bioIn.value })) },
  });
  bioIn.value = cover.authorBio || '';

  const barcodeChk = el('input', {
    className: 'bv-lever',
    attrs: { type: 'checkbox', role: 'switch', checked: cover.showBarcodeBox !== false },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, showBarcodeBox: barcodeChk.checked })) },
  });

  const frontFlapIn = el('textarea', {
    className: 'bv-textarea',
    attrs: { rows: 2, placeholder: 'Front inside flap copy…' },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, frontFlapText: frontFlapIn.value })) },
  });
  frontFlapIn.value = cover.frontFlapText || '';

  const backFlapIn = el('textarea', {
    className: 'bv-textarea',
    attrs: { rows: 2, placeholder: 'Back inside flap copy…' },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, backFlapText: backFlapIn.value })) },
  });
  backFlapIn.value = cover.backFlapText || '';

  const artFileInput = el('input', {
    attrs: { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml,.svg' },
    style: { display: 'none' },
    on: {
      change: async () => {
        const file = artFileInput.files?.[0];
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
        if (!file) return;
        await addDroppedGraphicToFace(
          coverWrapMode === 'back' || coverWrapMode === 'spine' ? coverWrapMode : 'front',
          file,
        );
      },
    },
  });

  const addDroppedGraphicToFace = async (face: CoverFaceId, file: File) => {
    try {
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      const url = await downscaleImageFileToDataUrl(file, 1000);
      const layer = createGraphicLayerFromDataUrl(face, file.name, url, isSvg ? 'svg' : 'image');
      activeGraphicLayerId = layer.id;
      mutateCover(actions, (c) => ({
        ...c,
        graphicLayers: [...(c.graphicLayers ?? []), layer],
      }));
      actions.notify(`Placed "${layer.name}" on ${face} cover`);
    } catch (err) {
      actions.notify(err instanceof Error ? err.message : 'Unsupported image or SVG file.');
    }
  };

  const overlayRange = el('input', {
    attrs: { type: 'range', min: 0, max: 0.85, step: 0.05, value: cover.imageOverlayOpacity },
    on: {
      input: () =>
        mutateCover(actions, (c) => ({ ...c, imageOverlayOpacity: Number(overlayRange.value) })),
    },
  });

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

  const elFontSizeIn = el('input', {
    attrs: { type: 'range', min: 10, max: 54, step: 1, value: activeEl.fontSize },
    on: {
      input: () =>
        mutateCover(actions, (c) => ({
          ...c,
          elements: {
            ...c.elements,
            [activeElementKey]: { ...c.elements[activeElementKey], fontSize: Number(elFontSizeIn.value) },
          },
        })),
    },
  });

  const elVisibleChk = el('input', {
    className: 'bv-lever',
    attrs: { type: 'checkbox', role: 'switch', checked: activeEl.visible },
    on: {
      change: () =>
        mutateCover(actions, (c) => ({
          ...c,
          elements: {
            ...c.elements,
            [activeElementKey]: { ...c.elements[activeElementKey], visible: elVisibleChk.checked },
          },
        })),
    },
  });

  const ornamentRow = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
  for (const orn of BUILT_IN_COVER_ORNAMENTS) {
    ornamentRow.appendChild(
      el('button', {
        className: 'bv-mini-btn',
        text: `+ ${orn.name}`,
        attrs: { type: 'button' },
        on: {
          click: () => {
            const targetFace: CoverFaceId =
              coverWrapMode === 'back' || coverWrapMode === 'spine' ? coverWrapMode : 'front';
            const layer = createGraphicLayerFromDataUrl(
              targetFace,
              orn.name,
              encodeSvgStringToDataUrl(orn.svgMarkup),
              'svg',
            );
            activeGraphicLayerId = layer.id;
            mutateCover(actions, (c) => ({
              ...c,
              graphicLayers: [...(c.graphicLayers ?? []), layer],
            }));
          },
        },
      }),
    );
  }

  let selectedGraphicGroup: HTMLElement | null = null;
  if (selectedGraphic) {
    const widthRange = el('input', {
      attrs: { type: 'range', min: 8, max: 95, step: 2, value: selectedGraphic.widthPct },
      on: {
        input: () =>
          mutateCover(actions, (c) => ({
            ...c,
            graphicLayers: (c.graphicLayers ?? []).map((g) =>
              g.id === selectedGraphic.id ? { ...g, widthPct: Number(widthRange.value) } : g,
            ),
          })),
      },
    });
    const rotRange = el('input', {
      attrs: { type: 'range', min: -180, max: 180, step: 5, value: selectedGraphic.rotationDeg },
      on: {
        input: () =>
          mutateCover(actions, (c) => ({
            ...c,
            graphicLayers: (c.graphicLayers ?? []).map((g) =>
              g.id === selectedGraphic.id ? { ...g, rotationDeg: Number(rotRange.value) } : g,
            ),
          })),
      },
    });
    const opRange = el('input', {
      attrs: { type: 'range', min: 0.1, max: 1, step: 0.05, value: selectedGraphic.opacity },
      on: {
        input: () =>
          mutateCover(actions, (c) => ({
            ...c,
            graphicLayers: (c.graphicLayers ?? []).map((g) =>
              g.id === selectedGraphic.id ? { ...g, opacity: Number(opRange.value) } : g,
            ),
          })),
      },
    });

    selectedGraphicGroup = el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: `Graphic Layer · ${selectedGraphic.name}` }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Scale (${selectedGraphic.widthPct}%)` }), widthRange),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Rotation (${selectedGraphic.rotationDeg}°)` }), rotRange),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Opacity (${Math.round(selectedGraphic.opacity * 100)}%)` }), opRange),
      el(
        'button',
        {
          className: 'bv-mini-btn',
          attrs: { type: 'button' },
          on: {
            click: () => {
              const delId = selectedGraphic.id;
              activeGraphicLayerId = '';
              mutateCover(actions, (c) => ({
                ...c,
                graphicLayers: (c.graphicLayers ?? []).filter((g) => g.id !== delId),
              }));
            },
          },
        },
        icon('trash', 12),
        'Remove Layer',
      ),
    );
  }

  controls.append(
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Cover Faces & Palette' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Design View' }), wrapModeSel),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Template' }), templateSel),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Cover Typography' }), coverFontSel),
      el(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' } },
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Front' }), bgColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back' }), backColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Spine' }), spineColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Accent' }), accentColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Ink' }), textColorIn),
      ),
    ),
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'SVG, Transparent Images & Artwork' }),
      el(
        'div',
        { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        el(
          'button',
          {
            className: 'bv-btn bv-btn-primary',
            style: { flex: '1', justifyContent: 'center' },
            attrs: { type: 'button' },
            on: { click: () => layerFileInput.click() },
          },
          icon('image', 14),
          'Add SVG / PNG Sticker…',
        ),
        el(
          'button',
          {
            className: 'bv-btn',
            attrs: { type: 'button' },
            on: { click: () => artFileInput.click() },
          },
          cover.backgroundImageDataUrl ? 'Replace Bg' : 'Full Bg…',
        ),
        cover.backgroundImageDataUrl
          ? el('button', {
              className: 'bv-mini-btn',
              text: 'Clear Bg',
              attrs: { type: 'button' },
              on: { click: () => mutateCover(actions, (c) => ({ ...c, backgroundImageDataUrl: '' })) },
            })
          : null,
        artFileInput,
        layerFileInput,
      ),
      ornamentRow,
      el(
        'div',
        { className: 'bv-field' },
        el('label', { className: 'bv-label', text: `Bg Artwork Dimming (${Math.round(cover.imageOverlayOpacity * 100)}%)` }),
        overlayRange,
      ),
    ),
    ...(selectedGraphicGroup ? [selectedGraphicGroup] : []),
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Front Text Layer' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Layer' }), elKeySel),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Size (${activeEl.fontSize}px)` }), elFontSizeIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Edition Banner' }), editionIn),
      el(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
        elVisibleChk,
        'Visible on Front Cover',
      ),
    ),
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Back Cover, Spine & Flaps' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Spine Title Override' }), spineTitleIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back Headline' }), backHeadIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back Blurb' }), blurbIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Author Bio' }), bioIn),
      el(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
        barcodeChk,
        'Include ISBN / Barcode Box',
      ),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Front Flap' }), frontFlapIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back Flap' }), backFlapIn),
    ),
    el(
      'div',
      { className: 'bv-field-group' },
      el(
        'button',
        {
          className: 'bv-btn bv-btn-primary',
          attrs: { type: 'button' },
          on: { click: () => void actions.exportCoverPng() },
        },
        icon('download', 14),
        'Export Front Cover PNG',
      ),
      el(
        'button',
        {
          className: 'bv-btn',
          attrs: { type: 'button' },
          on: { click: () => void actions.exportFullWrapPng() },
        },
        icon('download', 14),
        'Export Full Print Wrap PNG',
      ),
      el(
        'button',
        {
          className: 'bv-btn',
          attrs: { type: 'button' },
          on: { click: () => void actions.exportEpub() },
        },
        icon('book', 14),
        'Export EPUB 3 with Cover',
      ),
    ),
  );

  // Interactive Live Cover Canvas
  const stage = el('div', { className: 'bv-cover-stage' });
  const fontCss = cover.customFontFamily
    ? resolveEffectiveFontCss(project.typography.fontFamily, cover.customFontFamily)
    : resolveEffectiveFontCss(project.typography.fontFamily, project.typography.customFontFamily);

  const attachGraphicDropAndRender = (faceEl: HTMLElement, face: CoverFaceId) => {
    faceEl.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
    faceEl.addEventListener('drop', async (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      e.preventDefault();
      await addDroppedGraphicToFace(face, file);
    });

    const faceGraphics = graphicLayers.filter((g) => g.face === face);
    for (const gLayer of faceGraphics) {
      let dragging = false;
      const gNode = el(
        'div',
        {
          className: `bv-cover-drag-item bv-cover-graphic-layer${gLayer.id === activeGraphicLayerId ? ' is-selected' : ''}`,
          style: {
            left: `${gLayer.xPct}%`,
            top: `${gLayer.yPct}%`,
            width: `${gLayer.widthPct}%`,
            opacity: String(gLayer.opacity),
            transform: `translate(-50%, -50%) rotate(${gLayer.rotationDeg}deg)`,
          },
          on: {
            pointerdown: (e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              activeGraphicLayerId = gLayer.id;
              dragging = true;
              gNode.setPointerCapture(e.pointerId);
            },
            pointermove: (e) => {
              if (!dragging) return;
              const rect = faceEl.getBoundingClientRect();
              const xPct = Math.round(Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100)));
              const yPct = Math.round(Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100)));
              gNode.style.left = `${xPct}%`;
              gNode.style.top = `${yPct}%`;
              gLayer.xPct = xPct;
              gLayer.yPct = yPct;
            },
            pointerup: () => {
              if (!dragging) return;
              dragging = false;
              const snapshotLayer: CoverGraphicLayer = { ...gLayer };
              mutateCover(actions, (c) => ({
                ...c,
                graphicLayers: (c.graphicLayers ?? []).map((item) =>
                  item.id === snapshotLayer.id ? snapshotLayer : item,
                ),
              }));
            },
          },
        },
        el('img', {
          attrs: { src: gLayer.dataUrl, alt: gLayer.name },
          style: { width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' },
        }),
      );
      faceEl.appendChild(gNode);
    }
  };

  const buildFrontFace = (): HTMLElement => {
    const frontCanvas = el('div', {
      className: 'bv-cover-front',
      style: {
        width: `${frontW}px`,
        height: `${frontH}px`,
        background: cover.backgroundColor,
        color: cover.textColor,
        fontFamily: fontCss,
      },
    });

    if (cover.backgroundImageDataUrl) {
      frontCanvas.appendChild(
        el('img', {
          attrs: { src: cover.backgroundImageDataUrl, alt: 'Cover artwork' },
          style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' },
        }),
      );
      frontCanvas.appendChild(
        el('div', {
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

    attachGraphicDropAndRender(frontCanvas, 'front');

    const makeDraggableLayer = (key: CoverElementKey, content: HTMLElement | string) => {
      const placement = cover.elements[key];
      if (!placement.visible) return;
      let dragging = false;
      const node = el(
        'div',
        {
          className: 'bv-cover-drag-item',
          style: {
            left: `${placement.xPct}%`,
            top: `${placement.yPct}%`,
            fontSize: `${placement.fontSize}px`,
            textAlign: placement.align,
            borderColor: activeElementKey === key ? 'rgba(255,255,255,0.45)' : 'transparent',
          },
          on: {
            pointerdown: (e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              activeElementKey = key;
              activeGraphicLayerId = '';
              dragging = true;
              node.setPointerCapture(e.pointerId);
            },
            pointermove: (e) => {
              if (!dragging) return;
              const rect = frontCanvas.getBoundingClientRect();
              const xPct = Math.round(Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100)));
              const yPct = Math.round(Math.max(6, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100)));
              node.style.left = `${xPct}%`;
              node.style.top = `${yPct}%`;
              cover.elements[key].xPct = xPct;
              cover.elements[key].yPct = yPct;
            },
            pointerup: () => {
              if (!dragging) return;
              dragging = false;
              mutateCover(actions, (c) => ({
                ...c,
                elements: { ...c.elements, [key]: { ...cover.elements[key] } },
              }));
            },
          },
        },
        content,
      );
      frontCanvas.appendChild(node);
    };

    makeDraggableLayer(
      'edition',
      el('div', {
        text: cover.editionLabel,
        style: { letterSpacing: '0.16em', textTransform: 'uppercase', color: cover.accentColor, fontWeight: '600' },
      }),
    );
    makeDraggableLayer('title', el('div', { text: project.title, style: { fontWeight: '600', lineHeight: '1.12' } }));
    makeDraggableLayer('subtitle', el('div', { text: project.subtitle, style: { fontStyle: 'italic', opacity: '0.88' } }));
    makeDraggableLayer(
      'author',
      el('div', { text: penName, style: { letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: '600' } }),
    );
    if (identity.signatureSvgDataUrl) {
      makeDraggableLayer(
        'signature',
        el('img', {
          attrs: { src: identity.signatureSvgDataUrl, alt: 'Author Signature' },
          style: { height: '38px', maxWidth: '180px', objectFit: 'contain', pointerEvents: 'none' },
        }),
      );
    } else if (identity.signatureText) {
      makeDraggableLayer(
        'signature',
        el('div', { text: identity.signatureText, style: { fontStyle: 'italic', color: cover.accentColor, fontFamily: 'Georgia, serif' } }),
      );
    }
    return frontCanvas;
  };

  const buildBackFace = (): HTMLElement => {
    const back = el(
      'div',
      {
        className: 'bv-cover-back',
        style: {
          position: 'relative',
          width: `${frontW}px`,
          height: `${frontH}px`,
          background: cover.backBackgroundColor || cover.backgroundColor,
          color: cover.textColor,
          fontFamily: fontCss,
        },
      },
      el(
        'div',
        {},
        el('div', {
          text: cover.backHeadline || project.title,
          style: { fontWeight: '600', fontSize: '15px', marginBottom: '12px', color: cover.accentColor },
        }),
        el('p', { text: cover.backBlurb, style: { fontSize: '12.5px', lineHeight: '1.6', margin: '0 0 14px' } }),
        cover.authorBio
          ? el('p', { text: cover.authorBio, style: { fontSize: '11.5px', lineHeight: '1.5', opacity: '0.78', margin: '0' } })
          : null,
      ),
      el(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' } },
        el('div', {
          className: 'bv-mono-tag',
          style: { color: cover.textColor, opacity: '0.7' },
          text: `${trim.label} · ${project.publishing?.imprintName || 'Independent'}`,
        }),
        cover.showBarcodeBox !== false
          ? el(
              'div',
              { className: 'bv-cover-barcode' },
              el('div', { className: 'bv-barcode-bars' }),
              el('span', { text: project.publishing?.isbn || 'ISBN 000-0-00-000000-0' }),
            )
          : null,
      ),
    );
    attachGraphicDropAndRender(back, 'back');
    return back;
  };

  const buildSpineFace = (): HTMLElement => {
    const spineW = coverWrapMode === 'spine' ? 88 : 38;
    const spine = el(
      'div',
      {
        className: 'bv-cover-spine',
        style: {
          position: 'relative',
          width: `${spineW}px`,
          height: `${frontH}px`,
          background: cover.spineBackgroundColor || cover.backgroundColor,
          color: cover.accentColor,
          fontFamily: fontCss,
        },
      },
      el('span', { text: `${cover.spineTitle || project.title}  ·  ${penName}` }),
    );
    attachGraphicDropAndRender(spine, 'spine');
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
    attachGraphicDropAndRender(flap, side);
    return flap;
  };

  const wrap = el('div', { className: 'bv-cover-wrap' });
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

  stage.append(
    el('span', {
      className: 'bv-mono-tag',
      text: `Drop .svg (Canva / vector) or transparent .png onto any cover face · Drag layers to position (${trim.label})`,
    }),
    wrap,
  );

  const layout = el('div', { className: 'bv-typeset-layout' }, controls, stage);
  container.appendChild(layout);
}
