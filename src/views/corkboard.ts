import type { AppActions } from '../core/app-context';
import {
  SCENE_STATUS_LABELS,
  addSceneToChapter,
  countWords,
  getChapterWordCount,
  moveScene,
  updateSceneInProject,
} from '../core/manuscript';
import type { SceneStatus } from '../core/types';
import { clearNode, el, icon } from '../ui/dom';

export function renderCorkboardView(container: HTMLElement, actions: AppActions): void {
  clearNode(container);
  const state = actions.getState();
  const { project, activeSceneId } = state;

  let draggedSceneId: string | null = null;

  const wrap = el('div', { className: 'bv-scroll-view' });

  for (const part of project.parts) {
    for (const chapter of part.chapters) {
      const chapBlock = el('section', { className: 'bv-cork-chapter' });

      const chapHead = el(
        'div',
        { className: 'bv-cork-chapter-head' },
        el(
          'div',
          {},
          el('span', { className: 'bv-mono-tag', text: part.title.toUpperCase() }),
          el('h2', { text: chapter.title, style: { margin: '2px 0 0', fontSize: '18px', fontWeight: '600' } }),
        ),
        el(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          el('span', { className: 'bv-mono-tag', text: `${getChapterWordCount(chapter)} words` }),
          el(
            'button',
            {
              className: 'bv-mini-btn',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  const res = addSceneToChapter(actions.getState().project, chapter.id);
                  actions.mutateProject(() => res.project);
                },
              },
            },
            icon('plus', 12),
            'Scene',
          ),
        ),
      );

      const grid = el('div', { className: 'bv-cork-grid' });

      chapter.scenes.forEach((scene, sIdx) => {
        const words = countWords(scene.content);
        const pct = scene.wordTarget > 0 ? Math.min(100, Math.round((words / scene.wordTarget) * 100)) : 100;

        const statusSelect = el('select', {
          className: 'bv-select',
          on: {
            change: () => {
              const status = statusSelect.value as SceneStatus;
              actions.mutateProject((prev) => updateSceneInProject(prev, scene.id, { status }));
            },
          },
        });
        for (const [val, label] of Object.entries(SCENE_STATUS_LABELS)) {
          statusSelect.appendChild(
            el('option', { text: label, attrs: { value: val, selected: scene.status === val } }),
          );
        }

        const syn = el('textarea', {
          className: 'bv-cork-synopsis',
          attrs: { placeholder: 'Scene summary card…' },
          on: {
            change: () =>
              actions.mutateProject((prev) =>
                updateSceneInProject(prev, scene.id, { synopsis: syn.value }),
              ),
          },
        });
        syn.value = scene.synopsis;

        const card = el(
          'article',
          {
            className: `bv-cork-card${scene.id === activeSceneId ? ' is-active' : ''}`,
            attrs: { draggable: true },
            on: {
              dragstart: () => {
                draggedSceneId = scene.id;
              },
              dragover: (e) => {
                if (!draggedSceneId || draggedSceneId === scene.id) return;
                e.preventDefault();
                card.classList.add('is-drop-target');
              },
              dragleave: () => card.classList.remove('is-drop-target'),
              drop: (e) => {
                e.preventDefault();
                card.classList.remove('is-drop-target');
                if (!draggedSceneId || draggedSceneId === scene.id) return;
                const moved = draggedSceneId;
                draggedSceneId = null;
                actions.mutateProject((prev) => moveScene(prev, moved, chapter.id, sIdx));
              },
            },
          },
          el(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
            el(
              'button',
              {
                className: 'bv-fmt-btn',
                text: scene.title || 'Untitled Scene',
                attrs: { type: 'button', title: 'Open in Editor' },
                style: { paddingLeft: '0', fontWeight: '600', color: 'var(--text-primary)' },
                on: { click: () => actions.selectScene(scene.id, true) },
              },
            ),
            el('span', { className: `bv-status-dot bv-status-${scene.status}` }),
          ),
          syn,
          el(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' } },
            statusSelect,
            el('span', {
              className: 'bv-mono-tag',
              text: `${words} / ${scene.wordTarget || '—'}w`,
            }),
          ),
          el(
            'div',
            { className: 'bv-progress-track' },
            el('div', { className: 'bv-progress-fill', style: { width: `${pct}%` } }),
          ),
          el('div', {
            className: 'bv-mono-tag',
            text: `${scene.pov || 'No POV'}  ·  ${scene.timeline || 'Unplaced'}`,
          }),
        );

        grid.appendChild(card);
      });

      chapBlock.append(chapHead, grid);
      wrap.appendChild(chapBlock);
    }
  }

  container.appendChild(wrap);
}
