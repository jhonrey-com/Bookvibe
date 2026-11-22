import type { AppActions, EditorSubMode } from '../core/app-context';
import {
  countWords,
  findSceneContext,
  getAllScenes,
  splitSceneAtOffset,
} from '../core/manuscript';
import { computeWordDiff, restoreSnapshotToScene } from '../core/snapshots';
import type { PaperTheme } from '../core/types';
import { clearNode, el, icon } from '../ui/dom';
import { LiquidGlassControl } from '../ui/liquid-glass';

let activeEditorGlass: LiquidGlassControl<EditorSubMode> | null = null;

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

  const proseTextarea = el('textarea', {
    className: `bv-prose-textarea${state.typewriterMode ? ' is-typewriter' : ''}`,
    attrs: {
      placeholder: 'Begin writing this scene…',
      spellcheck: 'true',
      'aria-label': 'Scene prose editor',
    },
  });
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
      attrs: { 'aria-label': 'Paper canvas theme' },
      on: {
        change: () => {
          const val = paperSelect.value as PaperTheme;
          actions.mutateProject((prev) => ({ ...prev, paperTheme: val }));
        },
      },
    },
    el('option', { text: 'Paper: Obsidian', attrs: { value: 'obsidian', selected: state.project.paperTheme === 'obsidian' } }),
    el('option', { text: 'Paper: Parchment', attrs: { value: 'parchment', selected: state.project.paperTheme === 'parchment' } }),
    el('option', { text: 'Paper: Ivory', attrs: { value: 'ivory', selected: state.project.paperTheme === 'ivory' } }),
  );

  const subModeControl = new LiquidGlassControl<EditorSubMode>({
    ariaLabel: 'Editor pane mode',
    surface: 'clear',
    compact: true,
    value: state.editorSubMode,
    options: [
      { id: 'draft', label: 'Draft', icon: 'edit' },
      { id: 'split', label: 'Split View', icon: 'split' },
      { id: 'diff', label: 'Revision Diff', icon: 'camera' },
    ],
    onChange: (mode) => {
      actions.setState({ editorSubMode: mode }, true);
    },
  });
  activeEditorGlass = subModeControl;

  const subbar = el(
    'div',
    { className: 'bv-subbar' },
    el(
      'div',
      { className: 'bv-subbar-group' },
      el('button', {
        className: 'bv-fmt-btn',
        text: 'B',
        attrs: { type: 'button', title: 'Bold (Ctrl+B)' },
        style: { fontWeight: '700' },
        on: { click: () => wrapSelection(proseTextarea, '**', '**', actions) },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'I',
        attrs: { type: 'button', title: 'Italic (Ctrl+I)' },
        style: { fontStyle: 'italic' },
        on: { click: () => wrapSelection(proseTextarea, '*', '*', actions) },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'H2',
        attrs: { type: 'button', title: 'Section Heading' },
        on: { click: () => insertAtLineStart(proseTextarea, '## ', actions) },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'Quote',
        attrs: { type: 'button', title: 'Epigraph / Blockquote' },
        on: { click: () => insertAtLineStart(proseTextarea, '> ', actions) },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: '* * *',
        attrs: { type: 'button', title: 'Insert Scene Break' },
        on: {
          click: () => {
            const pos = proseTextarea.selectionStart;
            const cur = proseTextarea.value;
            const insertion = '\n\n* * *\n\n';
            const nextVal = cur.slice(0, pos) + insertion + cur.slice(pos);
            proseTextarea.value = nextVal;
            proseTextarea.focus();
            proseTextarea.setSelectionRange(pos + insertion.length, pos + insertion.length);
            actions.updateActiveSceneTextQuietly('content', nextVal);
          },
        },
      }),
      el('button', {
        className: 'bv-fmt-btn',
        text: 'Split Scene',
        attrs: { type: 'button', title: 'Split into two scenes at cursor position' },
        on: {
          click: () => {
            const res = splitSceneAtOffset(
              actions.getState().project,
              scene.id,
              proseTextarea.selectionStart,
            );
            if (!res.newSceneId) {
              actions.notify('Place the cursor inside prose before splitting.');
              return;
            }
            actions.mutateProject(() => res.project, false);
            actions.selectScene(res.newSceneId, true);
            actions.notify('Scene split at cursor');
          },
        },
      }),
    ),
    el(
      'div',
      { className: 'bv-subbar-group' },
      paperSelect,
      el('button', {
        className: `bv-fmt-btn${state.typewriterMode ? ' is-active' : ''}`,
        text: 'Typewriter',
        attrs: { type: 'button', title: 'Center writing line vertically' },
        on: {
          click: () => {
            actions.setState({ typewriterMode: !actions.getState().typewriterMode }, true);
          },
        },
      }),
      el(
        'button',
        {
          className: `bv-fmt-btn${state.zenMode ? ' is-active' : ''}`,
          attrs: { type: 'button', title: 'Toggle Zen Focus Mode (Ctrl+Shift+F)' },
          on: {
            click: () => actions.setState({ zenMode: !actions.getState().zenMode }, true),
          },
        },
        icon('zen', 13),
        'Zen',
      ),
      el(
        'button',
        {
          className: 'bv-fmt-btn',
          attrs: { type: 'button', title: 'Save Revision Snapshot (Ctrl+S)' },
          on: { click: () => actions.createSnapshot() },
        },
        icon('camera', 13),
        'Snapshot',
      ),
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
        flex: '1 1 180px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }),
    el('div', { style: { flexShrink: '0' } }, subModeControl.element),
  );

  const paperSheet = el(
    'div',
    { className: 'bv-paper-sheet' },
    paperFloatNav,
    sceneHeading,
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

  const panes = el('div', {
    className: `bv-editor-panes${state.editorSubMode !== 'draft' ? ' has-split' : ''}`,
  });
  panes.appendChild(paperScroll);

  if (state.editorSubMode === 'split') {
    panes.appendChild(renderSplitReferencePane(actions));
  } else if (state.editorSubMode === 'diff') {
    panes.appendChild(renderRevisionDiffPane(actions, scene));
  }

  container.append(subbar, panes);
  requestAnimationFrame(() => {
    syncTextareaHeight();
    activeEditorGlass?.sampleBackdrop(true);
  });
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
