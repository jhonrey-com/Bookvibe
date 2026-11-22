import type { AppActions, TypesetSubTab } from '../core/app-context';
import { COLLABORATOR_ROLE_LABELS } from '../core/collab';
import {
  FONT_STACKS,
  TRIM_SPECS,
  applySmartTypography,
  convertSceneProseToParagraphs,
  formatChapterLabel,
} from '../core/export';
import { BOOKVIBE_EXTENSIONS } from '../core/extensions';
import {
  ensureAuthorIdentity,
  generateAuthorKeyPair,
  signManuscript,
} from '../core/identity';
import { normalizeProjectDefaults } from '../core/library';
import { getAllScenes, getProjectWordCount } from '../core/manuscript';
import type {
  ChapterNumeralStyle,
  FontFamilyId,
  TrimSize,
  TypographyConfig,
} from '../core/types';
import { clearNode, el, icon } from '../ui/dom';
import { LiquidGlassControl } from '../ui/liquid-glass';
import { renderCoverStudio } from './cover';

let activeTypesetGlass: LiquidGlassControl<TypesetSubTab> | null = null;

function updateTypography(actions: AppActions, patch: Partial<TypographyConfig>): void {
  actions.mutateProject((prev) => ({
    ...prev,
    typography: { ...prev.typography, ...patch },
  }));
}

function appendInlineStyledText(target: HTMLElement, text: string): void {
  const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      target.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      target.appendChild(el('strong', { text: token.slice(2, -2) }));
    } else {
      target.appendChild(el('em', { text: token.slice(1, -1) }));
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    target.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}

export function renderTypesetView(container: HTMLElement, actions: AppActions): void {
  if (activeTypesetGlass) {
    activeTypesetGlass.destroy();
    activeTypesetGlass = null;
  }
  clearNode(container);

  const state = actions.getState();
  const subSwitcher = new LiquidGlassControl<TypesetSubTab>({
    ariaLabel: 'Publishing mode',
    surface: 'solid',
    compact: true,
    value: state.typesetSubTab,
    options: [
      { id: 'interior', label: 'Interior Typeset', icon: 'typeset' },
      { id: 'cover', label: 'Book Cover Studio', icon: 'image' },
      { id: 'publish', label: 'Publish & Author Key', icon: 'key' },
    ],
    onChange: (tab) => actions.setState({ typesetSubTab: tab }, true),
  });
  activeTypesetGlass = subSwitcher;

  const subbar = el(
    'div',
    { className: 'bv-subbar' },
    subSwitcher.element,
    el(
      'div',
      { className: 'bv-subbar-group' },
      el(
        'button',
        {
          className: 'bv-btn bv-btn-primary',
          attrs: { type: 'button' },
          on: { click: () => void actions.exportEpub() },
        },
        icon('download', 14),
        'Export EPUB 3',
      ),
      el(
        'button',
        {
          className: 'bv-btn',
          attrs: { type: 'button' },
          on: { click: () => actions.printTypeset() },
        },
        icon('printer', 14),
        'Print PDF',
      ),
    ),
  );

  const bodyContainer = el('div', { style: { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' } });
  container.append(subbar, bodyContainer);

  if (state.typesetSubTab === 'cover') {
    renderCoverStudio(bodyContainer, actions);
    return;
  }

  if (state.typesetSubTab === 'publish') {
    renderPublishReadinessTab(bodyContainer, actions);
    return;
  }

  renderInteriorTypeset(bodyContainer, actions);
}

function renderInteriorTypeset(container: HTMLElement, actions: AppActions): void {
  const project = normalizeProjectDefaults(actions.getState().project);
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author;
  const typo = project.typography;

  const controls = el('aside', { className: 'bv-typeset-controls' });

  const titleIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: project.title },
    on: { change: () => actions.mutateProject((p) => ({ ...p, title: titleIn.value })) },
  });
  const subIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: project.subtitle },
    on: { change: () => actions.mutateProject((p) => ({ ...p, subtitle: subIn.value })) },
  });
  const authorIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: penName },
    on: {
      change: () =>
        actions.mutateProject((p) => {
          const next = normalizeProjectDefaults(p);
          next.author = authorIn.value;
          next.authorIdentity!.penName = authorIn.value;
          return next;
        }),
    },
  });

  const trimSelect = el('select', {
    className: 'bv-input',
    on: { change: () => updateTypography(actions, { trimSize: trimSelect.value as TrimSize }) },
  });
  for (const spec of Object.values(TRIM_SPECS)) {
    trimSelect.appendChild(
      el('option', { text: spec.label, attrs: { value: spec.id, selected: typo.trimSize === spec.id } }),
    );
  }

  const fontSelect = el('select', {
    className: 'bv-input',
    on: {
      change: () => updateTypography(actions, { fontFamily: fontSelect.value as FontFamilyId }),
    },
  });
  for (const [id, info] of Object.entries(FONT_STACKS)) {
    fontSelect.appendChild(
      el('option', { text: info.label, attrs: { value: id, selected: typo.fontFamily === id } }),
    );
  }

  const numeralSelect = el('select', {
    className: 'bv-input',
    on: {
      change: () =>
        updateTypography(actions, {
          chapterNumeralStyle: numeralSelect.value as ChapterNumeralStyle,
        }),
    },
  });
  for (const [val, label] of [
    ['roman', 'Roman (Chapter I, II)'],
    ['word', 'Spelled (Chapter One, Two)'],
    ['numeric', 'Numeric (Chapter 1, 2)'],
  ] as const) {
    numeralSelect.appendChild(
      el('option', { text: label, attrs: { value: val, selected: typo.chapterNumeralStyle === val } }),
    );
  }

  const dropCapsToggle = el('input', {
    attrs: { type: 'checkbox', checked: typo.dropCaps },
    on: { change: () => updateTypography(actions, { dropCaps: dropCapsToggle.checked }) },
  });
  const smartTypeToggle = el('input', {
    attrs: { type: 'checkbox', checked: typo.smartTypography },
    on: { change: () => updateTypography(actions, { smartTypography: smartTypeToggle.checked }) },
  });
  const headerToggle = el('input', {
    attrs: { type: 'checkbox', checked: typo.runningHeader },
    on: { change: () => updateTypography(actions, { runningHeader: headerToggle.checked }) },
  });

  const fontSizeInput = el('input', {
    attrs: { type: 'range', min: 9, max: 14, step: 0.5, value: typo.fontSizePt },
    on: {
      input: () => updateTypography(actions, { fontSizePt: Number(fontSizeInput.value) }),
    },
  });

  const lineHeightInput = el('input', {
    attrs: { type: 'range', min: 1.3, max: 1.9, step: 0.05, value: typo.lineHeight },
    on: {
      input: () => updateTypography(actions, { lineHeight: Number(lineHeightInput.value) }),
    },
  });

  const extGrid = el('div', {
    style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' },
  });
  for (const item of BOOKVIBE_EXTENSIONS) {
    extGrid.appendChild(
      el(
        'button',
        {
          className: 'bv-mini-btn',
          style: { justifyContent: 'center', padding: '6px' },
          attrs: { type: 'button', title: item.purpose },
          on: { click: () => void actions.exportAsExtension(item.extension) },
        },
        item.extension,
      ),
    );
  }

  controls.append(
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Front Matter' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Title' }), titleIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Subtitle' }), subIn),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Pen Name / Author' }), authorIn),
    ),
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Book Interior Design' }),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Trim Size' }), trimSelect),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Typeface' }), fontSelect),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Chapter Numerals' }), numeralSelect),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Body Size (${typo.fontSizePt} pt)` }), fontSizeInput),
      el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: `Line Spacing (${typo.lineHeight})` }), lineHeightInput),
      el(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
        dropCapsToggle,
        'First-Paragraph Drop Caps',
      ),
      el(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
        smartTypeToggle,
        'Smart Curly Quotes & Em-Dashes',
      ),
      el(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
        headerToggle,
        'Running Page Headers',
      ),
    ),
    el(
      'div',
      { className: 'bv-field-group' },
      el('span', { className: 'bv-panel-title', text: 'Save Official Extension Format' }),
      extGrid,
      el('button', {
        className: 'bv-mini-btn',
        text: 'OS File Associations & Specs…',
        attrs: { type: 'button' },
        on: { click: () => actions.openExtensionsModal() },
      }),
    ),
  );

  const stage = el('div', { className: 'bv-typeset-preview-stage' });
  const trimSpec = TRIM_SPECS[typo.trimSize];
  const fontCss = FONT_STACKS[typo.fontFamily].css;
  const pageWidthPx = Math.round(trimSpec.widthIn * 92);

  if (typo.includeFrontMatter) {
    const creditsRows = (project.collaborators ?? []).map((c) =>
      el('p', {
        text: `${COLLABORATOR_ROLE_LABELS[c.role]}: ${c.creditLine}`,
        style: { margin: '2px 0', fontSize: '10.5px', color: '#615d54' },
      }),
    );

    const titlePage = el(
      'article',
      {
        className: 'bv-book-page',
        style: {
          maxWidth: `${pageWidthPx}px`,
          fontFamily: fontCss,
          textAlign: 'center',
          minHeight: `${Math.round(trimSpec.heightIn * 78)}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
      },
      el(
        'div',
        { style: { marginTop: '72px' } },
        el('h1', {
          text: typo.smartTypography ? applySmartTypography(project.title) : project.title,
          style: { fontSize: '30px', fontWeight: '500', margin: '0 0 8px' },
        }),
        el('p', {
          text: typo.smartTypography ? applySmartTypography(project.subtitle) : project.subtitle,
          style: { fontStyle: 'italic', color: '#4d4940', margin: '0 0 36px', fontSize: '15px' },
        }),
        el('p', {
          text: penName,
          style: { letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: '12px' },
        }),
        identity.signatureSvgDataUrl
          ? el('img', {
              attrs: { src: identity.signatureSvgDataUrl, alt: 'Signature' },
              style: { height: '32px', marginTop: '14px', filter: 'invert(1)' },
            })
          : identity.signatureText
            ? el('p', {
                text: identity.signatureText,
                style: { fontStyle: 'italic', color: '#5c5850', marginTop: '12px' },
              })
            : null,
      ),
      el(
        'div',
        { style: { fontSize: '11px', color: '#615d54' } },
        project.dedication ? el('p', { text: project.dedication, style: { fontStyle: 'italic' } }) : null,
        el('p', { text: project.copyrightNotice }),
        ...creditsRows,
        identity.authorKeyId
          ? el('p', {
              text: `Author Key ${identity.authorKeyId}${identity.manuscriptDigest ? ` · Seal ${identity.manuscriptDigest.slice(0, 12)}…` : ''}`,
              style: { fontSize: '9.5px', letterSpacing: '0.06em', opacity: '0.8' },
            })
          : null,
      ),
    );
    stage.appendChild(titlePage);
  }

  let chapNum = 0;
  for (const part of project.parts) {
    for (const chapter of part.chapters) {
      chapNum++;
      const chLabel = formatChapterLabel(chapNum, typo.chapterNumeralStyle);

      const page = el('article', {
        className: 'bv-book-page',
        style: {
          maxWidth: `${pageWidthPx}px`,
          fontFamily: fontCss,
          fontSize: `${typo.fontSizePt}pt`,
          lineHeight: String(typo.lineHeight),
          padding: `${Math.round(typo.marginInches * 54)}px`,
        },
      });

      if (typo.runningHeader) {
        page.appendChild(
          el(
            'div',
            { className: 'bv-book-page-running' },
            el('span', { text: penName }),
            el('span', { text: project.title }),
          ),
        );
      }

      page.append(
        el('div', {
          text: chLabel,
          style: {
            textAlign: 'center',
            fontSize: '10.5px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#5c5850',
            marginBottom: '6px',
          },
        }),
        el('h2', {
          text: typo.smartTypography ? applySmartTypography(chapter.title) : chapter.title,
          style: { textAlign: 'center', fontWeight: '500', fontSize: '23px', margin: '0 0 24px' },
        }),
      );

      chapter.scenes.forEach((scene, sIdx) => {
        if (sIdx > 0) {
          page.appendChild(
            el('p', {
              text: '* * *',
              style: { textAlign: 'center', letterSpacing: '0.35em', margin: '18px 0', color: '#5c5850' },
            }),
          );
        }
        const blocks = convertSceneProseToParagraphs(scene.content, typo.smartTypography);
        let isChapterLead = sIdx === 0;
        let isFlushAfterBreak = sIdx > 0;
        for (const block of blocks) {
          if (/^\*\s*\*\s*\*$/.test(block)) {
            page.appendChild(
              el('p', {
                text: '* * *',
                style: { textAlign: 'center', letterSpacing: '0.35em', margin: '18px 0', color: '#5c5850' },
              }),
            );
            isFlushAfterBreak = true;
            continue;
          }
          if (block.startsWith('> ')) {
            const bq = el('blockquote', {
              style: { fontStyle: 'italic', margin: '14px 24px', color: '#3b3832' },
            });
            appendInlineStyledText(bq, block.replace(/^>\s?/gm, ''));
            page.appendChild(bq);
            continue;
          }
          const startsWithLetter = /^\p{L}/u.test(block);
          const applyDropCap = isChapterLead && typo.dropCaps && startsWithLetter;
          const noIndent = isChapterLead || isFlushAfterBreak;
          const p = el('p', {
            className: applyDropCap ? 'bv-book-dropcap' : '',
            style: {
              margin: '0 0 6px',
              textIndent: noIndent ? '0' : '1.4em',
              textAlign: 'justify',
            },
          });
          appendInlineStyledText(p, block);
          isChapterLead = false;
          isFlushAfterBreak = false;
          page.appendChild(p);
        }
      });

      stage.appendChild(page);
    }
  }

  const layout = el('div', { className: 'bv-typeset-layout' }, controls, stage);
  container.appendChild(layout);
}

function renderPublishReadinessTab(container: HTMLElement, actions: AppActions): void {
  const project = normalizeProjectDefaults(actions.getState().project);
  const identity = ensureAuthorIdentity(project);
  const scenes = getAllScenes(project);
  const openAnnotationsCount = scenes.reduce(
    (acc, item) => acc + (item.scene.annotations ?? []).filter((a) => a.status === 'open').length,
    0,
  );
  const wordCount = getProjectWordCount(project);

  const checks = [
    {
      label: 'Book Title & Pen Name Configured',
      ok: Boolean(project.title.trim() && (identity.penName || project.author).trim()),
      detail: `${project.title} · ${identity.penName || project.author}`,
    },
    {
      label: 'Book Cover Ready',
      ok: Boolean(project.cover),
      detail: project.cover?.backgroundImageDataUrl
        ? 'Custom Cover Artwork + Typography'
        : `Template: ${project.cover?.template}`,
    },
    {
      label: 'Author Key & Manuscript Seal',
      ok: Boolean(identity.authorKeyId && identity.manuscriptDigest),
      detail: identity.manuscriptDigest
        ? `${identity.authorKeyId} (Signed ${new Date(identity.lastSignedAt).toLocaleDateString()})`
        : 'Generate & sign to lock edition digest',
    },
    {
      label: 'Proofreader Notes Resolved',
      ok: openAnnotationsCount === 0,
      detail:
        openAnnotationsCount === 0
          ? '0 open proofreader notes'
          : `${openAnnotationsCount} open annotation(s) waiting in Scenes`,
    },
    {
      label: 'Manuscript Content',
      ok: wordCount > 0,
      detail: `${wordCount.toLocaleString()} words across ${scenes.length} scenes`,
    },
  ];

  const penIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: identity.penName },
    on: {
      change: () =>
        actions.mutateProject((p) => {
          const next = normalizeProjectDefaults(p);
          next.author = penIn.value;
          next.authorIdentity!.penName = penIn.value;
          return next;
        }),
    },
  });

  const sigIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', value: identity.signatureText },
    on: {
      change: () =>
        actions.mutateProject((p) => {
          const next = normalizeProjectDefaults(p);
          next.authorIdentity!.signatureText = sigIn.value;
          return next;
        }),
    },
  });

  const wrap = el(
    'div',
    { className: 'bv-scroll-view', style: { maxWidth: '920px', margin: '0 auto', width: '100%' } },
    el('h2', { text: 'Publish Readiness & Author Seal', style: { marginTop: '0' } }),
    el(
      'div',
      { className: 'bv-two-col' },
      el(
        'section',
        { className: 'bv-cork-card' },
        el('span', { className: 'bv-panel-title', text: 'Pen Name & Author Key' }),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Pen Name' }), penIn),
        el('div', { className: 'bv-field' }, el('label', { className: 'bv-label', text: 'Signature Line' }), sigIn),
        el('div', {
          className: 'bv-mono-tag',
          text: `Key ID: ${identity.authorKeyId || 'Not generated'}`,
        }),
        el(
          'div',
          { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          el(
            'button',
            {
              className: 'bv-btn',
              attrs: { type: 'button' },
              on: {
                click: async () => {
                  const pair = await generateAuthorKeyPair();
                  actions.mutateProject((prev) => {
                    const next = normalizeProjectDefaults(prev);
                    next.authorIdentity = { ...ensureAuthorIdentity(next), ...pair };
                    return next;
                  });
                  actions.notify(`Generated Author Key ${pair.authorKeyId}`);
                },
              },
            },
            icon('key', 14),
            'New Author Key',
          ),
          el(
            'button',
            {
              className: 'bv-btn bv-btn-primary',
              attrs: { type: 'button' },
              on: {
                click: async () => {
                  const signed = await signManuscript(actions.getState().project);
                  actions.mutateProject(() => signed);
                  actions.notify('Manuscript signed and sealed');
                },
              },
            },
            icon('check', 14),
            'Sign & Seal Manuscript',
          ),
          el(
            'button',
            {
              className: 'bv-btn',
              attrs: { type: 'button' },
              on: { click: () => actions.openLibraryModal() },
            },
            'Draw Signature…',
          ),
        ),
      ),
      el(
        'section',
        { className: 'bv-cork-card' },
        el('span', { className: 'bv-panel-title', text: 'Ready-to-Publish Checklist' }),
        ...checks.map((item) =>
          el(
            'div',
            { className: 'bv-list-card' },
            el(
              'div',
              {},
              el('div', { text: item.label, style: { fontWeight: '600', fontSize: '12.5px' } }),
              el('div', { className: 'bv-label', text: item.detail }),
            ),
            el('span', {
              className: 'bv-mono-tag',
              text: item.ok ? 'READY' : 'REVIEW',
              style: { color: item.ok ? 'var(--accent-emerald)' : 'var(--accent-amber)' },
            }),
          ),
        ),
      ),
    ),
    el(
      'section',
      { className: 'bv-cork-card', style: { marginTop: '14px' } },
      el('span', { className: 'bv-panel-title', text: 'Export Release Bundle' }),
      el(
        'div',
        { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        el(
          'button',
          {
            className: 'bv-btn bv-btn-primary',
            attrs: { type: 'button' },
            on: { click: () => void actions.exportEpub() },
          },
          icon('download', 14),
          'EPUB 3 (with Cover & Credits)',
        ),
        el(
          'button',
          {
            className: 'bv-btn',
            attrs: { type: 'button' },
            on: { click: () => actions.printTypeset() },
          },
          icon('printer', 14),
          'Print-Ready Typeset PDF',
        ),
        el(
          'button',
          {
            className: 'bv-btn',
            attrs: { type: 'button' },
            on: { click: () => void actions.exportCoverPng() },
          },
          icon('image', 14),
          'High-Res Cover PNG',
        ),
        el(
          'button',
          {
            className: 'bv-btn',
            attrs: { type: 'button' },
            on: { click: () => void actions.exportMarkdown() },
          },
          icon('file', 14),
          'Markdown Manuscript',
        ),
        el(
          'button',
          {
            className: 'bv-btn',
            attrs: { type: 'button' },
            on: { click: () => void actions.exportAsExtension('.bookvibe') },
          },
          icon('save', 14),
          'Signed .bookvibe Archive',
        ),
      ),
    ),
  );

  container.appendChild(wrap);
}
