import type {
  BookLibraryState,
  BookProject,
  ExportFormatId,
  QuillvibeExtension,
  QuillvibeSettings,
  StudioViewId,
} from './types';

export type EditorSubMode = 'draft' | 'proofread' | 'split' | 'diff';
export type BibleCategory = 'characters' | 'locations' | 'lore' | string;
export type TypesetSubTab = 'interior' | 'cover' | 'publish';
export type ExtensionsModalTab = 'integrated' | 'external' | 'formats';

export interface AppState {
  library: BookLibraryState;
  project: BookProject;
  settings: QuillvibeSettings;
  activeView: StudioViewId;
  activeSceneId: string;
  defaultExportFormat: ExportFormatId;
  editorSubMode: EditorSubMode;
  splitTargetKind: 'scene' | 'character' | 'location' | 'lore';
  splitTargetId: string;
  diffSnapshotId: string;
  typewriterMode: boolean;
  zenMode: boolean;
  showBinder: boolean;
  showInspector: boolean;
  proofreadPreviewClean: boolean;
  activeProofreadMarkId: string;
  bibleCategory: BibleCategory;
  activeBibleId: string;
  activeGraphNodeId: string;
  typesetSubTab: TypesetSubTab;
  sprintRunning: boolean;
  sprintDurationMin: number;
  sprintRemainingSec: number;
  sprintStartWords: number;
  immersiveMode: boolean;
  openBookTabIds: string[];
  activeTabId: string;
  saveStatusLabel: string;
}

export interface AppActions {
  getState(): AppState;
  setState(patch: Partial<AppState>, rerender?: boolean): void;
  updateSettings(patch: Partial<QuillvibeSettings>): void;
  mutateProject(updater: (prev: BookProject) => BookProject, rerender?: boolean): void;
  updateActiveSceneTextQuietly(field: 'title' | 'content', value: string): void;
  selectScene(sceneId: string, switchToEditor?: boolean): void;
  openBibleEntry(category: BibleCategory, entryId: string): void;
  openExtensionsModal(initialTab?: ExtensionsModalTab): void;
  openLibraryModal(): void;
  openCollabModal(): void;
  openSettingsModal(initialTab?: 'fonts' | 'editor' | 'publishing' | 'developer'): void;
  openHelpModal(initialTab?: 'controls' | 'tour' | 'icons' | 'guides' | 'course' | 'reference'): void;
  openCoursePage(moduleId?: string): void;
  startInteractiveCourse(moduleIdx?: number): void;
  toggleImmersiveMode(force?: boolean): Promise<void>;
  openNewWindow(bookId?: string): Promise<void>;
  openBookInTab(bookId: string): void;
  openEmptyTab(): void;
  closeBookTab(bookId: string): void;
  mergeAllWindowsHere(): void;
  replayWalkthrough(): void;
  importExternalDocument(): Promise<void>;
  importLegacyBookFile(): Promise<void>;
  switchBook(bookId: string): void;
  replaceLibrary(library: BookLibraryState): void;
  setDefaultExportFormat(fmt: ExportFormatId): void;
  exportDefaultFormat(): Promise<void>;
  openAnyQuillvibeFile(): Promise<void>;
  exportAsExtension(
    ext: QuillvibeExtension,
    options?: { sceneId?: string; password?: string },
  ): Promise<void>;
  exportEpub(): Promise<void>;
  exportPdf(): Promise<void>;
  exportMarkdown(): Promise<void>;
  exportHtml(): Promise<void>;
  exportPlainText(): Promise<void>;
  exportCoverPng(): Promise<void>;
  exportFullWrapPng(): Promise<void>;
  printTypeset(): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  createSnapshot(label?: string): void;
  notify(message: string): void;
  refreshWordCounters(): void;
}
