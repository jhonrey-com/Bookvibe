import './styles/main.css';

import type { AppActions, AppState, ExtensionsModalTab } from './core/app-context';
import {
  closeDesktopWindow,
  exportBookAsEpub,
  exportBookAsHtml,
  exportBookAsMarkdown,
  exportBookAsPlainText,
  exportCoverPngDownload,
  getStartupOpenedFile,
  isDesktopWindowMaximized,
  isTauriRuntime,
  loadDefaultExportFormat,
  loadPersistedLibrary,
  loadPersistedProject,
  minimizeDesktopWindow,
  openBookvibeFile,
  persistLibrary,
  persistProject,
  saveBookvibeExtensionFile,
  saveDefaultExportFormat,
  startDesktopWindowDrag,
  toggleMaximizeDesktopWindow,
} from './core/bridge';
import { renderCoverToPngDataUrl, renderFullWrapToPngDataUrl } from './core/cover';
import { EXPORT_FORMAT_OPTIONS } from './core/export';
import {
  applyOpenedExtensionFile,
  extractExtensionFromFilename,
  parseExtensionFile,
  safeJsonParse,
  serializeExtensionFile,
} from './core/extensions';
import { loadCustomFonts } from './core/fonts';
import {
  createInitialLibrary,
  getActiveBookFromLibrary,
  normalizeProjectDefaults,
  switchActiveBook,
  upsertBookInLibrary,
} from './core/library';
import {
  countCharacters,
  countWords,
  estimateReadingMinutes,
  estimateStandardPages,
  findSceneContext,
  getAllScenes,
  getChapterWordCount,
  getProjectWordCount,
  updateSceneInProject,
} from './core/manuscript';
import { importAnyExternalDocumentFile } from './core/migrate';
import { realignMarksAfterEdit } from './core/proofread';
import { createStarterBookProject } from './core/sample-book';
import { applySettingsToDocument, loadSettings, saveSettings } from './core/settings';
import { createSnapshotForScene } from './core/snapshots';
import type {
  BookLibraryState,
  BookProject,
  BookvibeExtension,
  BookvibeSettings,
  ExportFormatId,
  StudioViewId,
} from './core/types';
import { bookvibeLogo, clearNode, el, icon, svgEl } from './ui/dom';
import { LiquidGlassControl, mountGlobalControlGlass } from './ui/liquid-glass';
import {
  destroyActiveTour,
  maybeRunFirstLaunchSplash,
  maybeStartSectionTour,
  replayFullWalkthrough,
} from './ui/onboarding';
import { TOOLTIP_CATALOG } from './ui/tooltips-catalog';
import { renderBibleView } from './views/bible';
import { renderBinder } from './views/binder';
import { showCollabModal } from './views/collab-modal';
import { renderCorkboardView } from './views/corkboard';
import { renderEditorView } from './views/editor';
import { showExtensionsModal } from './views/extensions-modal';
import { renderGraphView } from './views/graph';
import { showHelpModal } from './views/help-modal';
import { renderInspector } from './views/inspector';
import { showLibraryModal } from './views/library-modal';
import { renderOutlineView } from './views/outline';
import { showSettingsModal } from './views/settings-modal';
import { renderTypesetView } from './views/typeset';

const starter = createStarterBookProject();
const initialLibrary = createInitialLibrary(starter);

const isWideDesktop = typeof window === 'undefined' || window.innerWidth > 1180;
const isMediumOrLarger = typeof window === 'undefined' || window.innerWidth > 960;

const state: AppState = {
  library: initialLibrary,
  project: starter,
  settings: loadSettings(),
  activeView: 'editor',
  activeSceneId: getAllScenes(starter)[0]?.scene.id ?? '',
  defaultExportFormat: typeof window !== 'undefined' ? loadDefaultExportFormat() : '.bookvibe',
  editorSubMode: 'draft',
  splitTargetKind: 'character',
  splitTargetId: starter.bible.characters[0]?.id ?? '',
  diffSnapshotId: '',
  typewriterMode: false,
  zenMode: false,
  showBinder: isMediumOrLarger,
  showInspector: isWideDesktop,
  proofreadPreviewClean: false,
  activeProofreadMarkId: '',
  bibleCategory: 'characters',
  activeBibleId: starter.bible.characters[0]?.id ?? '',
  activeGraphNodeId: starter.storyGraph?.nodes[0]?.id ?? '',
  typesetSubTab: 'interior',
  sprintRunning: false,
  sprintDurationMin: 25,
  sprintRemainingSec: 25 * 60,
  sprintStartWords: getProjectWordCount(starter),
  saveStatusLabel: 'Saved',
};

let persistTimer: number | null = null;
let sprintInterval: number | null = null;
let toastTimer: number | null = null;

let headerNavGlass: LiquidGlassControl<StudioViewId> | null = null;
let shellEl: HTMLDivElement;
let binderEl: HTMLElement;
let mainStageEl: HTMLElement;
let inspectorEl: HTMLElement;
let workspaceGridEl: HTMLElement;
let drawerBackdropEl: HTMLDivElement;
let binderToggleBtn: HTMLButtonElement;
let inspectorToggleBtn: HTMLButtonElement;
let exportFormatSelectEl: HTMLSelectElement;
let bookTitleInputEl: HTMLInputElement;
let saveStatusEl: HTMLSpanElement;
let wordStatsEl: HTMLSpanElement;
let sprintStatusEl: HTMLSpanElement;
let sprintToggleBtnEl: HTMLButtonElement;

function schedulePersist(): void {
  state.library = upsertBookInLibrary(state.library, state.project);
  state.saveStatusLabel = 'Saving…';
  if (saveStatusEl) saveStatusEl.textContent = state.saveStatusLabel;
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(async () => {
    const serializedBook = serializeExtensionFile('.bookvibe', state.project);
    const serializedLib = JSON.stringify(state.library);
    await Promise.all([persistProject(serializedBook), persistLibrary(serializedLib)]);
    state.saveStatusLabel = 'Saved';
    if (saveStatusEl) saveStatusEl.textContent = state.saveStatusLabel;
  }, state.settings.autoSaveDelayMs || 320);
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateSprintDisplay(): void {
  if (!sprintStatusEl || !sprintToggleBtnEl) return;
  const currentTotal = getProjectWordCount(state.project);
  const delta = currentTotal - state.sprintStartWords;
  const deltaText = delta >= 0 ? `+${delta}w` : `${delta}w`;
  sprintStatusEl.textContent = `Sprint ${formatClock(state.sprintRemainingSec)} · ${deltaText}`;
  sprintToggleBtnEl.textContent = state.sprintRunning ? 'Pause' : 'Start';
}

function updateWordCountersOnly(): void {
  const totalWords = getProjectWordCount(state.project);
  const ctx = findSceneContext(state.project, state.activeSceneId);
  const sceneWords = ctx ? countWords(ctx.scene.content) : 0;
  const sceneChars = ctx ? countCharacters(ctx.scene.content) : 0;
  const chapWords = ctx ? getChapterWordCount(ctx.chapter) : 0;
  const pages = estimateStandardPages(totalWords);
  const mins = estimateReadingMinutes(totalWords);

  if (wordStatsEl) {
    wordStatsEl.textContent = `Scene ${sceneWords}w (${sceneChars}c) · Ch ${chapWords}w · Book ${totalWords.toLocaleString()} / ${state.project.wordTarget.toLocaleString()}w · ~${pages}p (${mins}m)`;
  }

  if (ctx) {
    const binderCount = document.querySelector(`[data-binder-scene="${ctx.scene.id}"]`);
    if (binderCount) binderCount.textContent = String(sceneWords);
    const binderTitle = document.querySelector(`[data-binder-title="${ctx.scene.id}"]`);
    if (binderTitle) binderTitle.textContent = ctx.scene.title || 'Untitled Scene';
    const chapCount = document.querySelector(`[data-binder-chap="${ctx.chapter.id}"]`);
    if (chapCount) chapCount.textContent = String(chapWords);
  }

  updateSprintDisplay();
}

function syncResponsiveDrawerClasses(): void {
  const isNarrowDrawerMode = window.innerWidth <= 1180;
  const inspectorActive = state.showInspector;
  workspaceGridEl.classList.toggle('hide-binder', !state.showBinder);
  workspaceGridEl.classList.toggle('hide-inspector', !inspectorActive);
  binderToggleBtn?.classList.toggle('is-active', state.showBinder);
  inspectorToggleBtn?.classList.toggle('is-active', inspectorActive);

  const hasOverlayOpen =
    (isNarrowDrawerMode && inspectorActive) ||
    (window.innerWidth <= 960 && state.showBinder);
  drawerBackdropEl?.classList.toggle('is-visible', hasOverlayOpen);
}

function renderActiveView(): void {
  shellEl.classList.toggle('is-zen', state.zenMode);
  syncResponsiveDrawerClasses();
  if (bookTitleInputEl && bookTitleInputEl.value !== state.project.title) {
    bookTitleInputEl.value = state.project.title;
  }
  if (exportFormatSelectEl && exportFormatSelectEl.value !== state.defaultExportFormat) {
    exportFormatSelectEl.value = state.defaultExportFormat;
  }
  headerNavGlass?.setValue(state.activeView);

  renderBinder(binderEl, actions);
  renderInspector(inspectorEl, actions);

  if (state.activeView === 'editor') {
    renderEditorView(mainStageEl, actions);
  } else if (state.activeView === 'corkboard') {
    renderCorkboardView(mainStageEl, actions);
  } else if (state.activeView === 'outline') {
    renderOutlineView(mainStageEl, actions);
  } else if (state.activeView === 'bible') {
    renderBibleView(mainStageEl, actions);
  } else if (state.activeView === 'graph') {
    renderGraphView(mainStageEl, actions);
  } else if (state.activeView === 'typeset') {
    renderTypesetView(mainStageEl, actions);
  }

  updateWordCountersOnly();
}

function handleOpenedContent(rawJson: string, filename: string): void {
  if (filename.toLowerCase().endsWith('.bvext')) {
    void showExtensionsModal(actions, {
      initialTab: 'external',
      pendingExternalRawJson: rawJson,
    });
    return;
  }

  try {
    const parsed = parseExtensionFile(rawJson, filename);
    const applied = applyOpenedExtensionFile(parsed, state.project);
    state.project = applied.project;
    state.library = upsertBookInLibrary(state.library, state.project);
    state.activeView = applied.focusView;
    if (applied.focusSceneId) {
      state.activeSceneId = applied.focusSceneId;
    } else if (!findSceneContext(state.project, state.activeSceneId)) {
      state.activeSceneId = getAllScenes(state.project)[0]?.scene.id ?? '';
    }
    schedulePersist();
    renderActiveView();
    actions.notify(applied.summaryMessage);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to open Bookvibe file.';
    actions.notify(`Open failed: ${message}`);
  }
}

const actions: AppActions = {
  getState: () => state,

  setState(patch, rerender = true) {
    const prevView = state.activeView;
    Object.assign(state, patch);
    if (patch.activeView && patch.activeView !== prevView) {
      destroyActiveTour();
    }
    if (rerender) {
      renderActiveView();
    } else {
      syncResponsiveDrawerClasses();
      if (patch.showInspector && inspectorEl && inspectorEl.childElementCount === 0) {
        renderInspector(inspectorEl, actions);
      }
    }
    if (patch.activeView && patch.activeView !== prevView) {
      requestAnimationFrame(() => maybeStartSectionTour(state.activeView, actions));
    }
  },

  updateSettings(patch: Partial<BookvibeSettings>) {
    state.settings = saveSettings({ ...state.settings, ...patch });
    applySettingsToDocument(state.settings);
  },

  mutateProject(updater: (prev: BookProject) => BookProject, rerender = true) {
    state.project = normalizeProjectDefaults(updater(state.project));
    schedulePersist();
    if (rerender) renderActiveView();
    else updateWordCountersOnly();
  },

  updateActiveSceneTextQuietly(field, value) {
    if (field === 'content') {
      const ctx = findSceneContext(state.project, state.activeSceneId);
      const prevMarks = ctx?.scene.proofreadMarks;
      const prevContent = ctx?.scene.content ?? '';
      const aligned = realignMarksAfterEdit(prevMarks, prevContent, value);
      state.project = updateSceneInProject(state.project, state.activeSceneId, {
        content: value,
        proofreadMarks: aligned,
      });
    } else {
      state.project = updateSceneInProject(state.project, state.activeSceneId, { title: value });
    }
    schedulePersist();
    updateWordCountersOnly();
  },

  selectScene(sceneId, switchToEditor = true) {
    state.activeSceneId = sceneId;
    if (switchToEditor) {
      state.activeView = 'editor';
    }
    if (window.innerWidth <= 960) {
      state.showBinder = false;
    }
    renderActiveView();
  },

  openBibleEntry(category, entryId) {
    state.activeView = 'bible';
    state.bibleCategory = category;
    state.activeBibleId = entryId;
    renderActiveView();
  },

  openExtensionsModal(initialTab?: ExtensionsModalTab) {
    void showExtensionsModal(actions, { initialTab });
  },

  openLibraryModal() {
    showLibraryModal(actions);
  },

  openCollabModal() {
    showCollabModal(actions);
  },

  openSettingsModal(initialTab = 'fonts') {
    showSettingsModal(actions, initialTab);
  },

  openHelpModal(initialTab = 'tour') {
    showHelpModal(actions, initialTab);
  },

  replayWalkthrough() {
    replayFullWalkthrough(actions);
  },

  async importExternalDocument() {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.docx,.html,.htm,.rtf,.md,.markdown,.txt';
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        const imported = await importAnyExternalDocumentFile(file);
        actions.replaceLibrary({
          activeBookId: imported.id,
          books: [...state.library.books, imported],
        });
        actions.notify(`Imported “${imported.title}”`);
      } catch (err) {
        actions.notify(err instanceof Error ? err.message : 'Unable to import external manuscript.');
      }
    };
    picker.click();
  },

  switchBook(bookId: string) {
    const updatedLib = switchActiveBook(
      upsertBookInLibrary(state.library, state.project),
      bookId,
    );
    state.library = updatedLib;
    state.project = getActiveBookFromLibrary(updatedLib);
    state.activeSceneId = getAllScenes(state.project)[0]?.scene.id ?? '';
    state.activeBibleId = state.project.bible.characters[0]?.id ?? '';
    state.activeGraphNodeId = state.project.storyGraph?.nodes[0]?.id ?? '';
    state.sprintStartWords = getProjectWordCount(state.project);
    schedulePersist();
    renderActiveView();
    actions.notify(`Switched to “${state.project.title}”`);
  },

  replaceLibrary(library: BookLibraryState) {
    state.library = library;
    state.project = getActiveBookFromLibrary(library);
    state.activeSceneId = getAllScenes(state.project)[0]?.scene.id ?? '';
    state.activeBibleId = state.project.bible.characters[0]?.id ?? '';
    state.activeGraphNodeId = state.project.storyGraph?.nodes[0]?.id ?? '';
    state.sprintStartWords = getProjectWordCount(state.project);
    schedulePersist();
    renderActiveView();
  },

  setDefaultExportFormat(fmt: ExportFormatId) {
    state.defaultExportFormat = fmt;
    saveDefaultExportFormat(fmt);
    if (exportFormatSelectEl) exportFormatSelectEl.value = fmt;
    actions.notify(`Default export format set to ${fmt}`);
  },

  async exportDefaultFormat() {
    const fmt = state.defaultExportFormat;
    if (fmt === '.epub') return actions.exportEpub();
    if (fmt === '.md') return actions.exportMarkdown();
    if (fmt === '.html') return actions.exportHtml();
    if (fmt === '.txt') return actions.exportPlainText();
    return actions.exportAsExtension(fmt);
  },

  async openAnyBookvibeFile() {
    const opened = await openBookvibeFile();
    if (!opened) return;
    handleOpenedContent(opened.content, opened.filename);
  },

  async exportAsExtension(ext: BookvibeExtension, options?: { sceneId?: string }) {
    try {
      const payload = serializeExtensionFile(ext, state.project, {
        sceneId: options?.sceneId ?? state.activeSceneId,
      });
      const saved = await saveBookvibeExtensionFile(ext, payload, state.project.title);
      if (saved) {
        actions.notify(`Saved ${ext} file`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      actions.notify(msg);
    }
  },

  async exportEpub() {
    try {
      const coverPng = await renderCoverToPngDataUrl(state.project, 1200, 1920);
      const out = await exportBookAsEpub(state.project, coverPng);
      if (out) actions.notify('Exported EPUB 3 eBook with Cover & Credits');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'EPUB export failed.';
      actions.notify(msg);
    }
  },

  async exportMarkdown() {
    try {
      const out = await exportBookAsMarkdown(state.project);
      if (out) actions.notify('Exported Markdown manuscript');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Markdown export failed.';
      actions.notify(msg);
    }
  },

  async exportHtml() {
    try {
      const out = await exportBookAsHtml(state.project);
      if (out) actions.notify('Exported HTML web book');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'HTML export failed.';
      actions.notify(msg);
    }
  },

  async exportPlainText() {
    try {
      const out = await exportBookAsPlainText(state.project);
      if (out) actions.notify('Exported plain text manuscript');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Plain text export failed.';
      actions.notify(msg);
    }
  },

  async exportCoverPng() {
    try {
      const coverPng = await renderCoverToPngDataUrl(state.project, 1200, 1920);
      if (!coverPng) throw new Error('Unable to render cover PNG.');
      exportCoverPngDownload(coverPng, state.project.title);
      actions.notify('Exported Cover PNG (1200×1920)');
    } catch (err) {
      actions.notify(err instanceof Error ? err.message : 'Cover export failed.');
    }
  },

  async exportFullWrapPng() {
    try {
      const wrapPng = await renderFullWrapToPngDataUrl(state.project, 960, 1500);
      if (!wrapPng) throw new Error('Unable to render full cover wrap PNG.');
      exportCoverPngDownload(wrapPng, `${state.project.title}-full-wrap`);
      actions.notify('Exported Full Cover Wrap PNG (Back · Spine · Front)');
    } catch (err) {
      actions.notify(err instanceof Error ? err.message : 'Full wrap export failed.');
    }
  },

  printTypeset() {
    if (state.activeView !== 'typeset' || state.typesetSubTab !== 'interior') {
      state.activeView = 'typeset';
      state.typesetSubTab = 'interior';
      renderActiveView();
    }
    requestAnimationFrame(() => window.print());
  },

  createSnapshot(label?: string) {
    const res = createSnapshotForScene(state.project, state.activeSceneId, label);
    if (!res.snapshot) return;
    state.project = res.project;
    state.diffSnapshotId = res.snapshot.id;
    schedulePersist();
    renderActiveView();
    actions.notify(`Snapshot saved (${res.snapshot.wordCount}w)`);
  },

  notify(message: string) {
    const prev = document.getElementById('bv-toast');
    if (prev) prev.remove();
    if (toastTimer !== null) window.clearTimeout(toastTimer);

    const toast = el('div', {
      className: 'bv-toast',
      id: 'bv-toast',
      text: message,
      attrs: { role: 'status', 'aria-live': 'polite' },
    });
    document.body.appendChild(toast);
    toastTimer = window.setTimeout(() => toast.remove(), 3400);
  },

  refreshWordCounters: updateWordCountersOnly,
};

function buildShell(root: HTMLElement): void {
  clearNode(root);

  bookTitleInputEl = el('input', {
    className: 'bv-book-title-input',
    tooltip: TOOLTIP_CATALOG.bookTitle,
    attrs: { type: 'text', value: state.project.title, 'aria-label': 'Book title' },
    on: {
      change: () => {
        const nextTitle = bookTitleInputEl.value.trim() || 'Untitled Book';
        bookTitleInputEl.value = nextTitle;
        actions.mutateProject((p) => ({ ...p, title: nextTitle }), false);
      },
    },
  });

  saveStatusEl = el('span', {
    className: 'bv-save-indicator',
    text: state.saveStatusLabel,
    tooltip: TOOLTIP_CATALOG.saveStatus,
  });

  binderToggleBtn = el(
    'button',
    {
      className: `bv-btn bv-btn-icon${state.showBinder ? ' is-active' : ''}`,
      tooltip: TOOLTIP_CATALOG.toggleBinder,
      attrs: { type: 'button', 'aria-label': 'Toggle Manuscript Binder' },
      on: {
        click: () => actions.setState({ showBinder: !state.showBinder }, false),
      },
    },
    icon('panel-left', 15),
  );

  headerNavGlass = new LiquidGlassControl<StudioViewId>({
    ariaLabel: 'Studio workspace',
    surface: 'solid',
    iconOnly: true,
    value: state.activeView,
    options: [
      { id: 'editor', label: 'Manuscript', icon: 'quill', tooltip: TOOLTIP_CATALOG.navEditor },
      { id: 'corkboard', label: 'Corkboard', icon: 'corkboard', tooltip: TOOLTIP_CATALOG.navCorkboard },
      { id: 'outline', label: 'Outline', icon: 'outline', tooltip: TOOLTIP_CATALOG.navOutline },
      { id: 'bible', label: 'Story Bible', icon: 'bible', tooltip: TOOLTIP_CATALOG.navBible },
      { id: 'graph', label: 'Graph', icon: 'graph', tooltip: TOOLTIP_CATALOG.navGraph },
      { id: 'typeset', label: 'Typeset', icon: 'typeset', tooltip: TOOLTIP_CATALOG.navTypeset },
    ],
    onChange: (view) => {
      actions.setState({ activeView: view }, true);
    },
  });

  exportFormatSelectEl = el(
    'select',
    {
      className: 'bv-export-format-select',
      tooltip: TOOLTIP_CATALOG.defaultFormatSelect,
      attrs: { 'aria-label': 'Default export file extension' },
      on: {
        change: () => {
          actions.setDefaultExportFormat(exportFormatSelectEl.value as ExportFormatId);
        },
      },
    },
    ...EXPORT_FORMAT_OPTIONS.map((opt) =>
      el('option', {
        text: opt.shortLabel,
        attrs: { value: opt.id, selected: state.defaultExportFormat === opt.id },
      }),
    ),
  );

  inspectorToggleBtn = el(
    'button',
    {
      className: `bv-btn bv-btn-icon${state.showInspector ? ' is-active' : ''}`,
      tooltip: TOOLTIP_CATALOG.toggleInspector,
      attrs: { type: 'button', 'aria-label': 'Toggle Scene Inspector' },
      on: {
        click: () => actions.setState({ showInspector: !state.showInspector }, false),
      },
    },
    icon('panel-right', 15),
  );

  const winControlsEl = isTauriRuntime()
    ? el(
        'div',
        { className: 'bv-win-controls' },
        el(
          'button',
          {
            className: 'bv-win-btn',
            tooltip: { title: 'Minimize Window', short: 'Minimize Bookvibe to the taskbar or dock.' },
            attrs: { type: 'button', 'aria-label': 'Minimize window' },
            on: { click: () => void minimizeDesktopWindow() },
          },
          (() => {
            const s = svgEl('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none' });
            s.appendChild(svgEl('line', { x1: 2, y1: 6.5, x2: 10, y2: 6.5, stroke: 'currentColor', 'stroke-width': 1.4 }));
            return s;
          })(),
        ),
        el(
          'button',
          {
            className: 'bv-win-btn',
            tooltip: { title: 'Maximize / Restore', short: 'Toggle full window size or restore bounds.' },
            attrs: { type: 'button', 'aria-label': 'Maximize or restore window' },
            on: { click: () => void toggleMaximizeDesktopWindow() },
          },
          (() => {
            const s = svgEl('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none' });
            s.appendChild(svgEl('rect', { x: 2.25, y: 2.25, width: 7.5, height: 7.5, rx: 1, stroke: 'currentColor', 'stroke-width': 1.3 }));
            return s;
          })(),
        ),
        el(
          'button',
          {
            className: 'bv-win-btn bv-win-btn-close',
            tooltip: { title: 'Close Window', short: 'Exit Bookvibe desktop window.' },
            attrs: { type: 'button', 'aria-label': 'Close window' },
            on: { click: () => void closeDesktopWindow() },
          },
          (() => {
            const s = svgEl('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none' });
            s.append(
              svgEl('path', { d: 'M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
            );
            return s;
          })(),
        ),
      )
    : null;

  const topbar = el(
    'header',
    {
      className: 'bv-topbar',
      attrs: { 'data-tauri-drag-region': '' },
      on: {
        mousedown: (e) => {
          if (!isTauriRuntime() || e.button !== 0) return;
          const t = e.target as HTMLElement | null;
          if (!t || t.closest('button, input, select, .lg-host, a')) return;
          void startDesktopWindowDrag();
        },
        dblclick: (e) => {
          if (!isTauriRuntime()) return;
          const t = e.target as HTMLElement | null;
          if (!t || t.closest('button, input, select, .lg-host, a')) return;
          void isDesktopWindowMaximized().then(() => toggleMaximizeDesktopWindow());
        },
      },
    },
    el(
      'div',
      { className: 'bv-brand' },
      el('div', { className: 'bv-logo-mark', attrs: { 'data-tauri-drag-region': '' } }, bookvibeLogo(28)),
      binderToggleBtn,
      el('div', { className: 'bv-book-meta' }, bookTitleInputEl, saveStatusEl),
    ),
    el('div', { className: 'bv-topbar-center' }, headerNavGlass.element),
    el(
      'div',
      { className: 'bv-topbar-actions' },
      el(
        'button',
        {
          className: 'bv-btn bv-btn-icon',
          tooltip: TOOLTIP_CATALOG.library,
          attrs: { type: 'button', 'aria-label': 'Book Library and Author Key' },
          on: { click: () => actions.openLibraryModal() },
        },
        icon('library', 15),
      ),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-icon',
          tooltip: TOOLTIP_CATALOG.collaborate,
          attrs: { type: 'button', 'aria-label': 'Collaborate Offline' },
          on: { click: () => actions.openCollabModal() },
        },
        icon('collab', 15),
      ),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-icon',
          tooltip: TOOLTIP_CATALOG.openFile,
          attrs: { type: 'button', 'aria-label': 'Open Bookvibe File' },
          on: { click: () => void actions.openAnyBookvibeFile() },
        },
        icon('folder', 15),
      ),
      el(
        'div',
        { className: 'bv-save-split' },
        el(
          'button',
          {
            className: 'bv-btn bv-btn-icon bv-save-split-btn',
            tooltip: TOOLTIP_CATALOG.saveDefault,
            attrs: { type: 'button', 'aria-label': 'Save or Export Default Format' },
            on: { click: () => void actions.exportDefaultFormat() },
          },
          icon('save', 15),
        ),
        exportFormatSelectEl,
      ),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-icon',
          tooltip: TOOLTIP_CATALOG.extensionsManager,
          attrs: { type: 'button', 'aria-label': 'Extensions and Formats' },
          on: { click: () => actions.openExtensionsModal() },
        },
        icon('extensions', 15),
      ),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-icon',
          tooltip: TOOLTIP_CATALOG.settingsBtn,
          attrs: { type: 'button', 'aria-label': 'Settings and Custom Fonts' },
          on: { click: () => actions.openSettingsModal('fonts') },
        },
        icon('settings', 15),
      ),
      el(
        'button',
        {
          className: 'bv-btn bv-btn-icon',
          tooltip: TOOLTIP_CATALOG.helpBtn,
          attrs: { type: 'button', 'aria-label': 'Help and Guided Walkthrough' },
          on: { click: () => actions.openHelpModal('tour') },
        },
        icon('help', 15),
      ),
      inspectorToggleBtn,
      winControlsEl,
    ),
  );

  binderEl = el('aside', { className: 'bv-binder', attrs: { 'aria-label': 'Manuscript Binder' } });
  mainStageEl = el('main', { className: 'bv-main-stage' });
  inspectorEl = el('aside', { className: 'bv-inspector', attrs: { 'aria-label': 'Scene Inspector' } });

  drawerBackdropEl = el('div', {
    className: 'bv-drawer-backdrop',
    on: {
      click: () => {
        const patch: Partial<AppState> = {};
        if (window.innerWidth <= 960) patch.showBinder = false;
        if (window.innerWidth <= 1180) patch.showInspector = false;
        actions.setState(patch, false);
      },
    },
  });

  workspaceGridEl = el(
    'div',
    { className: 'bv-workspace-grid' },
    binderEl,
    mainStageEl,
    inspectorEl,
    drawerBackdropEl,
  );

  wordStatsEl = el('span', { className: 'bv-status-words', text: '' });
  sprintStatusEl = el('span', { text: '' });

  const sprintDurationSelect = el(
    'select',
    {
      className: 'bv-select',
      style: { height: '22px', fontSize: '11px' },
      tooltip: {
        title: 'Sprint Duration (15m / 25m / 45m)',
        short: 'Select focus session length in minutes before clicking Start.',
      },
      attrs: { 'aria-label': 'Sprint duration' },
      on: {
        change: () => {
          const mins = Number(sprintDurationSelect.value) || 25;
          state.sprintRunning = false;
          if (sprintInterval !== null) {
            clearInterval(sprintInterval);
            sprintInterval = null;
          }
          state.sprintDurationMin = mins;
          state.sprintRemainingSec = mins * 60;
          state.sprintStartWords = getProjectWordCount(state.project);
          updateSprintDisplay();
        },
      },
    },
    el('option', { text: '15m', attrs: { value: '15', selected: state.sprintDurationMin === 15 } }),
    el('option', { text: '25m', attrs: { value: '25', selected: state.sprintDurationMin === 25 } }),
    el('option', { text: '45m', attrs: { value: '45', selected: state.sprintDurationMin === 45 } }),
  );

  sprintToggleBtnEl = el('button', {
    className: 'bv-mini-btn',
    text: 'Start',
    tooltip: {
      title: 'Start / Pause Writing Sprint',
      short: 'Begin or pause the countdown timer and track net words drafted (+0w).',
    },
    attrs: { type: 'button' },
    on: {
      click: () => {
        if (state.sprintRunning) {
          state.sprintRunning = false;
          if (sprintInterval !== null) {
            clearInterval(sprintInterval);
            sprintInterval = null;
          }
        } else {
          if (state.sprintRemainingSec <= 0) {
            state.sprintRemainingSec = state.sprintDurationMin * 60;
            state.sprintStartWords = getProjectWordCount(state.project);
          }
          if (state.sprintRemainingSec === state.sprintDurationMin * 60) {
            state.sprintStartWords = getProjectWordCount(state.project);
          }
          state.sprintRunning = true;
          sprintInterval = window.setInterval(() => {
            if (state.sprintRemainingSec > 0) {
              state.sprintRemainingSec -= 1;
              updateSprintDisplay();
            }
            if (state.sprintRemainingSec <= 0) {
              state.sprintRunning = false;
              if (sprintInterval !== null) {
                clearInterval(sprintInterval);
                sprintInterval = null;
              }
              updateSprintDisplay();
              const gained = getProjectWordCount(state.project) - state.sprintStartWords;
              actions.notify(`Writing sprint complete (${gained >= 0 ? '+' : ''}${gained} words)`);
            }
          }, 1000);
        }
        updateSprintDisplay();
      },
    },
  });

  const sprintResetBtn = el('button', {
    className: 'bv-mini-btn',
    text: 'Reset',
    tooltip: {
      title: 'Reset Sprint Timer',
      short: 'Stops any running countdown, restores chosen duration (15m/25m/45m), and clears +0w delta.',
    },
    attrs: { type: 'button' },
    on: {
      click: () => {
        state.sprintRunning = false;
        if (sprintInterval !== null) {
          clearInterval(sprintInterval);
          sprintInterval = null;
        }
        state.sprintRemainingSec = state.sprintDurationMin * 60;
        state.sprintStartWords = getProjectWordCount(state.project);
        updateSprintDisplay();
      },
    },
  });

  const statusbar = el(
    'footer',
    { className: 'bv-statusbar' },
    el('div', { className: 'bv-status-left' }, wordStatsEl),
    el(
      'div',
      { className: 'bv-status-right' },
      icon('clock', 12),
      sprintStatusEl,
      sprintDurationSelect,
      sprintToggleBtnEl,
      sprintResetBtn,
    ),
  );

  shellEl = el('div', { className: 'bv-shell' }, topbar, workspaceGridEl, statusbar);
  root.appendChild(shellEl);

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 960 && state.showBinder && state.showInspector) {
      state.showInspector = false;
    }
    syncResponsiveDrawerClasses();
  });
}

function wireGlobalShortcutsAndDrop(): void {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (state.activeView === 'editor') {
        actions.createSnapshot();
      } else {
        void actions.exportDefaultFormat();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void actions.openAnyBookvibeFile();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      actions.setState({ zenMode: !state.zenMode }, true);
    } else if (e.key === 'F1') {
      e.preventDefault();
      actions.openHelpModal('tour');
    } else if (e.key === 'Escape') {
      const modals = [
        'bv-extensions-modal',
        'bv-library-modal',
        'bv-collab-modal',
        'bv-help-modal',
        'bv-settings-modal',
      ];
      let closed = false;
      for (const mId of modals) {
        const m = document.getElementById(mId);
        if (m) {
          m.remove();
          closed = true;
        }
      }
      if (!closed) {
        destroyActiveTour();
      }
      if (!closed && state.zenMode) {
        actions.setState({ zenMode: false }, true);
      }
    }
  });

  let dropOverlay: HTMLElement | null = null;
  let dragDepth = 0;

  const hideDrop = () => {
    dragDepth = 0;
    dropOverlay?.remove();
    dropOverlay = null;
  };

  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    dragDepth++;
    if (!dropOverlay) {
      dropOverlay = el('div', {
        className: 'bv-drop-overlay',
        text: 'Drop .bookvibe, .bvibe, .bvbook, .bvbible, .bvscene, .bvstyle, or .bvext file',
      });
      document.body.appendChild(dropOverlay);
    }
  });

  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
    }
  });

  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) hideDrop();
  });

  window.addEventListener('drop', async (e) => {
    if (e.defaultPrevented) {
      hideDrop();
      return;
    }
    e.preventDefault();
    hideDrop();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isExtPlugin = lower.endsWith('.bvext');
    const isMigrationFile = /\.(docx|html?|rtf|md|markdown|txt)$/i.test(lower);
    if (!isExtPlugin && !extractExtensionFromFilename(file.name)) {
      if (isMigrationFile) {
        try {
          const imported = await importAnyExternalDocumentFile(file);
          actions.replaceLibrary({
            activeBookId: imported.id,
            books: [...state.library.books, imported],
          });
          actions.notify(`Imported “${imported.title}” from ${file.name}`);
        } catch (err) {
          actions.notify(err instanceof Error ? err.message : 'Unable to import document.');
        }
        return;
      }
      actions.notify(
        'Unsupported file. Drop a .bookvibe, .bvibe, .bvbook, .bvbible, .bvscene, .bvstyle, .bvext, .docx, .html, or .md file.',
      );
      return;
    }
    const text = await file.text();
    handleOpenedContent(text, file.name);
  });
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  const savedLibJson = await loadPersistedLibrary();
  if (savedLibJson) {
    try {
      const parsedLib = safeJsonParse<BookLibraryState>(savedLibJson);
      if (Array.isArray(parsedLib.books) && parsedLib.books.length > 0) {
        state.library = {
          activeBookId: parsedLib.activeBookId,
          books: parsedLib.books.map(normalizeProjectDefaults),
        };
        state.project = getActiveBookFromLibrary(state.library);
      }
    } catch {
      // Fallback cleanly to single project load
    }
  } else {
    const saved = await loadPersistedProject();
    if (saved) {
      try {
        const parsed = parseExtensionFile(saved, 'saved.bookvibe');
        const applied = applyOpenedExtensionFile(parsed, state.project);
        state.project = applied.project;
        state.library = upsertBookInLibrary(state.library, state.project);
      } catch {
        // Fallback to starter
      }
    }
  }

  const startupFile = await getStartupOpenedFile();
  if (startupFile) {
    try {
      const parsed = parseExtensionFile(startupFile.content, startupFile.filename);
      const applied = applyOpenedExtensionFile(parsed, state.project);
      state.project = applied.project;
      state.library = upsertBookInLibrary(state.library, state.project);
      state.activeView = applied.focusView;
      if (applied.focusSceneId) state.activeSceneId = applied.focusSceneId;
      state.saveStatusLabel = 'Saved';
    } catch {
      // Continue cleanly if startup file was malformed
    }
  }

  state.sprintStartWords = getProjectWordCount(state.project);
  if (!findSceneContext(state.project, state.activeSceneId)) {
    state.activeSceneId = getAllScenes(state.project)[0]?.scene.id ?? '';
  }

  applySettingsToDocument(state.settings);
  mountGlobalControlGlass();
  loadCustomFonts();
  buildShell(root);
  wireGlobalShortcutsAndDrop();
  renderActiveView();
  maybeRunFirstLaunchSplash(actions);
}

void bootstrap();
