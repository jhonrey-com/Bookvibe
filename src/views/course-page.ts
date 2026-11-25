import type { AppActions } from '../core/app-context';
import type { ToolTier } from '../core/types';
import {
  COURSE_MODULES,
  getCourseCompletionSummary,
  navigateToCourseLesson,
  openInteractiveCourseDrawer,
  readCompletedCourseLessons,
  toggleCourseLessonDone,
  type CourseLesson,
  type CourseModule,
} from '../ui/course';
import { clearNode, el, icon } from '../ui/dom';

let selectedModuleId = COURSE_MODULES[0].id;
let selectedLessonId = COURSE_MODULES[0].lessons[0].id;
let tierFilter: 'all' | ToolTier = 'all';
const checkpointSelections = new Map<string, number>();

export function setCoursePageSelection(moduleId?: string, lessonId?: string): void {
  if (moduleId && COURSE_MODULES.some((m) => m.id === moduleId)) {
    selectedModuleId = moduleId;
    const mod = COURSE_MODULES.find((m) => m.id === moduleId)!;
    selectedLessonId =
      lessonId && mod.lessons.some((l) => l.id === lessonId) ? lessonId : mod.lessons[0].id;
  } else if (lessonId) {
    for (const m of COURSE_MODULES) {
      if (m.lessons.some((l) => l.id === lessonId)) {
        selectedModuleId = m.id;
        selectedLessonId = lessonId;
        break;
      }
    }
  }
}

interface FlatLessonRef {
  module: CourseModule;
  lesson: CourseLesson;
}

function getAllFlatLessons(): FlatLessonRef[] {
  const out: FlatLessonRef[] = [];
  for (const m of COURSE_MODULES) {
    for (const l of m.lessons) {
      out.push({ module: m, lesson: l });
    }
  }
  return out;
}

/**
 * Full-page educational curriculum integrated at quillvibe.jhonrey.com/course and inside the desktop executable.
 */
const MODULE_SCREENSHOTS: Partial<Record<string, { src: string; caption: string }>> = {
  'mod-setup': {
    src: '/screenshots/editor-workspace.png',
    caption: 'Quillvibe Manuscript workspace: Binder, Paper Sheet, centered navigation bar, and Inspector.',
  },
  'mod-plot': {
    src: '/screenshots/story-graph.png',
    caption: 'Story Graph showing character and plot cards linked with crisp left/right connections.',
  },
  'mod-cover': {
    src: '/screenshots/cover-studio.png',
    caption: 'Book Cover Studio with layered shapes, corner resize handles, and live design properties.',
  },
};

export function renderCoursePageView(container: HTMLElement, actions: AppActions): void {
  clearNode(container);

  const flatAll = getAllFlatLessons();
  const currentRef =
    flatAll.find((r) => r.lesson.id === selectedLessonId) ??
    flatAll.find((r) => r.module.id === selectedModuleId) ??
    flatAll[0];
  selectedModuleId = currentRef.module.id;
  selectedLessonId = currentRef.lesson.id;

  const doneSet = readCompletedCourseLessons();
  const summary = getCourseCompletionSummary();
  const currentIdx = flatAll.findIndex((r) => r.lesson.id === currentRef.lesson.id);
  const prevRef = currentIdx > 0 ? flatAll[currentIdx - 1] : null;
  const nextRef = currentIdx < flatAll.length - 1 ? flatAll[currentIdx + 1] : null;

  // Sidebar
  const filterRow = el(
    'div',
    { className: 'qv-course-filter-row' },
    ...(['all', 'basic', 'intermediate', 'advanced'] as const).map((tier) =>
      el('button', {
        className: `bv-mini-btn${tierFilter === tier ? ' is-active' : ''}`,
        text: tier === 'all' ? 'All' : tier.charAt(0).toUpperCase() + tier.slice(1),
        attrs: { type: 'button' },
        on: {
          click: () => {
            tierFilter = tier;
            renderCoursePageView(container, actions);
          },
        },
      }),
    ),
  );

  const navList = el('div', { className: 'qv-course-nav-list' });
  for (const mod of COURSE_MODULES) {
    const visibleLessons =
      tierFilter === 'all' ? mod.lessons : mod.lessons.filter((l) => l.minTier === tierFilter);
    if (visibleLessons.length === 0) continue;

    const modCompleted = mod.lessons.filter((l) => doneSet.has(l.id)).length;
    const modBlock = el(
      'div',
      { className: 'qv-course-nav-group' },
      el(
        'div',
        { className: 'qv-course-nav-group-head' },
        el('span', { text: `Module ${mod.number}: ${mod.title}` }),
        el('span', { className: 'bv-mono-tag', text: `${modCompleted}/${mod.lessons.length}` }),
      ),
    );

    for (const lesson of visibleLessons) {
      const isSelected = lesson.id === currentRef.lesson.id;
      const isDone = doneSet.has(lesson.id);
      modBlock.appendChild(
        el(
          'button',
          {
            className: `qv-course-nav-item${isSelected ? ' is-active' : ''}${isDone ? ' is-done' : ''}`,
            attrs: { type: 'button' },
            on: {
              click: () => {
                selectedModuleId = mod.id;
                selectedLessonId = lesson.id;
                renderCoursePageView(container, actions);
              },
            },
          },
          el('span', {
            className: 'qv-course-nav-dot',
            text: isDone ? '✓' : '·',
          }),
          el(
            'div',
            { className: 'qv-course-nav-item-text' },
            el('div', { text: lesson.title }),
            el('span', {
              className: 'bv-mono-tag',
              text: `${lesson.durationMin}m · ${lesson.minTier}`,
            }),
          ),
        ),
      );
    }
    navList.appendChild(modBlock);
  }

  const sidebar = el(
    'aside',
    { className: 'qv-course-sidebar', attrs: { 'aria-label': 'Course Modules' } },
    el(
      'div',
      { className: 'qv-course-sidebar-top' },
      el(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
        el('strong', { text: 'Quillvibe Academy', style: { fontSize: '15px' } }),
        el(
          'button',
          {
            className: 'bv-mini-btn',
            attrs: { type: 'button' },
            on: { click: () => actions.setState({ activeView: 'editor' }, true) },
          },
          icon('quill', 12),
          'Back to Book',
        ),
      ),
      el('div', {
        className: 'bv-label',
        text: `${summary.completed} of ${summary.total} lessons completed (${summary.pct}%)`,
      }),
      el(
        'div',
        { className: 'qv-course-progress-bar' },
        el('div', {
          className: 'qv-course-progress-fill',
          style: { width: `${summary.pct}%` },
        }),
      ),
      filterRow,
    ),
    navList,
  );

  // Main lesson reading pane
  const { module: mod, lesson } = currentRef;
  const isDone = doneSet.has(lesson.id);

  const moduleShot = MODULE_SCREENSHOTS[mod.id];
  const visualFigure = moduleShot
    ? el(
        'figure',
        { className: 'qv-help-figure' },
        el('img', {
          attrs: { src: moduleShot.src, alt: moduleShot.caption, loading: 'lazy' },
        }),
        el('figcaption', { text: moduleShot.caption }),
      )
    : null;

  const conceptsBox = el(
    'section',
    { className: 'qv-course-section' },
    el('h3', { text: 'Why It Matters & How It Works' }),
    ...lesson.concepts.map((para) => el('p', { text: para })),
    visualFigure,
  );

  const stepsOl = el('ol', { className: 'qv-course-steps-list' });
  for (const step of lesson.steps) {
    stepsOl.appendChild(el('li', { text: step }));
  }

  const stepsBox = el(
    'section',
    { className: 'qv-course-section' },
    el('h3', { text: 'Step-by-Step Practice' }),
    stepsOl,
  );

  const exampleBox = el(
    'aside',
    { className: 'qv-course-callout' },
    el('div', { className: 'bv-panel-title', text: `Practical Example · ${lesson.example.heading}` }),
    el('p', { text: lesson.example.body }),
    el(
      'div',
      { className: 'qv-course-protip' },
      el('strong', { text: 'Pro Tip: ' }),
      el('span', { text: lesson.proTip }),
    ),
  );

  // Interactive self-check quiz
  const chosenIdx = checkpointSelections.get(lesson.id);
  const checkpointOptions = el('div', { className: 'qv-course-quiz-opts' });
  lesson.checkpoint.options.forEach((optText, idx) => {
    const isChosen = chosenIdx === idx;
    const isCorrect = idx === lesson.checkpoint.correctIndex;
    let stateClass = '';
    if (chosenIdx !== undefined) {
      if (isCorrect) stateClass = ' is-correct';
      else if (isChosen) stateClass = ' is-wrong';
    }
    checkpointOptions.appendChild(
      el(
        'button',
        {
          className: `qv-course-quiz-opt${stateClass}`,
          attrs: { type: 'button' },
          on: {
            click: () => {
              checkpointSelections.set(lesson.id, idx);
              renderCoursePageView(container, actions);
            },
          },
        },
        el('span', { className: 'bv-mono-tag', text: String.fromCharCode(65 + idx) }),
        el('span', { text: optText }),
      ),
    );
  });

  const checkpointBox = el(
    'section',
    { className: 'qv-course-section qv-course-quiz-card' },
    el('h3', { text: 'Knowledge Check' }),
    el('p', { text: lesson.checkpoint.question, style: { fontWeight: '600' } }),
    checkpointOptions,
    ...(chosenIdx !== undefined
      ? [
          el('div', {
            className: 'qv-course-quiz-feedback',
            text:
              chosenIdx === lesson.checkpoint.correctIndex
                ? `Correct — ${lesson.checkpoint.explanation}`
                : `Review note: ${lesson.checkpoint.explanation}`,
          }),
        ]
      : []),
  );

  const mainPane = el(
    'div',
    { className: 'qv-course-article-wrap' },
    el(
      'article',
      { className: 'qv-course-article' },
      el(
        'div',
        { className: 'qv-course-meta-row' },
        el('span', { className: 'bv-mono-tag', text: `MODULE ${mod.number} · ${mod.title.toUpperCase()}` }),
        el('span', { className: 'bv-mono-tag', text: `${lesson.durationMin} MIN · ${lesson.minTier.toUpperCase()} TIER` }),
      ),
      el('h1', { className: 'qv-course-title', text: lesson.title }),
      el('p', { className: 'qv-course-lead', text: lesson.instruction }),
      el(
        'div',
        { className: 'qv-course-objective' },
        el('strong', { text: 'Learning Goal: ' }),
        el('span', { text: lesson.objective }),
      ),
      el(
        'div',
        { className: 'qv-course-action-strip' },
        el(
          'button',
          {
            className: 'bv-btn bv-btn-primary',
            attrs: { type: 'button' },
            on: {
              click: () => {
                const modIdx = COURSE_MODULES.findIndex((m) => m.id === mod.id);
                navigateToCourseLesson(actions, lesson);
                openInteractiveCourseDrawer(actions, Math.max(0, modIdx));
              },
            },
          },
          icon('course', 14),
          `${lesson.actionLabel} (Try Live)`,
        ),
        el(
          'button',
          {
            className: `bv-btn${isDone ? ' is-done' : ''}`,
            attrs: { type: 'button' },
            on: {
              click: () => {
                toggleCourseLessonDone(lesson.id, !isDone);
                renderCoursePageView(container, actions);
              },
            },
          },
          icon('check', 14),
          isDone ? 'Lesson Completed ✓' : 'Mark Lesson Complete',
        ),
      ),
      conceptsBox,
      stepsBox,
      exampleBox,
      checkpointBox,
      el(
        'div',
        { className: 'qv-course-pager' },
        prevRef
          ? el('button', {
              className: 'bv-btn',
              text: `<- Previous: ${prevRef.lesson.title}`,
              attrs: { type: 'button' },
              on: {
                click: () => {
                  selectedModuleId = prevRef.module.id;
                  selectedLessonId = prevRef.lesson.id;
                  renderCoursePageView(container, actions);
                },
              },
            })
          : el('span'),
        nextRef
          ? el('button', {
              className: 'bv-btn bv-btn-primary',
              text: `Next: ${nextRef.lesson.title} ->`,
              attrs: { type: 'button' },
              on: {
                click: () => {
                  if (!isDone) {
                    toggleCourseLessonDone(lesson.id, true);
                  }
                  selectedModuleId = nextRef.module.id;
                  selectedLessonId = nextRef.lesson.id;
                  renderCoursePageView(container, actions);
                },
              },
            })
          : el('button', {
              className: 'bv-btn bv-btn-primary',
              text: 'Finish & Return to Manuscript',
              attrs: { type: 'button' },
              on: {
                click: () => {
                  toggleCourseLessonDone(lesson.id, true);
                  actions.setState({ activeView: 'editor' }, true);
                  actions.notify('Completed the full Quillvibe Book Writing Course.');
                },
              },
            }),
      ),
    ),
  );

  container.appendChild(
    el('div', { className: 'qv-course-page' }, sidebar, mainPane),
  );
}
