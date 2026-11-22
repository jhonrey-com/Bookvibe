import type { AppActions } from '../core/app-context';
import {
  addChapterToPart,
  addPartToProject,
  addSceneToChapter,
  deleteChapterFromProject,
  deleteSceneFromProject,
  getChapterWordCount,
  countWords,
  moveScene,
} from '../core/manuscript';
import { clearNode, el, icon } from '../ui/dom';

export function renderBinder(container: HTMLElement, actions: AppActions): void {
  clearNode(container);
  const state = actions.getState();
  const { project, activeSceneId } = state;

  let draggedSceneId: string | null = null;

  const head = el(
    'div',
    { className: 'bv-panel-head' },
    el('span', { className: 'bv-panel-title', text: 'Manuscript' }),
    el(
      'div',
      { className: 'bv-binder-actions' },
      el(
        'button',
        {
          className: 'bv-mini-btn',
          tooltip: { title: 'Add Part', short: 'Append a new Part division to this book.' },
          attrs: { type: 'button' },
          on: {
            click: () => {
              const res = addPartToProject(actions.getState().project);
              actions.mutateProject(() => res.project, false);
              actions.selectScene(res.sceneId, true);
              actions.notify('Added new Part');
            },
          },
        },
        icon('plus', 12),
        'Part',
      ),
      el(
        'button',
        {
          className: 'bv-mini-btn',
          tooltip: { title: 'Add Chapter', short: 'Add a new Chapter with starter scene.' },
          attrs: { type: 'button' },
          on: {
            click: () => {
              const partId = project.parts[0]?.id ?? '';
              const res = addChapterToPart(actions.getState().project, partId);
              actions.mutateProject(() => res.project, false);
              actions.selectScene(res.sceneId, true);
              actions.notify('Added new Chapter');
            },
          },
        },
        icon('plus', 12),
        'Ch',
      ),
    ),
  );

  const scroll = el('div', { className: 'bv-binder-scroll' });

  for (const part of project.parts) {
    const partWrap = el('div', { className: 'bv-tree-part' });

    const partRow = el(
      'div',
      { className: 'bv-tree-row' },
      el(
        'div',
        {
          className: 'bv-tree-row-left',
          on: {
            click: () => {
              actions.mutateProject((prev) => {
                const next = structuredClone(prev);
                const target = next.parts.find((p) => p.id === part.id);
                if (target) target.collapsed = !target.collapsed;
                return next;
              });
            },
          },
        },
        icon(part.collapsed ? 'chevron-right' : 'chevron-down', 13),
        el('span', { className: 'bv-tree-label bv-tree-part-label', text: part.title }),
      ),
      el(
        'div',
        { className: 'bv-row-hover-tools' },
        el(
          'button',
          {
            className: 'bv-icon-tiny',
            tooltip: { title: 'Add Chapter to Part', short: 'Create a chapter inside this Part.' },
            attrs: { type: 'button' },
            on: {
              click: (e) => {
                e.stopPropagation();
                const res = addChapterToPart(actions.getState().project, part.id);
                actions.mutateProject(() => res.project, false);
                actions.selectScene(res.sceneId, true);
              },
            },
          },
          icon('plus', 12),
        ),
      ),
    );

    partWrap.appendChild(partRow);

    if (!part.collapsed) {
      for (const chapter of part.chapters) {
        const chapWrap = el('div', { className: 'bv-tree-chapter' });
        const chapWords = getChapterWordCount(chapter);

        const chapRow = el(
          'div',
          {
            className: 'bv-tree-row',
            on: {
              dragover: (e) => {
                if (!draggedSceneId) return;
                e.preventDefault();
                chapRow.classList.add('is-drop-target');
              },
              dragleave: () => chapRow.classList.remove('is-drop-target'),
              drop: (e) => {
                e.preventDefault();
                chapRow.classList.remove('is-drop-target');
                if (!draggedSceneId) return;
                const movedId = draggedSceneId;
                draggedSceneId = null;
                actions.mutateProject((prev) => moveScene(prev, movedId, chapter.id));
              },
            },
          },
          el(
            'div',
            {
              className: 'bv-tree-row-left',
              on: {
                click: () => {
                  actions.mutateProject((prev) => {
                    const next = structuredClone(prev);
                    for (const p of next.parts) {
                      const c = p.chapters.find((ch) => ch.id === chapter.id);
                      if (c) c.collapsed = !c.collapsed;
                    }
                    return next;
                  });
                },
              },
            },
            icon(chapter.collapsed ? 'chevron-right' : 'chevron-down', 12),
            el('span', { className: 'bv-tree-label bv-tree-chapter-label', text: chapter.title }),
          ),
          el(
            'span',
            {
              className: 'bv-tree-count bv-tree-count-hide-hover',
              text: String(chapWords),
              attrs: { 'data-binder-chap': chapter.id },
            },
          ),
          el(
            'div',
            { className: 'bv-row-hover-tools' },
            el(
              'button',
              {
                className: 'bv-icon-tiny',
                tooltip: { title: 'Add Scene', short: 'Append a new scene to this chapter.' },
                attrs: { type: 'button' },
                on: {
                  click: (e) => {
                    e.stopPropagation();
                    const res = addSceneToChapter(actions.getState().project, chapter.id);
                    actions.mutateProject(() => res.project, false);
                    actions.selectScene(res.sceneId, true);
                  },
                },
              },
              icon('plus', 12),
            ),
            el(
              'button',
              {
                className: 'bv-icon-tiny',
                tooltip: { title: 'Delete Chapter', short: 'Remove this chapter and its scenes.' },
                attrs: { type: 'button' },
                on: {
                  click: (e) => {
                    e.stopPropagation();
                    if (part.chapters.length <= 1 && project.parts.length <= 1) {
                      actions.notify('A manuscript must contain at least one chapter.');
                      return;
                    }
                    const res = deleteChapterFromProject(actions.getState().project, chapter.id);
                    actions.mutateProject(() => res.project, false);
                    if (res.fallbackSceneId) {
                      actions.selectScene(res.fallbackSceneId, false);
                    }
                  },
                },
              },
              icon('trash', 12),
            ),
          ),
        );

        chapWrap.appendChild(chapRow);

        if (!chapter.collapsed) {
          chapter.scenes.forEach((scene, sIdx) => {
            const words = countWords(scene.content);
            const sceneRow = el(
              'div',
              {
                className: `bv-tree-row bv-tree-scene${scene.id === activeSceneId ? ' is-active' : ''}`,
                attrs: { draggable: true },
                on: {
                  click: () => actions.selectScene(scene.id, true),
                  dragstart: (e) => {
                    draggedSceneId = scene.id;
                    e.dataTransfer?.setData('text/plain', scene.id);
                  },
                  dragover: (e) => {
                    if (!draggedSceneId || draggedSceneId === scene.id) return;
                    e.preventDefault();
                    sceneRow.classList.add('is-drop-target');
                  },
                  dragleave: () => sceneRow.classList.remove('is-drop-target'),
                  drop: (e) => {
                    e.preventDefault();
                    sceneRow.classList.remove('is-drop-target');
                    if (!draggedSceneId || draggedSceneId === scene.id) return;
                    const movedId = draggedSceneId;
                    draggedSceneId = null;
                    actions.mutateProject((prev) => moveScene(prev, movedId, chapter.id, sIdx));
                  },
                },
              },
              el(
                'div',
                { className: 'bv-tree-row-left' },
                el('span', { className: `bv-status-dot bv-status-${scene.status}` }),
                el('span', {
                  className: 'bv-tree-label',
                  text: scene.title || 'Untitled Scene',
                  attrs: { 'data-binder-title': scene.id },
                }),
              ),
              el('span', {
                className: 'bv-tree-count bv-tree-count-hide-hover',
                text: String(words),
                attrs: { 'data-binder-scene': scene.id },
              }),
              el(
                'div',
                { className: 'bv-row-hover-tools' },
                el(
                  'button',
                  {
                    className: 'bv-icon-tiny',
                    tooltip: { title: 'Export .bvscene', short: 'Save scene as standalone .bvscene file.' },
                    attrs: { type: 'button' },
                    on: {
                      click: (e) => {
                        e.stopPropagation();
                        void actions.exportAsExtension('.bvscene', { sceneId: scene.id });
                      },
                    },
                  },
                  icon('file', 12),
                ),
                el(
                  'button',
                  {
                    className: 'bv-icon-tiny',
                    tooltip: { title: 'Delete Scene', short: 'Remove scene from this chapter.' },
                    attrs: { type: 'button' },
                    on: {
                      click: (e) => {
                        e.stopPropagation();
                        const res = deleteSceneFromProject(actions.getState().project, scene.id);
                        actions.mutateProject(() => res.project, false);
                        if (res.fallbackSceneId) {
                          actions.selectScene(res.fallbackSceneId, false);
                        }
                      },
                    },
                  },
                  icon('trash', 12),
                ),
              ),
            );
            chapWrap.appendChild(sceneRow);
          });
        }
        partWrap.appendChild(chapWrap);
      }
    }
    scroll.appendChild(partWrap);
  }

  container.append(head, scroll);
}
