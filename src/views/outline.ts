import type { AppActions } from '../core/app-context';
import {
  SCENE_STATUS_LABELS,
  countWords,
  estimateReadingMinutes,
  getAllScenes,
  updateSceneInProject,
} from '../core/manuscript';
import type { SceneStatus } from '../core/types';
import { attachContextMenu } from '../ui/context-menu';
import { clearNode, el } from '../ui/dom';

let searchFilter = '';
let statusFilter: SceneStatus | 'all' = 'all';

export function renderOutlineView(container: HTMLElement, actions: AppActions): void {
  clearNode(container);
  const state = actions.getState();
  const scenes = getAllScenes(state.project);

  let renderRows = () => {};

  const searchInput = el('input', {
    className: 'bv-input',
    style: { width: '240px' },
    attrs: {
      type: 'search',
      value: searchFilter,
      placeholder: 'Filter by title, POV, location…',
    },
    on: {
      input: () => {
        searchFilter = searchInput.value;
        renderRows();
      },
    },
  });

  const statusSelect = el(
    'select',
    {
      className: 'bv-select',
      on: {
        change: () => {
          statusSelect.blur();
          statusFilter = statusSelect.value as SceneStatus | 'all';
          renderRows();
        },
      },
    },
    el('option', { text: 'All Statuses', attrs: { value: 'all', selected: statusFilter === 'all' } }),
    ...Object.entries(SCENE_STATUS_LABELS).map(([val, label]) =>
      el('option', { text: label, attrs: { value: val, selected: statusFilter === val } }),
    ),
  );

  const toolbar = el(
    'div',
    { className: 'bv-subbar' },
    el('span', { className: 'bv-panel-title', text: 'Outline & Timeline Ledger' }),
    el('div', { className: 'bv-subbar-group' }, searchInput, statusSelect),
  );

  const tbody = el('tbody');

  renderRows = () => {
    clearNode(tbody);
    const query = searchFilter.trim().toLowerCase();
    const filtered = scenes.filter((item) => {
      if (statusFilter !== 'all' && item.scene.status !== statusFilter) return false;
      if (!query) return true;
      const hay = `${item.part.title} ${item.chapter.title} ${item.scene.title} ${item.scene.pov} ${item.scene.location} ${item.scene.timeline}`.toLowerCase();
      return hay.includes(query);
    });

    for (const item of filtered) {
      const { scene, chapter, sequenceNumber } = item;
      const words = countWords(scene.content);
      const pct = scene.wordTarget > 0 ? Math.round((words / scene.wordTarget) * 100) : 100;

      const rowStatus = el('select', {
        className: 'bv-select',
        on: {
          change: () => {
            const status = rowStatus.value as SceneStatus;
            actions.mutateProject((prev) => updateSceneInProject(prev, scene.id, { status }));
          },
        },
      });
      for (const [val, label] of Object.entries(SCENE_STATUS_LABELS)) {
        rowStatus.appendChild(
          el('option', { text: label, attrs: { value: val, selected: scene.status === val } }),
        );
      }

      const row = el(
        'tr',
        {},
        el('td', { className: 'bv-mono-tag', text: String(sequenceNumber).padStart(2, '0') }),
        el(
          'td',
          {},
          el(
            'button',
            {
              className: 'bv-fmt-btn',
              text: scene.title || 'Untitled Scene',
              attrs: { type: 'button' },
              style: { paddingLeft: '0', fontWeight: '600', color: 'var(--text-primary)' },
              on: { click: () => actions.selectScene(scene.id, true) },
            },
          ),
          el('div', { className: 'bv-label', text: chapter.title }),
        ),
        el('td', { className: 'bv-mono-tag', text: scene.timeline || '—' }),
        el('td', { text: scene.pov || '—' }),
        el('td', { text: scene.location || '—' }),
        el('td', {}, rowStatus),
        el('td', { className: 'bv-mono-tag', text: `${words} / ${scene.wordTarget} (${pct}%)` }),
        el('td', { className: 'bv-mono-tag', text: `${estimateReadingMinutes(words)}m` }),
      );
      tbody.appendChild(row);
      attachContextMenu(row, () => [
        {
          heading: scene.title || 'Untitled Scene',
          items: [
            {
              label: 'Edit Scene Draft',
              icon: 'draft-sheet',
              onSelect: () => {
                actions.setState({ editorSubMode: 'draft' }, false);
                actions.selectScene(scene.id, true);
              },
            },
            {
              label: 'Proofread Scene',
              icon: 'proofread',
              onSelect: () => {
                actions.setState({ editorSubMode: 'proofread' }, false);
                actions.selectScene(scene.id, true);
              },
            },
            {
              label: 'Export Scene (.qvscene)',
              icon: 'file',
              onSelect: () => void actions.exportAsExtension('.qvscene', { sceneId: scene.id }),
            },
          ],
        },
        {
          heading: 'Set Revision Stage',
          items: (['outline', 'draft', 'revision', 'final'] as SceneStatus[]).map((st) => ({
            label: SCENE_STATUS_LABELS[st],
            checked: scene.status === st,
            onSelect: () => actions.mutateProject((prev) => updateSceneInProject(prev, scene.id, { status: st })),
          })),
        },
      ]);
    }
  };

  renderRows();

  const table = el(
    'table',
    { className: 'bv-table' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { text: '#' }),
        el('th', { text: 'Scene / Chapter' }),
        el('th', { text: 'Timeline' }),
        el('th', { text: 'POV' }),
        el('th', { text: 'Location' }),
        el('th', { text: 'Status' }),
        el('th', { text: 'Word Progress' }),
        el('th', { text: 'Read' }),
      ),
    ),
    tbody,
  );

  const wrap = el(
    'div',
    { className: 'bv-scroll-view' },
    el('div', { className: 'bv-table-wrap' }, table),
  );

  container.append(toolbar, wrap);
}
