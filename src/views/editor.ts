import type { AppActions, EditorSubMode } from '../core/app-context';
import { getActiveSessionPermissions } from '../core/collab';
import {
  countWords,
  findSceneContext,
  getAllScenes,
  splitSceneAtOffset,
} from '../core/manuscript';
import { loadInstalledExtensions, runExtensionRulesOnScene } from '../core/plugins';
import {
  PROOFREAD_MARK_SPECS,
  PROOFREAD_TOOLBAR_ORDER,
  acceptAllProofreadMarks,
  acceptProofreadMark,
  addProofreadMark,
  computeCleanProofPreview,
  rejectAllProofreadMarks,
  rejectProofreadMark,
  resolveMarkRange,
  stetProofreadMark,
  updateProofreadMarkNote,
} from '../core/proofread';
import { computeWordDiff, restoreSnapshotToScene } from '../core/snapshots';
import { isTierAtLeast } from '../core/settings';
import type { PaperTheme, ProofreadMark, ProofreadMarkKind } from '../core/types';
import { attachContextMenu, type ContextMenuGroup } from '../ui/context-menu';
import { clearNode, el, icon } from '../ui/dom';
import { LiquidGlassControl } from '../ui/liquid-glass';
import { TOOLTIP_CATALOG } from '../ui/tooltips-catalog';

let activeEditorGlass: LiquidGlassControl<EditorSubMode> | null = null;
let proofreadLedgerFilter: 'open' | 'resolved' | 'all' = 'open';
let pendingComposer: {
  kind: ProofreadMarkKind;
  start: number;
  end: number;
  originalText: string;
} | null = null;

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  actions: AppActions,
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const current = textarea.value;
  const selected = current.slice(start, end) || 'text';
  const nextValue = current.slice(0, start) + before + selected + after + current.slice(end);
  textarea.value = nextValue;
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  actions.updateActiveSceneTextQuietly('content', nextValue);
}

function insertAtLineStart(textarea: HTMLTextAreaElement, prefix: string, actions: AppActions): void {
  const start = textarea.selectionStart;
  const current = textarea.value;
  const lineStart = current.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextValue = current.slice(0, lineStart) + prefix + current.slice(lineStart);
  textarea.value = nextValue;
  textarea.focus();
  textarea.setSelectionRange(start + prefix.length, start + prefix.length);
  actions.updateActiveSceneTextQuietly('content', nextValue);
}

function resolveSelectionFromProofSheet(sheet: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!sheet.contains(range.commonAncestorContainer)) return null;

  const segments = Array.from(sheet.querySelectorAll<HTMLElement>('.bv-pr-text-seg'));
  if (segments.length === 0) return { start: 0, end: 0 };

  const findRawPoint = (container: Node, offset: number, isEnd: boolean): number | null => {
    const hostEl =
      container.nodeType === Node.ELEMENT_NODE
        ? (container as HTMLElement)
        : container.parentElement;
    const seg = hostEl?.closest<HTMLElement>('.bv-pr-text-seg');
    if (seg && seg.dataset.rawStart !== undefined) {
      const segStart = Number(seg.dataset.rawStart);
      if (container.nodeType === Node.TEXT_NODE) {
        return segStart + offset;
      }
      return isEnd ? Number(seg.dataset.rawEnd ?? segStart) : segStart;
    }

    for (const s of segments) {
      if (s.contains(container)) {
        const rawS = Number(s.dataset.rawStart ?? 0);
        return container.nodeType === Node.TEXT_NODE ? rawS + offset : rawS;
      }
    }
    return null;
  };

  let s = findRawPoint(range.startContainer, range.startOffset, false);
  let e = findRawPoint(range.endContainer, range.endOffset, true);

  if (s === null && e === null) return null;
  if (s === null) s = e!;
  if (e === null) e = s;
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

function activeReviewerInfo(actions: AppActions) {
  const project = actions.getState().project;
  const activeCollab = (project.collaborators ?? []).find(
    (c) => c.name === project.activeAuthorLabel || c.penName === project.activeAuthorLabel,
  );
  return {
    authorName:
      project.activeAuthorLabel ||
      project.authorIdentity?.penName ||
      project.author ||
      'Proofreader',
    role: activeCollab?.role ?? 'proofreader',
  };
}

export function renderEditorView(container: HTMLElement, actions: AppActions): void {
  if (activeEditorGlass) {
    activeEditorGlass.destroy();
    activeEditorGlass = null;
  }
  clearNode(container);

  const state = actions.getState();
  const ctx = findSceneContext(state.project, state.activeSceneId);

  if (!ctx) {
    container.appendChild(
      el(
        'div',
        { className: 'bv-scroll-view' },
        el('p', { text: 'Select or add a scene from the Manuscript binder to begin writing.' }),
      ),
    );
    return;
  }

  const { part, chapter, scene } = ctx;
  const tier = state.settings.toolTier;
  const allowIntermediate = isTierAtLeast(tier, 'intermediate');
  const allowAdvanced = isTierAtLeast(tier, 'advanced');
  const isProofMode = allowIntermediate && state.editorSubMode === 'proofread';

  const sessionPerms = getActiveSessionPermissions(state.project);

  const proseTextarea = el('textarea', {
    className: `bv-prose-textarea${state.typewriterMode ? ' is-typewriter' : ''}`,
    attrs: {
      placeholder: 'Begin writing this scene…',
      spellcheck: state.settings.enableSpellcheck ? 'true' : 'false',
      autocorrect: state.settings.enableSpellcheck ? 'on' : 'off',
      'aria-label': 'Scene prose editor',
      ...(sessionPerms.canEditProse ? {} : { readonly: '' }),
    },
  });
  proseTextarea.readOnly = !sessionPerms.canEditProse;
  proseTextarea.value = scene.content;

  const syncTextareaHeight = () => {
    proseTextarea.style.height = 'auto';
    proseTextarea.style.height = `${Math.max(460, proseTextarea.scrollHeight + 12)}px`;
  };

  proseTextarea.addEventListener('input', () => {
    syncTextareaHeight();
    actions.updateActiveSceneTextQuietly('content', proseTextarea.value);
  });

  proseTextarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrapSelection(proseTextarea, '**', '**', actions);
      syncTextareaHeight();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrapSelection(proseTextarea, '*', '*', actions);
      syncTextareaHeight();
    }
  });

  attachContextMenu(proseTextarea, () => {
    const start = proseTextarea.selectionStart;
    const end = proseTextarea.selectionEnd;
    const hasSelection = end > start;
    const groups: ContextMenuGroup[] = [
      {
        heading: 'Writing & Selection',
        items: [
          {
            label: 'Cut Selection',
            disabled: !hasSelection,
            shortcut: 'Ctrl+X',
            onSelect: () => {
              const selText = proseTextarea.value.slice(start, end);
              void navigator.clipboard?.writeText(selText);
              const nextVal = proseTextarea.value.slice(0, start) + proseTextarea.value.slice(end);
              proseTextarea.value = nextVal;
              proseTextarea.setSelectionRange(start, start);
              syncTextareaHeight();
              actions.updateActiveSceneTextQuietly('content', nextVal);
            },
          },
          {
            label: 'Copy Selection',
            disabled: !hasSelection,
            shortcut: 'Ctrl+C',
            onSelect: () => {
              const selText = proseTextarea.value.slice(start, end);
              void navigator.clipboard?.writeText(selText);
              actions.notify('Copied selection');
            },
          },
          {
            label: 'Paste Plain Text',
            shortcut: 'Ctrl+V',
            onSelect: () => {
              void navigator.clipboard?.readText().then((clip) => {
                if (!clip) return;
                const nextVal = proseTextarea.value.slice(0, start) + clip + proseTextarea.value.slice(end);
                proseTextarea.value = nextVal;
                proseTextarea.setSelectionRange(start + clip.length, start + clip.length);
                syncTextareaHeight();
                actions.updateActiveSceneTextQuietly('content', nextVal);
              });
            },
          },
        ],
      },
      {
        heading: 'Formatting',
        items: [
          {
            label: 'Bold (**text**)',
            shortcut: 'Ctrl+B',
            onSelect: () => {
              wrapSelection(proseTextarea, '**', '**', actions);
              syncTextareaHeight();
            },
          },
          {
            label: 'Italic (*text*)',
            shortcut: 'Ctrl+I',
            onSelect: () => {
              wrapSelection(proseTextarea, '*', '*', actions);
              syncTextareaHeight();
            },
          },
          {
            label: 'Heading (##)',
            onSelect: () => {
              insertAtLineStart(proseTextarea, '## ', actions);
              syncTextareaHeight();
            },
          },
          {
            label: 'Epigraph / Blockquote (>)',
            onSelect: () => {
              insertAtLineStart(proseTextarea, '> ', actions);
              syncTextareaHeight();
            },
          },
          {
            label: 'Insert Scene Break (* * *)',
            onSelect: () => {
              const insertion = '\n\n* * *\n\n';
              const nextVal = proseTextarea.value.slice(0, start) + insertion + proseTextarea.value.slice(end);
              proseTextarea.value = nextVal;
              proseTextarea.setSelectionRange(start + insertion.length, start + insertion.length);
              syncTextareaHeight();
              actions.updateActiveSceneTextQuietly('content', nextVal);
            },
          },
        ],
      },
      {
        heading: 'Scene Actions',
        items: [
          {
            label: 'Split Scene at Cursor',
            icon: 'split-scene',
            onSelect: () => {
              const res = splitSceneAtOffset(actions.getState().project, scene.id, proseTextarea.selectionStart);
              if (!res.newSceneId) {
                actions.notify('Place cursor inside prose before splitting.');
                return;
              }
              actions.mutateProject(() => res.project, false);
              actions.selectScene(res.newSceneId, true);
              actions.notify('Scene split at cursor');
            },
          },
          {
            label: 'Capture Revision Snapshot',
            icon: 'camera',
            shortcut: 'Ctrl+S',
            onSelect: () => actions.createSnapshot(),
          },
          {
            label: 'Switch to Proofread Markup',
            icon: 'proofread',
            onSelect: () => {
              if (!isTierAtLeast(actions.getState().settings.toolTier, 'intermediate')) {
                actions.updateSettings({ toolTier: 'intermediate' });
              }
              actions.setState({ editorSubMode: 'proofread' }, true);
            },
          },
        ],
      },
    ];
    return groups;
  });

  const sceneHeading = el('input', {
    className: 'bv-scene-heading',
    attrs: {
      type: 'text',
      value: scene.title,
      placeholder: 'Scene Title',
      'aria-label': 'Scene title',
    },
    on: {
      input: () => actions.updateActiveSceneTextQuietly('title', sceneHeading.value),
    },
  });

  const paperSelect = el(
    'select',
    {
      className: 'bv-select',
      tooltip: {
        title: 'Paper Sheet Theme',
        short: 'Switch between Obsidian, Parchment, and Ivory paper.',
      },
      attrs: { 'aria-label': 'Paper canvas theme' },
      on: {
        change: () => {
          const val = paperSelect.value as PaperTheme;
          actions.mutateProject((prev) => ({ ...prev, paperTheme: val }));
        },
      },
    },
    el('option', { text: 'Obsidian', attrs: { value: 'obsidian', selected: state.project.paperTheme === 'obsidian' } }),
    el('option', { text: 'Parchment', attrs: { value: 'parchment', selected: state.project.paperTheme === 'parchment' } }),
    el('option', { text: 'Ivory', attrs: { value: 'ivory', selected: state.project.paperTheme === 'ivory' } }),
  );

  const subModeOptions: Array<{
    id: EditorSubMode;
    label: string;
    icon: 'draft-sheet' | 'proofread' | 'split' | 'diff';
    tooltip: typeof TOOLTIP_CATALOG.modeDraft;
  }> = [
    { id: 'draft', label: 'Draft', icon: 'draft-sheet', tooltip: TOOLTIP_CATALOG.modeDraft },
  ];
  if (allowIntermediate) {
    subModeOptions.push({
      id: 'proofread',
      label: 'Proofread',
      icon: 'proofread',
      tooltip: TOOLTIP_CATALOG.modeProofread,
    });
  }
  if (allowAdvanced) {
    subModeOptions.push(
      { id: 'split', label: 'Split View', icon: 'split', tooltip: TOOLTIP_CATALOG.modeSplit },
      { id: 'diff', label: 'Revision Diff', icon: 'diff', tooltip: TOOLTIP_CATALOG.modeDiff },
    );
  }
  const effectiveSubMode: EditorSubMode = subModeOptions.some((o) => o.id === state.editorSubMode)
    ? state.editorSubMode
    : 'draft';

  const subModeControl = new LiquidGlassControl<EditorSubMode>({
    ariaLabel: 'Editor pane mode',
    surface: 'clear',
    compact: true,
    iconOnly: true,
    value: effectiveSubMode,
    options: subModeOptions,
    onChange: (mode) => {
      pendingComposer = null;
      actions.setState({ editorSubMode: mode }, true);
    },
  });
  activeEditorGlass = subModeControl;

  const ensureDraftEditable = (): boolean => {
    if (isProofMode || state.editorSubMode === 'diff') {
      actions.setState({ editorSubMode: 'draft' }, true);
      actions.notify('Switched to Draft mode for text editing.');
      return false;
    }
    return true;
  };

  // Fixed formatting & tool controls (icon-only where iconic, short symbol glyphs for B/I/H2/* * *)
  const subbar = el(
    'div',
    { className: 'bv-subbar' },
    el(
      'div',
      { className: 'bv-subbar-group' },
      el(
        'button',
        {
          className: 'bv-fmt-btn bv-btn-compact-icon',
          tooltip: { title: 'Undo (Ctrl+Z)', short: 'Undo the previous edit across this book.' },
          attrs: { type: 'button', 'aria-label': 'Undo edit', disabled: !actions.canUndo() },
          on: { click: () => actions.undo() },
        },
        icon('undo', 14),
      ),
      el(
        'button',
        {
          className: 'bv-fmt-btn bv-btn-compact-icon',
          tooltip: { title: 'Redo (Ctrl+Y)', short: 'Re-apply the reverted edit.' },
          attrs: { type: 'button', 'aria-label': 'Redo edit', disabled: !actions.canRedo() },
          on: { click: () => actions.redo() },
        },
        icon('redo', 14),
      ),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'B',
        tooltip: TOOLTIP_CATALOG.bold,
        attrs: { type: 'button', 'aria-label': 'Bold Markdown' },
        style: { fontWeight: '700' },
        on: {
          click: () => {
            if (!ensureDraftEditable()) return;
            wrapSelection(proseTextarea, '**', '**', actions);
            syncTextareaHeight();
          },
        },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'I',
        tooltip: TOOLTIP_CATALOG.italic,
        attrs: { type: 'button', 'aria-label': 'Italic Markdown' },
        style: { fontStyle: 'italic' },
        on: {
          click: () => {
            if (!ensureDraftEditable()) return;
            wrapSelection(proseTextarea, '*', '*', actions);
            syncTextareaHeight();
          },
        },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'H2',
        tooltip: TOOLTIP_CATALOG.heading,
        attrs: { type: 'button', 'aria-label': 'Section Heading' },
        on: {
          click: () => {
            if (!ensureDraftEditable()) return;
            insertAtLineStart(proseTextarea, '## ', actions);
            syncTextareaHeight();
          },
        },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: '❝',
        tooltip: TOOLTIP_CATALOG.quote,
        attrs: { type: 'button', 'aria-label': 'Epigraph Blockquote' },
        on: {
          click: () => {
            if (!ensureDraftEditable()) return;
            insertAtLineStart(proseTextarea, '> ', actions);
            syncTextareaHeight();
          },
        },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: '* * *',
        tooltip: TOOLTIP_CATALOG.sceneBreak,
        attrs: { type: 'button', 'aria-label': 'Insert Scene Break' },
        on: {
          click: () => {
            if (!ensureDraftEditable()) return;
            const pos = proseTextarea.selectionStart;
            const cur = proseTextarea.value;
            const insertion = '\n\n* * *\n\n';
            const nextVal = cur.slice(0, pos) + insertion + cur.slice(pos);
            proseTextarea.value = nextVal;
            proseTextarea.focus();
            proseTextarea.setSelectionRange(pos + insertion.length, pos + insertion.length);
            syncTextareaHeight();
            actions.updateActiveSceneTextQuietly('content', nextVal);
          },
        },
      }),
      allowIntermediate
        ? el(
            'button',
            {
              className: 'bv-fmt-btn bv-btn-compact-icon',
              tooltip: TOOLTIP_CATALOG.splitScene,
              attrs: { type: 'button', 'aria-label': 'Split Scene at Cursor' },
              on: {
                click: () => {
                  if (!ensureDraftEditable()) return;
                  const res = splitSceneAtOffset(
                    actions.getState().project,
                    scene.id,
                    proseTextarea.selectionStart,
                  );
                  if (!res.newSceneId) {
                    actions.notify('Place cursor inside Draft prose before splitting.');
                    return;
                  }
                  actions.mutateProject(() => res.project, false);
                  actions.selectScene(res.newSceneId, true);
                  actions.notify('Scene split at cursor');
                },
              },
            },
            icon('split-scene', 14),
          )
        : null,
    ),
    el(
      'div',
      { className: 'bv-subbar-group' },
      paperSelect,
      allowIntermediate
        ? el(
            'button',
            {
              className: `bv-fmt-btn bv-btn-compact-icon${state.typewriterMode ? ' is-active' : ''}`,
              tooltip: TOOLTIP_CATALOG.typewriter,
              attrs: { type: 'button', 'aria-label': 'Toggle Typewriter Scrolling' },
              on: {
                click: () =>
                  actions.setState({ typewriterMode: !actions.getState().typewriterMode }, true),
              },
            },
            icon('typewriter', 14),
          )
        : null,
      el(
        'button',
        {
          className: `bv-fmt-btn bv-btn-compact-icon${state.zenMode ? ' is-active' : ''}`,
          tooltip: TOOLTIP_CATALOG.zen,
          attrs: { type: 'button', 'aria-label': 'Toggle Zen Focus Mode' },
          on: {
            click: () => actions.setState({ zenMode: !actions.getState().zenMode }, true),
          },
        },
        icon('zen', 14),
      ),
      allowIntermediate
        ? el(
            'button',
            {
              className: 'bv-fmt-btn bv-btn-compact-icon',
              tooltip: TOOLTIP_CATALOG.snapshot,
              attrs: { type: 'button', 'aria-label': 'Capture Revision Snapshot' },
              on: { click: () => actions.createSnapshot() },
            },
            icon('camera', 14),
          )
        : null,
    ),
  );

  const paperFloatNav = el(
    'div',
    { className: 'bv-paper-float-nav' },
    el('span', {
      className: 'bv-scene-kicker',
      text: `${part.title}  ·  ${chapter.title}`,
      style: {
        minWidth: '0',
        flex: '1 1 160px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }),
    el('div', { style: { flexShrink: '0' } }, subModeControl.element),
  );

  const panes = el('div', {
    className: `bv-editor-panes${effectiveSubMode !== 'draft' ? ' has-split' : ''}`,
  });

  if (isProofMode) {
    const { sheetWrap, paperScrollEl } = renderProofreadWorkspace(
      actions,
      scene,
      paperFloatNav,
      sceneHeading,
    );
    panes.appendChild(sheetWrap);
    panes.appendChild(renderProofreadLedgerPane(actions, scene, paperScrollEl));
    container.append(subbar, panes);
    requestAnimationFrame(() => activeEditorGlass?.sampleBackdrop(true));
    return;
  }

  const readOnlyBanner = !sessionPerms.canEditProse
    ? el(
        'div',
        { className: 'qv-readonly-banner', attrs: { role: 'status' } },
        el('span', {
          text: 'Prose editing is locked for your current collaborator role. You can read or add proofread marks and notes.',
        }),
        el('button', {
          className: 'bv-mini-btn',
          text: 'Switch to Proofread Mode',
          attrs: { type: 'button' },
          on: { click: () => actions.setState({ editorSubMode: 'proofread' }, true) },
        }),
      )
    : null;

  const paperSheet = el(
    'div',
    { className: 'bv-paper-sheet' },
    paperFloatNav,
    sceneHeading,
    ...(readOnlyBanner ? [readOnlyBanner] : []),
    proseTextarea,
  );

  const paperScroll = el(
    'div',
    {
      className: 'bv-paper-scroll',
      dataset: { paper: state.project.paperTheme },
      on: {
        scroll: () => activeEditorGlass?.sampleBackdrop(false),
      },
    },
    paperSheet,
  );

  panes.appendChild(paperScroll);

  if (effectiveSubMode === 'split') {
    panes.appendChild(renderSplitReferencePane(actions));
  } else if (effectiveSubMode === 'diff') {
    panes.appendChild(renderRevisionDiffPane(actions, scene));
  }

  container.append(subbar, panes);
  requestAnimationFrame(() => {
    syncTextareaHeight();
    activeEditorGlass?.sampleBackdrop(true);
  });
}

function renderProofreadWorkspace(
  actions: AppActions,
  scene: NonNullable<ReturnType<typeof findSceneContext>>['scene'],
  paperFloatNav: HTMLElement,
  sceneHeading: HTMLInputElement,
): { sheetWrap: HTMLElement; paperScrollEl: HTMLElement } {
  const state = actions.getState();
  const marks = (scene.proofreadMarks ?? []).filter(
    (m) => m.status === 'open' || m.status === 'stet',
  );

  let lastKnownRange: { start: number; end: number } | null = null;
  const proseSurface = el('div', {
    className: 'bv-proof-prose',
    attrs: {
      tabindex: '0',
      'aria-label': 'Interactive Proofreading Surface — select any word or sentence to apply marks',
    },
    on: {
      mouseup: () => {
        const resolved = resolveSelectionFromProofSheet(proseSurface);
        if (resolved) lastKnownRange = resolved;
      },
      keyup: () => {
        const resolved = resolveSelectionFromProofSheet(proseSurface);
        if (resolved) lastKnownRange = resolved;
      },
    },
  });

  const triggerMarkAction = (kind: ProofreadMarkKind) => {
    const spec = PROOFREAD_MARK_SPECS[kind];
    const liveSel = state.proofreadPreviewClean
      ? null
      : resolveSelectionFromProofSheet(proseSurface) ?? lastKnownRange;

    if (!liveSel) {
      if (state.proofreadPreviewClean) {
        actions.notify('Turn off Clean Preview before adding proofreading marks.');
        return;
      }
      if (spec.requiresSelection) {
        actions.notify(`Highlight word(s) or a sentence on the page first for ${spec.label}.`);
        return;
      }
      pendingComposer = { kind, start: scene.content.length, end: scene.content.length, originalText: '' };
      renderEditorView(document.querySelector('.bv-main-stage') as HTMLElement, actions);
      return;
    }

    if (spec.requiresSelection && liveSel.start === liveSel.end) {
      actions.notify(`Highlight one or more words for ${spec.label}.`);
      return;
    }

    const originalText = scene.content.slice(liveSel.start, liveSel.end);
    if (spec.promptsReplacement || spec.promptsNote) {
      pendingComposer = {
        kind,
        start: liveSel.start,
        end: liveSel.end,
        originalText,
      };
      actions.setState({}, true);
      return;
    }

    const reviewer = activeReviewerInfo(actions);
    const res = addProofreadMark(actions.getState().project, scene.id, {
      kind,
      start: liveSel.start,
      end: liveSel.end,
      authorName: reviewer.authorName,
      role: reviewer.role,
    });
    actions.mutateProject(() => res.project, false);
    actions.setState({ activeProofreadMarkId: res.mark?.id ?? '' }, true);
    actions.notify(`Added ${spec.label} mark`);
  };

  // Proofreading Mark Palette Strip
  const markPalette = el('div', { className: 'bv-pr-toolbar' });
  const markBtns = el('div', { className: 'bv-pr-btn-row' });
  for (const kind of PROOFREAD_TOOLBAR_ORDER) {
    const spec = PROOFREAD_MARK_SPECS[kind];
    markBtns.appendChild(
      el('button', {
        className: `bv-pr-tool-btn${pendingComposer?.kind === kind ? ' is-active' : ''}`,
        text: spec.symbol,
        tooltip: {
          title: `${spec.label} (${spec.symbol})`,
          short: spec.shortDesc,
          details: spec.fullDesc,
        },
        attrs: { type: 'button', 'aria-label': spec.label },
        on: { click: () => triggerMarkAction(kind) },
      }),
    );
  }

  const bulkGroup = el(
    'div',
    { className: 'bv-pr-bulk-row' },
    el('button', {
      className: `bv-mini-btn${state.proofreadPreviewClean ? ' is-active' : ''}`,
      text: state.proofreadPreviewClean ? 'Clean Preview ✓' : 'Clean Preview',
      tooltip: {
        title: 'Clean Proof Preview',
        short: 'Temporarily preview prose with all open proof marks accepted.',
      },
      attrs: { type: 'button' },
      on: {
        click: () =>
          actions.setState({ proofreadPreviewClean: !state.proofreadPreviewClean }, true),
      },
    }),
    el('button', {
      className: 'bv-mini-btn',
      text: 'Auto-Proof',
      tooltip: {
        title: 'Run Editorial Proofing Toolkit',
        short: 'Scan active scene offline for repeated words, spacing issues, and weak verbs.',
        details: 'Runs the integrated core.editorial-proofing extension and creates reviewable marks without changing your prose directly.',
      },
      attrs: { type: 'button' },
      on: {
        click: () => {
          const ext = loadInstalledExtensions().find((e) => e.manifest.id === 'core.editorial-proofing');
          if (!ext || !ext.enabled) {
            actions.notify('Enable "Editorial Proofing Toolkit" in Extensions first.');
            return;
          }
          try {
            const res = runExtensionRulesOnScene(ext, actions.getState().project, scene.id);
            actions.mutateProject(() => res.project);
            actions.notify(
              res.addedMarks > 0
                ? `Added ${res.addedMarks} proofreading suggestion(s)`
                : 'No proofing issues found in this scene.',
            );
          } catch (err) {
            actions.notify(err instanceof Error ? err.message : 'Unable to run proofing extension.');
          }
        },
      },
    }),
    el('button', {
      className: 'bv-mini-btn',
      text: 'Accept All',
      tooltip: {
        title: 'Accept All Open Marks',
        short: 'Apply every pending edit with a safety snapshot.',
      },
      attrs: { type: 'button' },
      on: {
        click: () => {
          actions.mutateProject((prev) => acceptAllProofreadMarks(prev, scene.id));
          actions.notify('Accepted open proofreading marks (snapshot saved)');
        },
      },
    }),
    el('button', {
      className: 'bv-mini-btn',
      text: 'Reject All',
      tooltip: {
        title: 'Reject All Open Marks',
        short: 'Dismiss every open mark without altering text.',
      },
      attrs: { type: 'button' },
      on: {
        click: () => {
          actions.mutateProject((prev) => rejectAllProofreadMarks(prev, scene.id));
          actions.notify('Rejected open proofreading marks');
        },
      },
    }),
  );

  markPalette.append(markBtns, bulkGroup);

  // Build non-overlapping annotated prose DOM on proseSurface
  if (state.proofreadPreviewClean) {
    proseSurface.textContent = computeCleanProofPreview(scene.content, scene.proofreadMarks ?? []);
  } else {
    renderMarkedSegments(proseSurface, scene.content, marks, state.activeProofreadMarkId, (markId) => {
      actions.setState({ activeProofreadMarkId: markId }, true);
    });
  }

  attachContextMenu(proseSurface, (e) => {
    const resolved = resolveSelectionFromProofSheet(proseSurface);
    if (resolved) lastKnownRange = resolved;

    const hitMarkEl = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-mark-id]');
    const hitMarkId = hitMarkEl?.dataset.markId;
    const hitMark = hitMarkId ? (scene.proofreadMarks ?? []).find((m) => m.id === hitMarkId) : undefined;

    const groups: ContextMenuGroup[] = [];
    if (hitMark) {
      const hitSpec = PROOFREAD_MARK_SPECS[hitMark.kind];
      groups.push({
        heading: `Mark · ${hitSpec.label}`,
        items: [
          {
            label: 'Accept Mark',
            icon: 'check',
            onSelect: () => {
              const res = acceptProofreadMark(actions.getState().project, scene.id, hitMark.id);
              actions.mutateProject(() => res.project);
              actions.notify(res.applied ? `Accepted ${hitSpec.label}` : 'Target shifted');
            },
          },
          {
            label: 'Mark Stet (Let Stand)',
            onSelect: () => {
              actions.mutateProject((prev) => stetProofreadMark(prev, scene.id, hitMark.id));
              actions.notify('Marked stet');
            },
          },
          {
            label: 'Reject Mark',
            icon: 'trash',
            danger: true,
            onSelect: () => actions.mutateProject((prev) => rejectProofreadMark(prev, scene.id, hitMark.id)),
          },
        ],
      });
    }

    groups.push({
      heading: 'Proofread Markup',
      items: (['delete', 'insert', 'substitute', 'comment', 'highlight', 'transpose', 'stet'] as ProofreadMarkKind[]).map(
        (kind) => ({
          label: `${PROOFREAD_MARK_SPECS[kind].symbol}  ${PROOFREAD_MARK_SPECS[kind].label}`,
          onSelect: () => triggerMarkAction(kind),
        }),
      ),
    });

    groups.push({
      heading: 'Typography & Spacing Marks',
      items: (['capitalize', 'lowercase', 'italic', 'bold', 'paragraph', 'run-in', 'closeup', 'space'] as ProofreadMarkKind[]).map(
        (kind) => ({
          label: `${PROOFREAD_MARK_SPECS[kind].symbol}  ${PROOFREAD_MARK_SPECS[kind].label}`,
          onSelect: () => triggerMarkAction(kind),
        }),
      ),
    });

    groups.push({
      heading: 'Review Controls',
      items: [
        {
          label: state.proofreadPreviewClean ? 'Exit Clean Preview' : 'Toggle Clean Preview',
          icon: state.proofreadPreviewClean ? 'eye-off' : 'eye',
          checked: state.proofreadPreviewClean,
          onSelect: () => actions.setState({ proofreadPreviewClean: !state.proofreadPreviewClean }, true),
        },
        {
          label: 'Accept All Open Marks',
          icon: 'check',
          onSelect: () => {
            actions.mutateProject((prev) => acceptAllProofreadMarks(prev, scene.id));
            actions.notify('Accepted open marks (snapshot saved)');
          },
        },
        {
          label: 'Return to Draft Mode',
          icon: 'draft-sheet',
          onSelect: () => actions.setState({ editorSubMode: 'draft' }, true),
        },
      ],
    });

    return groups;
  });

  // Optional inline mark composer when a replacement/comment tool was clicked
  let composerStrip: HTMLElement | null = null;
  if (pendingComposer) {
    const comp = pendingComposer;
    const spec = PROOFREAD_MARK_SPECS[comp.kind];
    const replaceInput = el('input', {
      className: 'bv-input',
      attrs: {
        type: 'text',
        placeholder: spec.kind === 'insert' ? 'Words to insert at caret…' : 'Proposed replacement wording…',
        value: '',
      },
    });
    const noteInput = el('input', {
      className: 'bv-input',
      attrs: {
        type: 'text',
        placeholder: 'Proofreader note or query (optional)…',
      },
    });

    composerStrip = el(
      'div',
      { className: 'bv-pr-composer' },
      el(
        'div',
        { className: 'bv-pr-composer-head' },
        el('strong', { text: `${spec.symbol} ${spec.label}` }),
        comp.originalText
          ? el('span', { className: 'bv-mono-tag', text: `Target: “${comp.originalText.slice(0, 64)}”` })
          : el('span', { className: 'bv-mono-tag', text: `At char ${comp.start}` }),
      ),
      el(
        'div',
        { className: 'bv-pr-composer-fields' },
        spec.promptsReplacement ? replaceInput : null,
        noteInput,
        el('button', {
          className: 'bv-btn bv-btn-primary',
          text: 'Apply Mark',
          attrs: { type: 'button' },
          on: {
            click: () => {
              if (spec.promptsReplacement && !replaceInput.value) {
                actions.notify('Enter replacement or inserted text first.');
                return;
              }
              const reviewer = activeReviewerInfo(actions);
              const res = addProofreadMark(actions.getState().project, scene.id, {
                kind: comp.kind,
                start: comp.start,
                end: comp.end,
                replacement: spec.promptsReplacement ? replaceInput.value : undefined,
                note: noteInput.value,
                authorName: reviewer.authorName,
                role: reviewer.role,
              });
              pendingComposer = null;
              actions.mutateProject(() => res.project, false);
              actions.setState({ activeProofreadMarkId: res.mark?.id ?? '' }, true);
              actions.notify(`Added ${spec.label}`);
            },
          },
        }),
        el('button', {
          className: 'bv-btn',
          text: 'Cancel',
          attrs: { type: 'button' },
          on: {
            click: () => {
              pendingComposer = null;
              actions.setState({}, true);
            },
          },
        }),
      ),
    );
  }

  const paperSheet = el(
    'div',
    { className: 'bv-paper-sheet' },
    paperFloatNav,
    sceneHeading,
    composerStrip,
    proseSurface,
  );

  const paperScrollEl = el(
    'div',
    {
      className: 'bv-paper-scroll',
      dataset: { paper: state.project.paperTheme },
      on: { scroll: () => activeEditorGlass?.sampleBackdrop(false) },
    },
    paperSheet,
  );

  const sheetWrap = el(
    'div',
    { style: { flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0', minWidth: '0', maxWidth: '100%', overflow: 'hidden' } },
    markPalette,
    paperScrollEl,
  );

  return { sheetWrap, paperScrollEl };
}

function renderMarkedSegments(
  surface: HTMLElement,
  content: string,
  marks: ProofreadMark[],
  activeMarkId: string,
  onSelectMark: (markId: string) => void,
): void {
  const resolved: Array<{ mark: ProofreadMark; start: number; end: number }> = [];
  for (const m of marks) {
    const r = resolveMarkRange(content, m);
    if (r) resolved.push({ mark: m, start: r.start, end: r.end });
  }

  const points = new Set<number>([0, content.length]);
  for (const r of resolved) {
    points.add(r.start);
    points.add(r.end);
  }
  const sortedPoints = Array.from(points).sort((a, b) => a - b);

  const insertChipsAt = (pos: number) => {
    const pointMarks = resolved.filter((r) => r.start === pos && r.end === pos);
    for (const pm of pointMarks) {
      const m = pm.mark;
      const spec = PROOFREAD_MARK_SPECS[m.kind];
      const chipText =
        m.kind === 'insert' && m.replacement
          ? `∧ ${m.replacement}`
          : spec.symbol;
      const chip = el('span', {
        className: `bv-pr-chip ${spec.toneClass}${m.id === activeMarkId ? ' is-selected' : ''}`,
        text: chipText,
        attrs: { contenteditable: 'false', 'data-mark-id': m.id },
        tooltip: {
          title: `${spec.label} · ${m.authorName}`,
          short: m.note || (m.replacement ? `Insert “${m.replacement}”` : spec.shortDesc),
        },
        on: {
          click: (e) => {
            e.stopPropagation();
            onSelectMark(m.id);
          },
        },
      });
      surface.appendChild(chip);
    }
  };

  for (let i = 0; i < sortedPoints.length; i++) {
    const pos = sortedPoints[i];
    insertChipsAt(pos);
    if (i === sortedPoints.length - 1) break;
    const nextPos = sortedPoints[i + 1];
    if (nextPos <= pos) continue;

    const covering = resolved.filter((r) => r.start <= pos && r.end >= nextPos && r.start < r.end);
    const primary = covering[0]?.mark;

    if (!primary) {
      surface.appendChild(
        el('span', {
          className: 'bv-pr-text-seg',
          text: content.slice(pos, nextPos),
          dataset: { rawStart: String(pos), rawEnd: String(nextPos) },
        }),
      );
    } else {
      const spec = PROOFREAD_MARK_SPECS[primary.kind];
      const seg = el('span', {
        className: `bv-pr-text-seg ${spec.toneClass}${primary.status === 'stet' ? ' bv-pr-stet' : ''}${primary.id === activeMarkId ? ' is-selected' : ''}`,
        text: content.slice(pos, nextPos),
        dataset: {
          rawStart: String(pos),
          rawEnd: String(nextPos),
          markId: primary.id,
        },
        on: {
          click: () => onSelectMark(primary.id),
        },
      });
      surface.appendChild(seg);

      // Show replacement or mark badge right after the last segment of this mark
      if (nextPos === covering[0].end && (primary.replacement || primary.kind === 'comment' || primary.kind === 'transpose')) {
        const badgeLabel =
          primary.kind === 'substitute'
            ? `⇄ ${primary.replacement}`
            : primary.kind === 'comment'
              ? 'AQ'
              : spec.symbol;
        surface.appendChild(
          el('span', {
            className: `bv-pr-chip ${spec.toneClass}${primary.id === activeMarkId ? ' is-selected' : ''}`,
            text: badgeLabel,
            attrs: { contenteditable: 'false', 'data-mark-id': primary.id },
            on: {
              click: (e) => {
                e.stopPropagation();
                onSelectMark(primary.id);
              },
            },
          }),
        );
      }
    }
  }
}

function renderProofreadLedgerPane(
  actions: AppActions,
  scene: NonNullable<ReturnType<typeof findSceneContext>>['scene'],
  paperScrollEl: HTMLElement,
): HTMLElement {
  const state = actions.getState();
  const allMarks = scene.proofreadMarks ?? [];
  const filtered = allMarks.filter((m) => {
    if (proofreadLedgerFilter === 'open') return m.status === 'open' || m.status === 'stet';
    if (proofreadLedgerFilter === 'resolved') return m.status === 'accepted' || m.status === 'rejected';
    return true;
  });

  const filterSelect = el(
    'select',
    {
      className: 'bv-select',
      attrs: { 'aria-label': 'Filter proofread marks' },
      on: {
        change: () => {
          proofreadLedgerFilter = filterSelect.value as 'open' | 'resolved' | 'all';
          actions.setState({}, true);
        },
      },
    },
    el('option', {
      text: `Open / Stet (${allMarks.filter((m) => m.status === 'open' || m.status === 'stet').length})`,
      attrs: { value: 'open', selected: proofreadLedgerFilter === 'open' },
    }),
    el('option', {
      text: `Resolved (${allMarks.filter((m) => m.status === 'accepted' || m.status === 'rejected').length})`,
      attrs: { value: 'resolved', selected: proofreadLedgerFilter === 'resolved' },
    }),
    el('option', {
      text: `All Marks (${allMarks.length})`,
      attrs: { value: 'all', selected: proofreadLedgerFilter === 'all' },
    }),
  );

  // Quick Mark by Phrase box for keyboard-only workflow
  const phraseIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', placeholder: 'Find phrase in scene…', 'aria-label': 'Find phrase to mark' },
  });
  const quickKindSel = el(
    'select',
    { className: 'bv-select', attrs: { 'aria-label': 'Mark type' } },
    ...PROOFREAD_TOOLBAR_ORDER.map((k) =>
      el('option', {
        text: `${PROOFREAD_MARK_SPECS[k].symbol} ${PROOFREAD_MARK_SPECS[k].label}`,
        attrs: { value: k },
      }),
    ),
  );
  const quickReplIn = el('input', {
    className: 'bv-input',
    attrs: { type: 'text', placeholder: 'Replacement / note (optional)' },
  });

  const quickCard = el(
    'div',
    { className: 'bv-cork-card', style: { marginBottom: '12px', padding: '10px', gap: '8px' } },
    el('span', { className: 'bv-panel-title', text: 'Quick Mark by Phrase' }),
    phraseIn,
    el(
      'div',
      { style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px' } },
      quickKindSel,
      el('button', {
        className: 'bv-btn bv-btn-primary',
        text: 'Mark',
        attrs: { type: 'button' },
        on: {
          click: () => {
            const needle = phraseIn.value;
            if (!needle) {
              actions.notify('Type an exact word or phrase from this scene.');
              return;
            }
            const idx = scene.content.indexOf(needle);
            if (idx < 0) {
              actions.notify('Phrase not found in active scene prose.');
              return;
            }
            const kind = quickKindSel.value as ProofreadMarkKind;
            const spec = PROOFREAD_MARK_SPECS[kind];
            const reviewer = activeReviewerInfo(actions);
            const res = addProofreadMark(actions.getState().project, scene.id, {
              kind,
              start: idx,
              end: idx + needle.length,
              replacement: spec.promptsReplacement ? quickReplIn.value : undefined,
              note: !spec.promptsReplacement ? quickReplIn.value : '',
              authorName: reviewer.authorName,
              role: reviewer.role,
            });
            actions.mutateProject(() => res.project, false);
            actions.setState({ activeProofreadMarkId: res.mark?.id ?? '' }, true);
            actions.notify(`Marked “${needle}” (${spec.label})`);
          },
        },
      }),
    ),
    quickReplIn,
  );

  const list = el('div', { className: 'bv-snap-list' });
  if (filtered.length === 0) {
    list.appendChild(
      el('p', {
        className: 'bv-label',
        text: 'Select any word or sentence on the sheet and choose a mark symbol above, or use Quick Mark by Phrase.',
      }),
    );
  } else {
    for (const m of filtered) {
      const spec = PROOFREAD_MARK_SPECS[m.kind];
      const isSelected = m.id === state.activeProofreadMarkId;
      const noteIn = el('input', {
        className: 'bv-input',
        attrs: { type: 'text', value: m.note, placeholder: 'Add proofreader comment…' },
        on: {
          change: () =>
            actions.mutateProject((prev) =>
              updateProofreadMarkNote(prev, scene.id, m.id, noteIn.value),
            ),
        },
      });

      const card = el(
        'div',
        {
          className: 'bv-cork-card',
          style: {
            padding: '10px',
            gap: '6px',
            borderColor: isSelected ? 'var(--accent-ivory)' : 'var(--border-subtle)',
            cursor: 'pointer',
          },
          on: {
            click: () => {
              actions.setState({ activeProofreadMarkId: m.id }, false);
              const domTarget = paperScrollEl.querySelector(`[data-mark-id="${m.id}"]`);
              if (domTarget instanceof HTMLElement) {
                domTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            },
          },
        },
        el(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' } },
          el('span', {
            className: 'bv-mono-tag',
            text: `${spec.symbol} ${spec.label}`,
            style: { color: 'var(--accent-ivory)', fontWeight: '600' },
          }),
          el('span', {
            className: 'bv-mono-tag',
            text: m.status.toUpperCase(),
            style: {
              color:
                m.status === 'accepted'
                  ? 'var(--accent-emerald)'
                  : m.status === 'stet'
                    ? 'var(--accent-amber)'
                    : 'var(--text-muted)',
            },
          }),
        ),
        m.originalText
          ? el('div', {
              className: 'bv-label',
              text: m.replacement && m.replacement !== m.originalText
                ? `“${m.originalText}” → “${m.replacement}”`
                : `“${m.originalText}”`,
              style: { color: 'var(--text-primary)' },
            })
          : m.replacement
            ? el('div', { className: 'bv-label', text: `Insert: “${m.replacement}”`, style: { color: 'var(--accent-emerald)' } })
            : null,
        el('div', { className: 'bv-mono-tag', text: `By ${m.authorName}` }),
        noteIn,
        m.status === 'open' || m.status === 'stet'
          ? el(
              'div',
              { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } },
              el('button', {
                className: 'bv-mini-btn',
                text: 'Accept',
                attrs: { type: 'button' },
                on: {
                  click: (e) => {
                    e.stopPropagation();
                    const res = acceptProofreadMark(actions.getState().project, scene.id, m.id);
                    actions.mutateProject(() => res.project);
                    actions.notify(res.applied ? `Accepted ${spec.label}` : 'Target text shifted');
                  },
                },
              }),
              el('button', {
                className: 'bv-mini-btn',
                text: 'Stet',
                attrs: { type: 'button' },
                on: {
                  click: (e) => {
                    e.stopPropagation();
                    actions.mutateProject((prev) => stetProofreadMark(prev, scene.id, m.id));
                    actions.notify('Marked stet (let stand)');
                  },
                },
              }),
              el('button', {
                className: 'bv-mini-btn',
                text: 'Reject',
                attrs: { type: 'button' },
                on: {
                  click: (e) => {
                    e.stopPropagation();
                    actions.mutateProject((prev) => rejectProofreadMark(prev, scene.id, m.id));
                  },
                },
              }),
            )
          : null,
      );
      list.appendChild(card);
    }
  }

  return el(
    'aside',
    { className: 'bv-split-pane' },
    el(
      'div',
      { className: 'bv-split-head' },
      el('span', { className: 'bv-panel-title', text: 'Proofread Marks' }),
      filterSelect,
    ),
    el('div', { className: 'bv-split-body' }, quickCard, list),
  );
}

function renderSplitReferencePane(actions: AppActions): HTMLElement {
  const state = actions.getState();
  const { project, splitTargetKind, splitTargetId } = state;

  const allScenes = getAllScenes(project);
  const options: Array<{ kind: 'scene' | 'character' | 'location' | 'lore'; id: string; label: string }> = [
    ...allScenes.map((item) => ({
      kind: 'scene' as const,
      id: item.scene.id,
      label: `Scene: ${item.scene.title}`,
    })),
    ...project.bible.characters.map((c) => ({
      kind: 'character' as const,
      id: c.id,
      label: `Character: ${c.name}`,
    })),
    ...project.bible.locations.map((l) => ({
      kind: 'location' as const,
      id: l.id,
      label: `Location: ${l.name}`,
    })),
    ...project.bible.lore.map((lr) => ({
      kind: 'lore' as const,
      id: lr.id,
      label: `Lore: ${lr.name}`,
    })),
  ];

  const activeKey = `${splitTargetKind}:${splitTargetId}`;
  const select = el('select', {
    className: 'bv-select',
    style: { maxWidth: '220px' },
    on: {
      change: () => {
        const [kind, id] = select.value.split(':');
        actions.setState(
          {
            splitTargetKind: kind as 'scene' | 'character' | 'location' | 'lore',
            splitTargetId: id,
          },
          true,
        );
      },
    },
  });

  for (const opt of options) {
    const val = `${opt.kind}:${opt.id}`;
    select.appendChild(
      el('option', {
        text: opt.label,
        attrs: { value: val, selected: val === activeKey },
      }),
    );
  }

  const body = el('div', { className: 'bv-split-body' });

  const resolved = options.find((o) => `${o.kind}:${o.id}` === activeKey) ?? options[0];
  if (resolved) {
    if (resolved.kind === 'scene') {
      const targetScene = allScenes.find((s) => s.scene.id === resolved.id)?.scene;
      if (targetScene) {
        body.append(
          el('h3', { text: targetScene.title, style: { marginTop: '0', marginBottom: '6px' } }),
          el('p', {
            className: 'bv-mono-tag',
            text: `${countWords(targetScene.content)} words · ${targetScene.pov || 'No POV'}`,
            style: { marginBottom: '14px' },
          }),
          el('div', { className: 'bv-ref-prose', text: targetScene.content || '(Empty scene)' }),
        );
      }
    } else if (resolved.kind === 'character') {
      const ch = project.bible.characters.find((c) => c.id === resolved.id);
      if (ch) {
        body.append(
          el('h3', { text: ch.name, style: { marginTop: '0', marginBottom: '4px' } }),
          el('p', { className: 'bv-mono-tag', text: ch.role }),
          el('p', { text: `Aliases: ${ch.aliases || 'None'}` }),
          el('p', { text: `Motivation: ${ch.motivation || '—'}` }),
          el('p', { text: `Appearance: ${ch.appearance || '—'}` }),
          el('p', { text: ch.notes }),
        );
      }
    } else if (resolved.kind === 'location') {
      const loc = project.bible.locations.find((l) => l.id === resolved.id);
      if (loc) {
        body.append(
          el('h3', { text: loc.name, style: { marginTop: '0', marginBottom: '4px' } }),
          el('p', { className: 'bv-mono-tag', text: loc.region }),
          el('p', { text: loc.atmosphere }),
          el('p', { text: loc.notes }),
        );
      }
    } else {
      const lr = project.bible.lore.find((item) => item.id === resolved.id);
      if (lr) {
        body.append(
          el('h3', { text: lr.name, style: { marginTop: '0', marginBottom: '4px' } }),
          el('p', { className: 'bv-mono-tag', text: lr.category }),
          el('p', { text: lr.summary }),
          el('p', { text: lr.notes }),
        );
      }
    }
  }

  return el(
    'aside',
    { className: 'bv-split-pane' },
    el(
      'div',
      { className: 'bv-split-head' },
      el('span', { className: 'bv-panel-title', text: 'Reference' }),
      select,
    ),
    body,
  );
}

function renderRevisionDiffPane(
  actions: AppActions,
  scene: NonNullable<ReturnType<typeof findSceneContext>>['scene'],
): HTMLElement {
  const state = actions.getState();
  const snaps = scene.snapshots;

  const head = el(
    'div',
    { className: 'bv-split-head' },
    el('span', { className: 'bv-panel-title', text: 'Revision Diff' }),
  );
  const body = el('div', { className: 'bv-split-body' });

  if (snaps.length === 0) {
    body.append(
      el('p', {
        text: 'No revision snapshots exist for this scene yet. Capture a snapshot to compare edits word-for-word.',
        style: { color: 'var(--text-secondary)', marginTop: '0' },
      }),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-primary',
          attrs: { type: 'button' },
          on: { click: () => actions.createSnapshot('Initial Snapshot') },
        },
        icon('camera', 14),
        'Capture Snapshot Now',
      ),
    );
    return el('aside', { className: 'bv-split-pane' }, head, body);
  }

  const chosen = snaps.find((s) => s.id === state.diffSnapshotId) ?? snaps[0];
  const snapSelect = el('select', {
    className: 'bv-select',
    on: {
      change: () => actions.setState({ diffSnapshotId: snapSelect.value }, true),
    },
  });
  for (const s of snaps) {
    snapSelect.appendChild(
      el('option', {
        text: `${s.label} (${s.wordCount}w)`,
        attrs: { value: s.id, selected: s.id === chosen.id },
      }),
    );
  }
  head.appendChild(snapSelect);

  const diff = computeWordDiff(chosen.content, scene.content);

  const statsRow = el(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border-subtle)',
      },
    },
    el('span', {
      className: 'bv-mono-tag',
      text: `+${diff.addedWords} added  /  -${diff.removedWords} removed`,
    }),
    el('button', {
      className: 'bv-mini-btn',
      text: 'Restore Snapshot',
      attrs: { type: 'button' },
      on: {
        click: () => {
          actions.mutateProject((prev) => restoreSnapshotToScene(prev, scene.id, chosen.id));
          actions.notify(`Restored “${chosen.label}”`);
        },
      },
    }),
  );

  const diffBox = el('div', { className: 'bv-diff-box' });
  for (const token of diff.tokens) {
    if (token.type === 'equal') {
      diffBox.appendChild(document.createTextNode(token.value));
    } else if (token.type === 'insert') {
      diffBox.appendChild(el('span', { className: 'bv-diff-ins', text: token.value }));
    } else {
      diffBox.appendChild(el('span', { className: 'bv-diff-del', text: token.value }));
    }
  }

  body.append(statsRow, diffBox);
  return el('aside', { className: 'bv-split-pane' }, head, body);
}
