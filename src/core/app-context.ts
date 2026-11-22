import type {
  BookLibraryState,
  BookProject,
  BookvibeExtension,
  StudioViewId,
} from './types';

export type EditorSubMode = 'draft' | 'split' | 'diff';
export type BibleCategory = 'characters' | 'locations' | 'lore' | string;
export type TypesetSubTab = 'interior' | 'cover' | 'publish';

export interface AppState {
  library: BookLibraryState;
  project: BookProject;
  activeView: StudioViewId;
  activeSceneId: string;
  editorSubMode: EditorSubMode;
  splitTargetKind: 'scene' | 'character' | 'location' | 'lore';
  splitTargetId: string;
  diffSnapshotId: string;
  typewriterMode: boolean;
  zenMode: boolean;
  showInspector: boolean;
  bibleCategory: BibleCategory;
  activeBibleId: string;
  activeGraphNodeId: string;
  typesetSubTab: TypesetSubTab;
  sprintRunning: boolean;
  sprintDurationMin: number;
  sprintRemainingSec: number;
  sprintStartWords: number;
  saveStatusLabel: string;
}

export interface AppActions {
  getState(): AppState;
  setState(patch: Partial<AppState>, rerender?: boolean): void;
  mutateProject(updater: (prev: BookProject) => BookProject, rerender?: boolean): void;
  updateActiveSceneTextQuietly(field: 'title' | 'content', value: string): void;
  selectScene(sceneId: string, switchToEditor?: boolean): void;
  openBibleEntry(category: BibleCategory, entryId: string): void;
  openExtensionsModal(): void;
  openLibraryModal(): void;
  openCollabModal(): void;
  switchBook(bookId: string): void;
  replaceLibrary(library: BookLibraryState): void;
  openAnyBookvibeFile(): Promise<void>;
  exportAsExtension(ext: BookvibeExtension, options?: { sceneId?: string }): Promise<void>;
  exportEpub(): Promise<void>;
  exportMarkdown(): Promise<void>;
  exportCoverPng(): Promise<void>;
  printTypeset(): void;
  createSnapshot(label?: string): void;
  notify(message: string): void;
  refreshWordCounters(): void;
}
