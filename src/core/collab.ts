import { normalizeProjectDefaults } from './library';
import { countWords, findSceneContext, newId } from './manuscript';
import type {
  BookProject,
  Collaborator,
  CollaboratorRole,
  SceneAnnotation,
  SceneNode,
} from './types';

export const COLLABORATOR_ROLE_LABELS: Record<CollaboratorRole, string> = {
  'co-author': 'Co-Author',
  proofreader: 'Proofreader',
  editor: 'Line Editor',
  'beta-reader': 'Beta Reader',
};

const COLLAB_COLORS = ['#c7a97b', '#6b9cd4', '#67b08c', '#c78c9c', '#989ec4'];

export function addCollaborator(
  project: BookProject,
  input: { name: string; penName?: string; role: CollaboratorRole; creditLine?: string; authorKeyId?: string },
): BookProject {
  const next = normalizeProjectDefaults(project);
  const entry: Collaborator = {
    id: newId('collab'),
    name: input.name.trim() || 'Collaborator',
    penName: (input.penName ?? input.name).trim() || 'Collaborator',
    role: input.role,
    creditLine:
      input.creditLine?.trim() ||
      `${COLLABORATOR_ROLE_LABELS[input.role]}: ${(input.penName || input.name).trim()}`,
    authorKeyId: input.authorKeyId?.trim() || '',
    color: COLLAB_COLORS[(next.collaborators?.length ?? 0) % COLLAB_COLORS.length],
    addedAt: new Date().toISOString(),
  };
  next.collaborators = [...(next.collaborators ?? []), entry];
  return next;
}

export function removeCollaborator(project: BookProject, collaboratorId: string): BookProject {
  const next = normalizeProjectDefaults(project);
  next.collaborators = (next.collaborators ?? []).filter((c) => c.id !== collaboratorId);
  return next;
}

export function addSceneAnnotation(
  project: BookProject,
  sceneId: string,
  input: {
    authorName: string;
    role: CollaboratorRole;
    quote: string;
    suggestion: string;
    note: string;
  },
): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;

  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const ann: SceneAnnotation = {
    id: newId('ann'),
    authorName: input.authorName.trim() || 'Proofreader',
    role: input.role,
    quote: input.quote.trim(),
    suggestion: input.suggestion.trim(),
    note: input.note.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  scene.annotations = [ann, ...(scene.annotations ?? [])];
  return next;
}

export function acceptSceneAnnotation(
  project: BookProject,
  sceneId: string,
  annotationId: string,
): { project: BookProject; appliedReplacement: boolean } {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return { project: next, appliedReplacement: false };

  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const ann = (scene.annotations ?? []).find((a) => a.id === annotationId);
  if (!ann) return { project: next, appliedReplacement: false };

  let replaced = false;
  if (ann.quote && ann.suggestion && scene.content.includes(ann.quote)) {
    scene.snapshots.unshift({
      id: newId('snap'),
      createdAt: new Date().toISOString(),
      label: `Before ${ann.authorName} edit`,
      content: scene.content,
      wordCount: countWords(scene.content),
    });
    scene.content = scene.content.replace(ann.quote, ann.suggestion);
    scene.updatedAt = new Date().toISOString();
    replaced = true;
  }

  ann.status = 'accepted';
  return { project: next, appliedReplacement: replaced };
}

export function dismissSceneAnnotation(
  project: BookProject,
  sceneId: string,
  annotationId: string,
): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;
  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const ann = (scene.annotations ?? []).find((a) => a.id === annotationId);
  if (ann) ann.status = 'dismissed';
  return next;
}

export interface MergeSummary {
  project: BookProject;
  updatedScenes: number;
  addedScenes: number;
  conflictSnapshots: number;
  mergedAnnotations: number;
  mergedCollaborators: number;
}

function mergeAnnotations(local: SceneAnnotation[] = [], remote: SceneAnnotation[] = []): {
  merged: SceneAnnotation[];
  addedCount: number;
} {
  const map = new Map<string, SceneAnnotation>();
  for (const a of local) map.set(a.id, a);
  let added = 0;
  for (const r of remote) {
    if (!map.has(r.id)) {
      map.set(r.id, r);
      added++;
    }
  }
  return { merged: Array.from(map.values()), addedCount: added };
}

function mergeById<T extends { id: string }>(local: T[] = [], remote: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

/**
 * Offline desktop-to-desktop revision merge (Wi-Fi LAN / Bluetooth / Nearby Share).
 * Preserves conflicting edits safely as immutable snapshots without overwriting local prose.
 */
export function mergeBookRevisions(
  localRaw: BookProject,
  incomingRaw: BookProject,
  peerLabel = 'Peer Device',
): MergeSummary {
  const local = normalizeProjectDefaults(localRaw);
  const incoming = normalizeProjectDefaults(incomingRaw);

  let updatedScenes = 0;
  let addedScenes = 0;
  let conflictSnapshots = 0;
  let mergedAnnotations = 0;

  const localSceneMap = new Map<string, { partIdx: number; chapIdx: number; sceneIdx: number; scene: SceneNode }>();
  local.parts.forEach((part, pIdx) => {
    part.chapters.forEach((chap, cIdx) => {
      chap.scenes.forEach((sc, sIdx) => {
        localSceneMap.set(sc.id, { partIdx: pIdx, chapIdx: cIdx, sceneIdx: sIdx, scene: sc });
      });
    });
  });

  for (const incPart of incoming.parts) {
    for (const incChap of incPart.chapters) {
      for (const incScene of incChap.scenes) {
        const match = localSceneMap.get(incScene.id);
        if (!match) {
          // Add missing chapter/scene safely into local manuscript
          let targetPart = local.parts.find((p) => p.id === incPart.id || p.title === incPart.title);
          if (!targetPart) {
            targetPart = {
              id: incPart.id,
              title: incPart.title,
              collapsed: false,
              chapters: [],
            };
            local.parts.push(targetPart);
          }
          let targetChap = targetPart.chapters.find((c) => c.id === incChap.id || c.title === incChap.title);
          if (!targetChap) {
            targetChap = {
              id: incChap.id,
              title: incChap.title,
              subtitle: incChap.subtitle,
              collapsed: false,
              scenes: [],
            };
            targetPart.chapters.push(targetChap);
          }
          targetChap.scenes.push(structuredClone(incScene));
          addedScenes++;
          continue;
        }

        const localScene = local.parts[match.partIdx].chapters[match.chapIdx].scenes[match.sceneIdx];
        const annMerge = mergeAnnotations(localScene.annotations, incScene.annotations);
        localScene.annotations = annMerge.merged;
        mergedAnnotations += annMerge.addedCount;
        localScene.proofreadMarks = mergeById(localScene.proofreadMarks, incScene.proofreadMarks);
        localScene.snapshots = mergeById(localScene.snapshots, incScene.snapshots);

        if (localScene.content !== incScene.content) {
          const localTime = Date.parse(localScene.updatedAt) || 0;
          const incTime = Date.parse(incScene.updatedAt) || 0;

          if (incTime > localTime) {
            // Preserve local content in snapshot before taking newer peer draft
            localScene.snapshots.unshift({
              id: newId('snap'),
              createdAt: new Date().toISOString(),
              label: `Local version before ${peerLabel} sync`,
              content: localScene.content,
              wordCount: countWords(localScene.content),
            });
            localScene.content = incScene.content;
            localScene.title = incScene.title;
            localScene.synopsis = incScene.synopsis;
            localScene.updatedAt = incScene.updatedAt;
            updatedScenes++;
            conflictSnapshots++;
          } else {
            // Keep local prose and record peer variation as conflict snapshot
            localScene.snapshots.unshift({
              id: newId('snap'),
              createdAt: new Date().toISOString(),
              label: `Sync conflict from ${peerLabel}`,
              content: incScene.content,
              wordCount: countWords(incScene.content),
            });
            conflictSnapshots++;
          }
        }
      }
    }
  }

  const prevCollabCount = local.collaborators?.length ?? 0;
  local.collaborators = mergeById(local.collaborators, incoming.collaborators);
  const mergedCollaborators = (local.collaborators?.length ?? 0) - prevCollabCount;

  local.bible = {
    characters: mergeById(local.bible.characters, incoming.bible.characters),
    locations: mergeById(local.bible.locations, incoming.bible.locations),
    lore: mergeById(local.bible.lore, incoming.bible.lore),
    customCategories: mergeById(local.bible.customCategories, incoming.bible.customCategories),
    customEntries: mergeById(local.bible.customEntries, incoming.bible.customEntries),
  };

  if (local.storyGraph && incoming.storyGraph) {
    local.storyGraph = {
      nodes: mergeById(local.storyGraph.nodes, incoming.storyGraph.nodes),
      edges: mergeById(local.storyGraph.edges, incoming.storyGraph.edges),
    };
  }

  return {
    project: local,
    updatedScenes,
    addedScenes,
    conflictSnapshots,
    mergedAnnotations,
    mergedCollaborators,
  };
}
