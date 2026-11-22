import { stripPrivateAuthorSecrets } from './identity';
import { normalizeProjectDefaults } from './library';
import { countWords, findSceneContext, newId } from './manuscript';
import { getPublisherProvenance } from './provenance';
import type {
  BookProject,
  BookvibeBiblePayload,
  BookvibeEnvelope,
  BookvibeExtension,
  BookvibeManuscriptPayload,
  BookvibeScenePayload,
  BookvibeStylePayload,
  StudioViewId,
} from './types';

export interface ExtensionDefinition {
  extension: BookvibeExtension;
  bareExtension: string;
  name: string;
  shortLabel: string;
  mimeType: string;
  uti: string;
  progId: string;
  purpose: string;
}

export const BOOKVIBE_MAGIC = 'BOOKVIBE_V1' as const;
export const BOOKVIBE_FORMAT_VERSION = '1.0.0' as const;

export const BOOKVIBE_EXTENSIONS: readonly ExtensionDefinition[] = [
  {
    extension: '.bookvibe',
    bareExtension: 'bookvibe',
    name: 'Bookvibe Master Project',
    shortLabel: 'Master Project',
    mimeType: 'application/vnd.bookvibe.project+json',
    uti: 'org.bookvibe.project',
    progId: 'Bookvibe.Project.1',
    purpose: 'Full book project: manuscript, snapshots, story bible, graph, cover, and typography.',
  },
  {
    extension: '.bvibe',
    bareExtension: 'bvibe',
    name: 'Bookvibe Compact Project',
    shortLabel: 'Compact Project',
    mimeType: 'application/vnd.bookvibe.project+json',
    uti: 'org.bookvibe.compact-project',
    progId: 'Bookvibe.CompactProject.1',
    purpose: 'Short-alias project container equivalent to .bookvibe.',
  },
  {
    extension: '.bvbook',
    bareExtension: 'bvbook',
    name: 'Bookvibe Manuscript Package',
    shortLabel: 'Manuscript',
    mimeType: 'application/vnd.bookvibe.manuscript+json',
    uti: 'org.bookvibe.manuscript',
    progId: 'Bookvibe.Manuscript.1',
    purpose: 'Portable manuscript hierarchy (Parts, Chapters, Scenes), credits, and front matter.',
  },
  {
    extension: '.bvbible',
    bareExtension: 'bvbible',
    name: 'Bookvibe Story Bible DB',
    shortLabel: 'Story Bible',
    mimeType: 'application/vnd.bookvibe.bible+json',
    uti: 'org.bookvibe.bible',
    progId: 'Bookvibe.Bible.1',
    purpose: 'Shareable worldbuilding database (Characters, Locations, Lore, Custom Categories).',
  },
  {
    extension: '.bvscene',
    bareExtension: 'bvscene',
    name: 'Bookvibe Standalone Scene',
    shortLabel: 'Scene Draft',
    mimeType: 'application/vnd.bookvibe.scene+json',
    uti: 'org.bookvibe.scene',
    progId: 'Bookvibe.Scene.1',
    purpose: 'Individual scene draft, annotations, and snapshots for isolated drafting or sharing.',
  },
  {
    extension: '.bvstyle',
    bareExtension: 'bvstyle',
    name: 'Bookvibe Typeset Preset',
    shortLabel: 'Typeset Style',
    mimeType: 'application/vnd.bookvibe.style+json',
    uti: 'org.bookvibe.style',
    progId: 'Bookvibe.Style.1',
    purpose: 'Shareable book layout preset (trim size, margins, serif typeface, drop caps).',
  },
] as const;

export function getExtensionDefinition(ext: string): ExtensionDefinition | undefined {
  const normalized = ext.trim().toLowerCase();
  const withDot = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return BOOKVIBE_EXTENSIONS.find((item) => item.extension === withDot);
}

export function extractExtensionFromFilename(filename: string): BookvibeExtension | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  const def = getExtensionDefinition(filename.slice(dot));
  return def ? def.extension : null;
}

/**
 * Strip prototype-pollution keys during JSON parsing.
 */
export function safeJsonParse<T = unknown>(raw: string): T {
  return JSON.parse(raw, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  }) as T;
}

export function serializeExtensionFile(
  extension: BookvibeExtension,
  rawProject: BookProject,
  options?: { sceneId?: string; presetName?: string; seriesName?: string },
): string {
  const def = getExtensionDefinition(extension);
  if (!def) {
    throw new Error(`Unsupported Bookvibe extension: ${extension}`);
  }

  // Always strip local private signing keys before emitting portable export files
  const project = stripPrivateAuthorSecrets(rawProject);
  let payload: unknown;

  switch (extension) {
    case '.bookvibe':
    case '.bvibe': {
      payload = project;
      break;
    }
    case '.bvbook': {
      const manuscriptPayload: BookvibeManuscriptPayload = {
        title: project.title,
        subtitle: project.subtitle,
        author: project.author,
        dedication: project.dedication,
        copyrightNotice: project.copyrightNotice,
        language: project.language,
        wordTarget: project.wordTarget,
        parts: project.parts,
        authorIdentity: project.authorIdentity,
        collaborators: project.collaborators,
        cover: project.cover,
      };
      payload = manuscriptPayload;
      break;
    }
    case '.bvbible': {
      const biblePayload: BookvibeBiblePayload = {
        seriesName: options?.seriesName?.trim() || project.title,
        characters: project.bible.characters,
        locations: project.bible.locations,
        lore: project.bible.lore,
        customCategories: project.bible.customCategories ?? [],
        customEntries: project.bible.customEntries ?? [],
      };
      payload = biblePayload;
      break;
    }
    case '.bvscene': {
      const ctx = options?.sceneId
        ? findSceneContext(project, options.sceneId)
        : undefined;
      const fallbackScene = project.parts[0]?.chapters[0]?.scenes[0];
      const scene = ctx?.scene ?? fallbackScene;
      if (!scene) {
        throw new Error('No scene available to export as .bvscene.');
      }
      const scenePayload: BookvibeScenePayload = {
        bookTitle: project.title,
        chapterTitle: ctx?.chapter.title ?? project.parts[0]?.chapters[0]?.title ?? 'Draft',
        scene,
      };
      payload = scenePayload;
      break;
    }
    case '.bvstyle': {
      const stylePayload: BookvibeStylePayload = {
        presetName:
          options?.presetName?.trim() ||
          `${project.title} (${project.typography.trimSize})`,
        paperTheme: project.paperTheme,
        typography: project.typography,
      };
      payload = stylePayload;
      break;
    }
  }

  const envelope: BookvibeEnvelope = {
    magic: BOOKVIBE_MAGIC,
    formatVersion: BOOKVIBE_FORMAT_VERSION,
    extension,
    mimeType: def.mimeType,
    uti: def.uti,
    exportedAt: new Date().toISOString(),
    provenanceMark: getPublisherProvenance(rawProject.id).mark,
    payload,
  };

  return JSON.stringify(envelope, null, 2);
}

export type ParsedBookvibeFile =
  | { extension: '.bookvibe' | '.bvibe'; payload: BookProject }
  | { extension: '.bvbook'; payload: BookvibeManuscriptPayload }
  | { extension: '.bvbible'; payload: BookvibeBiblePayload }
  | { extension: '.bvscene'; payload: BookvibeScenePayload }
  | { extension: '.bvstyle'; payload: BookvibeStylePayload };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseExtensionFile(rawJson: string, filenameHint?: string): ParsedBookvibeFile {
  let parsed: unknown;
  try {
    parsed = safeJsonParse(rawJson);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid Bookvibe file root object.');
  }

  if (parsed.magic !== BOOKVIBE_MAGIC) {
    if (Array.isArray(parsed.parts) && isRecord(parsed.bible) && typeof parsed.title === 'string') {
      return {
        extension: '.bookvibe',
        payload: normalizeProjectDefaults(parsed as unknown as BookProject),
      };
    }
    throw new Error('Missing BOOKVIBE_V1 format header.');
  }

  const declaredExt =
    typeof parsed.extension === 'string'
      ? getExtensionDefinition(parsed.extension)?.extension
      : undefined;
  const hintExt = filenameHint ? extractExtensionFromFilename(filenameHint) ?? undefined : undefined;
  const extension = declaredExt ?? hintExt;

  if (!extension) {
    throw new Error('Unrecognized Bookvibe file extension header.');
  }
  if (!isRecord(parsed.payload)) {
    throw new Error(`Invalid payload structure for ${extension}.`);
  }

  const payload = parsed.payload;

  switch (extension) {
    case '.bookvibe':
    case '.bvibe': {
      if (!Array.isArray(payload.parts) || !isRecord(payload.bible)) {
        throw new Error('Project payload must include parts and bible arrays.');
      }
      return {
        extension,
        payload: normalizeProjectDefaults(payload as unknown as BookProject),
      };
    }
    case '.bvbook': {
      if (!Array.isArray(payload.parts)) {
        throw new Error('Manuscript payload must include a parts array.');
      }
      return { extension: '.bvbook', payload: payload as unknown as BookvibeManuscriptPayload };
    }
    case '.bvbible': {
      if (
        !Array.isArray(payload.characters) ||
        !Array.isArray(payload.locations) ||
        !Array.isArray(payload.lore)
      ) {
        throw new Error('Story Bible payload requires characters, locations, and lore arrays.');
      }
      return { extension: '.bvbible', payload: payload as unknown as BookvibeBiblePayload };
    }
    case '.bvscene': {
      if (!isRecord(payload.scene) || typeof payload.scene.content !== 'string') {
        throw new Error('Scene payload requires a valid scene object.');
      }
      return { extension: '.bvscene', payload: payload as unknown as BookvibeScenePayload };
    }
    case '.bvstyle': {
      if (!isRecord(payload.typography)) {
        throw new Error('Typeset style payload requires a typography object.');
      }
      return { extension: '.bvstyle', payload: payload as unknown as BookvibeStylePayload };
    }
  }
}

export interface AppliedExtensionResult {
  project: BookProject;
  focusView: StudioViewId;
  focusSceneId?: string;
  summaryMessage: string;
}

function mergeByNameOrId<T extends { id: string; name: string }>(existing: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  const byName = new Map<string, string>();
  for (const item of existing) {
    byId.set(item.id, item);
    byName.set(item.name.trim().toLowerCase(), item.id);
  }
  for (const item of incoming) {
    const existingId = byName.get(item.name.trim().toLowerCase()) ?? item.id;
    byId.set(existingId, { ...item, id: existingId });
  }
  return Array.from(byId.values());
}

export function applyOpenedExtensionFile(
  parsed: ParsedBookvibeFile,
  currentProject: BookProject,
): AppliedExtensionResult {
  switch (parsed.extension) {
    case '.bookvibe':
    case '.bvibe': {
      const next = normalizeProjectDefaults(parsed.payload);
      const firstScene = next.parts[0]?.chapters[0]?.scenes[0]?.id;
      return {
        project: next,
        focusView: 'editor',
        focusSceneId: firstScene,
        summaryMessage: `Opened ${parsed.extension} project “${next.title}”`,
      };
    }

    case '.bvbook': {
      const next: BookProject = normalizeProjectDefaults({
        ...structuredClone(currentProject),
        title: parsed.payload.title || currentProject.title,
        subtitle: parsed.payload.subtitle ?? currentProject.subtitle,
        author: parsed.payload.author || currentProject.author,
        dedication: parsed.payload.dedication ?? currentProject.dedication,
        copyrightNotice: parsed.payload.copyrightNotice ?? currentProject.copyrightNotice,
        language: parsed.payload.language || currentProject.language,
        wordTarget: parsed.payload.wordTarget || currentProject.wordTarget,
        parts: structuredClone(parsed.payload.parts),
        authorIdentity: parsed.payload.authorIdentity ?? currentProject.authorIdentity,
        collaborators: parsed.payload.collaborators ?? currentProject.collaborators,
        cover: parsed.payload.cover ?? currentProject.cover,
      });
      const firstScene = next.parts[0]?.chapters[0]?.scenes[0]?.id;
      return {
        project: next,
        focusView: 'editor',
        focusSceneId: firstScene,
        summaryMessage: `Loaded .bvbook manuscript “${next.title}”`,
      };
    }

    case '.bvbible': {
      const next = normalizeProjectDefaults(currentProject);
      next.bible = {
        characters: mergeByNameOrId(next.bible.characters, parsed.payload.characters),
        locations: mergeByNameOrId(next.bible.locations, parsed.payload.locations),
        lore: mergeByNameOrId(next.bible.lore, parsed.payload.lore),
        customCategories: mergeByNameOrId(
          next.bible.customCategories ?? [],
          parsed.payload.customCategories ?? [],
        ),
        customEntries: mergeByNameOrId(
          next.bible.customEntries ?? [],
          parsed.payload.customEntries ?? [],
        ),
      };
      const totalImported =
        parsed.payload.characters.length +
        parsed.payload.locations.length +
        parsed.payload.lore.length +
        (parsed.payload.customEntries?.length ?? 0);
      return {
        project: next,
        focusView: 'bible',
        summaryMessage: `Imported ${totalImported} entries from .bvbible (${parsed.payload.seriesName})`,
      };
    }

    case '.bvscene': {
      const next = normalizeProjectDefaults(currentProject);
      const incoming = structuredClone(parsed.payload.scene);
      incoming.annotations = Array.isArray(incoming.annotations) ? incoming.annotations : [];
      const existingCtx = findSceneContext(next, incoming.id);
      if (existingCtx) {
        const chapter = next.parts[existingCtx.partIndex].chapters[existingCtx.chapterIndex];
        chapter.scenes[existingCtx.sceneIndex] = incoming;
      } else {
        if (next.parts.length === 0) {
          next.parts.push({
            id: newId('part'),
            title: 'Part I',
            collapsed: false,
            chapters: [],
          });
        }
        if (next.parts[0].chapters.length === 0) {
          next.parts[0].chapters.push({
            id: newId('chap'),
            title: parsed.payload.chapterTitle || 'Imported Chapter',
            subtitle: '',
            collapsed: false,
            scenes: [],
          });
        }
        next.parts[0].chapters[0].scenes.push(incoming);
      }
      return {
        project: next,
        focusView: 'editor',
        focusSceneId: incoming.id,
        summaryMessage: `Opened .bvscene “${incoming.title}” (${countWords(incoming.content)} words)`,
      };
    }

    case '.bvstyle': {
      const next: BookProject = normalizeProjectDefaults({
        ...structuredClone(currentProject),
        paperTheme: parsed.payload.paperTheme ?? currentProject.paperTheme,
        typography: {
          ...currentProject.typography,
          ...structuredClone(parsed.payload.typography),
        },
      });
      return {
        project: next,
        focusView: 'typeset',
        summaryMessage: `Applied .bvstyle preset “${parsed.payload.presetName}”`,
      };
    }
  }
}
