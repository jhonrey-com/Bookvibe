import type { BookProject, ChapterNode, PartNode, SceneNode, SceneStatus } from './types';

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}-${rand}`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const cleaned = trimmed
    .replace(/^\s*\*\s*\*\s*\*\s*$/gm, ' ')
    .replace(/^#{1,6}\s+/gm, ' ');
  const tokens = cleaned.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return tokens ? tokens.length : 0;
}

export function countCharacters(text: string): number {
  return text.length;
}

export function countParagraphs(text: string): number {
  const blocks = text
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && !/^\*\s*\*\s*\*$/.test(b));
  return blocks.length;
}

export function estimateStandardPages(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.ceil(wordCount / 250));
}

export function estimateReadingMinutes(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(1, Math.ceil(wordCount / 230));
}

export function getChapterWordCount(chapter: ChapterNode): number {
  return chapter.scenes.reduce((acc, s) => acc + countWords(s.content), 0);
}

export function getPartWordCount(part: PartNode): number {
  return part.chapters.reduce((acc, ch) => acc + getChapterWordCount(ch), 0);
}

export function getProjectWordCount(project: BookProject): number {
  return project.parts.reduce((acc, part) => acc + getPartWordCount(part), 0);
}

export function getAllScenes(project: BookProject): Array<{
  part: PartNode;
  chapter: ChapterNode;
  scene: SceneNode;
  sequenceNumber: number;
}> {
  const out: Array<{
    part: PartNode;
    chapter: ChapterNode;
    scene: SceneNode;
    sequenceNumber: number;
  }> = [];
  let seq = 1;
  for (const part of project.parts) {
    for (const chapter of part.chapters) {
      for (const scene of chapter.scenes) {
        out.push({ part, chapter, scene, sequenceNumber: seq++ });
      }
    }
  }
  return out;
}

export interface SceneContext {
  part: PartNode;
  chapter: ChapterNode;
  scene: SceneNode;
  partIndex: number;
  chapterIndex: number;
  sceneIndex: number;
}

export function findSceneContext(project: BookProject, sceneId: string): SceneContext | undefined {
  for (let p = 0; p < project.parts.length; p++) {
    const part = project.parts[p];
    for (let c = 0; c < part.chapters.length; c++) {
      const chapter = part.chapters[c];
      for (let s = 0; s < chapter.scenes.length; s++) {
        const scene = chapter.scenes[s];
        if (scene.id === sceneId) {
          return { part, chapter, scene, partIndex: p, chapterIndex: c, sceneIndex: s };
        }
      }
    }
  }
  return undefined;
}

export function createSceneNode(title = 'Untitled Scene'): SceneNode {
  return {
    id: newId('scene'),
    title,
    synopsis: '',
    status: 'draft',
    pov: '',
    location: '',
    timeline: '',
    wordTarget: 1000,
    content: '',
    notes: '',
    snapshots: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createChapterNode(title = 'Untitled Chapter'): ChapterNode {
  return {
    id: newId('chap'),
    title,
    subtitle: '',
    collapsed: false,
    scenes: [createSceneNode('Opening Scene')],
  };
}

export function createPartNode(title = 'New Part'): PartNode {
  return {
    id: newId('part'),
    title,
    collapsed: false,
    chapters: [createChapterNode('Chapter I')],
  };
}

export function addPartToProject(project: BookProject, title?: string): { project: BookProject; sceneId: string } {
  const next = structuredClone(project);
  const part = createPartNode(title ?? `Part ${next.parts.length + 1}`);
  next.parts.push(part);
  return { project: next, sceneId: part.chapters[0].scenes[0].id };
}

export function addChapterToPart(
  project: BookProject,
  partId: string,
  title?: string,
): { project: BookProject; sceneId: string } {
  const next = structuredClone(project);
  const part = next.parts.find((p) => p.id === partId) ?? next.parts[0];
  if (!part) return addPartToProject(next);
  part.collapsed = false;
  const chap = createChapterNode(title ?? `Chapter ${part.chapters.length + 1}`);
  part.chapters.push(chap);
  return { project: next, sceneId: chap.scenes[0].id };
}

export function addSceneToChapter(
  project: BookProject,
  chapterId: string,
  title?: string,
): { project: BookProject; sceneId: string } {
  const next = structuredClone(project);
  for (const part of next.parts) {
    const chap = part.chapters.find((c) => c.id === chapterId);
    if (chap) {
      part.collapsed = false;
      chap.collapsed = false;
      const scene = createSceneNode(title ?? `Scene ${chap.scenes.length + 1}`);
      chap.scenes.push(scene);
      return { project: next, sceneId: scene.id };
    }
  }
  return addPartToProject(next);
}

export function updateSceneInProject(
  project: BookProject,
  sceneId: string,
  patch: Partial<
    Pick<
      SceneNode,
      | 'title'
      | 'synopsis'
      | 'status'
      | 'pov'
      | 'location'
      | 'timeline'
      | 'wordTarget'
      | 'content'
      | 'notes'
      | 'proofreadMarks'
    >
  >,
): BookProject {
  const next = structuredClone(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;
  const target = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  Object.assign(target, patch, { updatedAt: new Date().toISOString() });
  return next;
}

export function deleteSceneFromProject(
  project: BookProject,
  sceneId: string,
): { project: BookProject; fallbackSceneId?: string } {
  const next = structuredClone(project);
  for (const part of next.parts) {
    for (const chap of part.chapters) {
      const idx = chap.scenes.findIndex((s) => s.id === sceneId);
      if (idx >= 0) {
        chap.scenes.splice(idx, 1);
        const remaining = getAllScenes(next);
        return { project: next, fallbackSceneId: remaining[0]?.scene.id };
      }
    }
  }
  return { project: next, fallbackSceneId: getAllScenes(next)[0]?.scene.id };
}

export function deleteChapterFromProject(
  project: BookProject,
  chapterId: string,
): { project: BookProject; fallbackSceneId?: string } {
  const next = structuredClone(project);
  for (const part of next.parts) {
    const idx = part.chapters.findIndex((c) => c.id === chapterId);
    if (idx >= 0) {
      part.chapters.splice(idx, 1);
      break;
    }
  }
  return { project: next, fallbackSceneId: getAllScenes(next)[0]?.scene.id };
}

export function moveScene(
  project: BookProject,
  sourceSceneId: string,
  targetChapterId: string,
  targetIndex?: number,
): BookProject {
  const next = structuredClone(project);
  const ctx = findSceneContext(next, sourceSceneId);
  if (!ctx) return next;

  const sourceList = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes;
  const [removed] = sourceList.splice(ctx.sceneIndex, 1);

  for (const part of next.parts) {
    const targetChap = part.chapters.find((c) => c.id === targetChapterId);
    if (targetChap) {
      const boundedIdx =
        typeof targetIndex === 'number'
          ? Math.max(0, Math.min(targetIndex, targetChap.scenes.length))
          : targetChap.scenes.length;
      targetChap.scenes.splice(boundedIdx, 0, removed);
      targetChap.collapsed = false;
      part.collapsed = false;
      return next;
    }
  }

  // Restore if target chapter did not exist
  sourceList.splice(ctx.sceneIndex, 0, removed);
  return next;
}

export function splitSceneAtOffset(
  project: BookProject,
  sceneId: string,
  cursorOffset: number,
): { project: BookProject; newSceneId?: string } {
  const next = structuredClone(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return { project: next };

  const current = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const clamped = Math.max(0, Math.min(cursorOffset, current.content.length));
  const head = current.content.slice(0, clamped).trimEnd();
  const tail = current.content.slice(clamped).trimStart();
  if (!tail) return { project: next };

  current.content = head;
  current.updatedAt = new Date().toISOString();

  const secondScene: SceneNode = {
    ...createSceneNode(`${current.title} (Part 2)`),
    pov: current.pov,
    location: current.location,
    status: current.status,
    content: tail,
  };

  next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes.splice(
    ctx.sceneIndex + 1,
    0,
    secondScene,
  );
  return { project: next, newSceneId: secondScene.id };
}

export const SCENE_STATUS_LABELS: Record<SceneStatus, string> = {
  outline: 'Outline',
  draft: 'First Draft',
  revision: 'Revision',
  final: 'Final Polish',
};
