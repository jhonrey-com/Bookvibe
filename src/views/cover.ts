import type { AppActions } from '../core/app-context';
import {
  COVER_TEMPLATES,
  defaultBookCover,
  downscaleImageFileToDataUrl,
  estimateSpineInches,
} from '../core/cover';
import { FONT_STACKS, TRIM_SPECS } from '../core/export';
import { ensureAuthorIdentity } from '../core/identity';
import { normalizeProjectDefaults } from '../core/library';
import type { BookCoverConfig, CoverTemplateId } from '../core/types';
import { clearNode, el, icon } from '../ui/dom';

let coverWrapMode: 'front' | 'full-wrap' = 'front';
type CoverElementKey = keyof BookCoverConfig['elements'];
let activeElementKey: CoverElementKey = 'title';

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

  const frontW = Math.round(trim.widthIn * 64);
  const frontH = Math.round(trim.heightIn * 64);
  const spineInches = estimateSpineInches(project);

  const controls = el('aside', { className: 'bv-typeset-controls' });

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

  const wrapModeSel = el(
    'select',
    {
      className: 'bv-input',
      on: {
        change: () => {
          coverWrapMode = wrapModeSel.value as 'front' | 'full-wrap';
          renderCoverStudio(container, actions);
        },
      },
    },
    el('option', { text: 'Front Cover Only', attrs: { value: 'front', selected: coverWrapMode === 'front' } }),
    el('option', {
      text: `Full Print Wrap (${spineInches}" spine)`,
      attrs: { value: 'full-wrap', selected: coverWrapMode === 'full-wrap' },
    }),
  );

  const bgColorIn = el('input', {
    attrs: { type: 'color', value: cover.backgroundColor },
    style: { width: '100%', height: '30px', border: '0', background: 'transparent' },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, backgroundColor: bgColorIn.value })) },
  });
  const accentColorIn = el('input', {
    attrs: { type: 'color', value: cover.accentColor },
    style: { width: '100%', height: '30px', border: '0', background: 'transparent' },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, accentColor: accentColorIn.value })) },
  });
  const textColorIn = el('input', {
    attrs: { type: 'color', value: cover.textColor },
    style: { width: '100%', height: '30px', border: '0', background: 'transparent' },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, textColor: textColorIn.value })) },
  });

  const editionIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: cover.editionLabel },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, editionLabel: editionIn.value })) },
  });

  const blurbIn = el('textarea', {
    className: 'bv-textarea',
    attrs: { rows: 4, placeholder: 'Back cover synopsis blurb…' },
    on: { change: () => mutateCover(actions, (c) => ({ ...c, backBlurb: blurbIn.value })) },
  });
  blurbIn.value = cover.backBlurb;

  const artFileInput = el('input', {
    attrs: { type: 'file', accept: 'image/png,image/jpeg,image/webp' },
    style: { display: 'none' },
    on: {
      change: async () => {
        const file = artFileInput.files?.[0];
        if (!file) return;
        try {
          const url = await downscaleImageFileToDataUrl(file, 1400);
          mutateCover(actions, (c) => ({ ...c, backgroundImageDataUrl: url }));
          actions.notify('Updated cover artwork');
        } catch (err) {
          actions.notify(err instanceof Error ? err.message : 'Cover upload failed.');
        }
      },
    },
  });

  const overlayRange = el('input', {
    attrs: { type: 'range', min: 0, max: 0.85, step: 0.05, value: cover.imageOverlayOpacity },
    on: {
      input: () =>
        mutateCover(actions, (c) => ({ ...c, imageOverlayOpacity: Number(overlayRange.value) })),
    },
  });

  // Selected Cover Element Typography Controls
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
    attrs: { type: 'checkbox', checked: activeEl.visible },
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

  controls.append(
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Cover Template & Format' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Preview Mode' }), wrapModeSel),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Template' }), templateSel),
      el(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' } },
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Cover' }), bgColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Accent' }), accentColorIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Ink' }), textColorIn),
      ),
    ),
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Cover Artwork & Text' }),
      el(
        'div',
        { style: { display: 'flex', gap: '6px' } },
        el(
          'button',
          {
            className: 'bv-btn',
            style: { flex: '1', justifyContent: 'center' },
            attrs: { type: 'button' },
            on: { click: () => artFileInput.click() },
          },
          icon('image', 14),
          cover.backgroundImageDataUrl ? 'Replace Cover Image' : 'Upload Cover Image',
        ),
        cover.backgroundImageDataUrl
          ? el('button', {
              className: 'bv-mini-btn',
              text: 'Clear',
              attrs: { type: 'button' },
              on: { click: () => mutateCover(actions, (c) => ({ ...c, backgroundImageDataUrl: '' })) },
            })
          : null,
        artFileInput,
      ),
      el(
        'div',
        { className: 'bv-field' },
        el('label', { className: 'bv-label', text: `Artwork Dimming (${Math.round(cover.imageOverlayOpacity * 100)}%)` }),
        overlayRange,
      ),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Edition Line' }), editionIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Back Cover Blurb' }), blurbIn),
    ),
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Drag-and-Drop Text Layer' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Active Element' }), elKeySel),
      el(
        'div',
        { className: 'bv-field' },
        el('label', { className: 'bv-label', text: `Font Size (${activeEl.fontSize}px)` }),
        elFontSizeIn,
      ),
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
      el(
        'button',
        {
          className: 'bv-btn bv-btn-primary',
          attrs: { type: 'button' },
          on: { click: () => void actions.exportCoverPng() },
        },
        icon('download', 14),
        'Export Cover PNG (1200×1920)',
      ),
      el(
        'button',
        {
          className: 'bv-btn',
          attrs: { type: 'button' },
          on: { click: () => void actions.exportEpub() },
        },
        icon('book', 14),
        'Export EPUB 3 with This Cover',
      ),
    ),
  );

  // Interactive Live Cover Canvas
  const stage = el('div', { className: 'bv-cover-stage' });
  const fontCss = FONT_STACKS[project.typography.fontFamily].css;

  const frontCanvas = el('div', {
    className: 'bv-cover-front',
    style: {
      width: `${frontW}px`,
      height: `${frontH}px`,
      background: cover.backgroundColor,
      color: cover.textColor,
      fontFamily: fontCss,
    },
    on: {
      dragover: (e) => {
        if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
      },
      drop: async (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        e.preventDefault();
        try {
          const url = await downscaleImageFileToDataUrl(file, 1400);
          mutateCover(actions, (c) => ({ ...c, backgroundImageDataUrl: url }));
          actions.notify('Applied dropped cover artwork');
        } catch (err) {
          actions.notify(err instanceof Error ? err.message : 'Unsupported image file.');
        }
      },
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
        },
      }),
    );
    frontCanvas.appendChild(
      el('div', {
        style: {
          position: 'absolute',
          inset: '0',
          background: cover.backgroundColor,
          opacity: String(cover.imageOverlayOpacity),
          pointerEvents: 'none',
        },
      }),
    );
  }

  // Template decorative frame
  if (cover.template === 'obsidian-foil' || cover.template === 'ivory-classic') {
    frontCanvas.appendChild(
      el('div', {
        style: {
          position: 'absolute',
          inset: '26px',
          border: `1.5px solid ${cover.accentColor}`,
          pointerEvents: 'none',
        },
      }),
    );
  } else if (cover.template === 'editorial-band') {
    frontCanvas.appendChild(
      el('div', {
        style: {
          position: 'absolute',
          left: '0',
          right: '0',
          top: '62%',
          height: '6px',
          background: cover.accentColor,
          pointerEvents: 'none',
        },
      }),
    );
  } else if (cover.template === 'minimal-spine') {
    frontCanvas.appendChild(
      el('div', {
        style: {
          position: 'absolute',
          left: '26px',
          top: '26px',
          bottom: '26px',
          width: '5px',
          background: cover.accentColor,
          pointerEvents: 'none',
        },
      }),
    );
  }

  // Draggable Cover Text / Signature Layers
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
              elements: {
                ...c.elements,
                [key]: { ...cover.elements[key] },
              },
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
  makeDraggableLayer(
    'title',
    el('div', { text: project.title, style: { fontWeight: '600', lineHeight: '1.12' } }),
  );
  makeDraggableLayer(
    'subtitle',
    el('div', { text: project.subtitle, style: { fontStyle: 'italic', opacity: '0.88' } }),
  );
  makeDraggableLayer(
    'author',
    el('div', {
      text: penName,
      style: { letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: '600' },
    }),
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
      el('div', {
        text: identity.signatureText,
        style: { fontStyle: 'italic', color: cover.accentColor, fontFamily: 'Georgia, serif' },
      }),
    );
  }

  const wrap = el('div', { className: 'bv-cover-wrap' });
  if (coverWrapMode === 'full-wrap') {
    const back = el(
      'div',
      {
        className: 'bv-cover-back',
        style: {
          width: `${frontW}px`,
          height: `${frontH}px`,
          background: cover.backgroundColor,
          color: cover.textColor,
          fontFamily: fontCss,
        },
      },
      el('div', {},
        el('div', {
          text: project.title,
          style: { fontWeight: '600', marginBottom: '12px', color: cover.accentColor },
        }),
        el('p', { text: cover.backBlurb, style: { fontSize: '13px', lineHeight: '1.6', margin: '0' } }),
      ),
      el('div', {
        className: 'bv-mono-tag',
        style: { color: cover.textColor, opacity: '0.7' },
        text: `${trim.label} · ${identity.authorKeyId || 'Unsigned Draft'}`,
      }),
    );

    const spine = el('div', {
      className: 'bv-cover-spine',
      text: `${project.title}  ·  ${penName}`,
      style: {
        background: cover.backgroundColor,
        color: cover.accentColor,
      },
    });
    wrap.append(back, spine);
  }
  wrap.appendChild(frontCanvas);

  stage.append(
    el('span', {
      className: 'bv-mono-tag',
      text: `Drag title, author, or signature directly on the cover · Drop PNG/JPEG/WebP artwork anywhere on the cover (${trim.label})`,
    }),
    wrap,
  );

  const layout = el('div', { className: 'bv-typeset-layout' }, controls, stage);
  container.appendChild(layout);
}
