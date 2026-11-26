import {
  base64ToUint8Array,
  decodeQuillvibeBinary,
  encodeQuillvibeBinary,
  isQvbxBinary,
  QuillvibeCodecError,
  scanPayloadForThreats,
  type EncodeQvbxOptions,
} from './codec';
import { stripPrivateAuthorSecrets, verifyProjectAuthorKeyIntegrity } from './identity';
import { normalizeProjectDefaults } from './library';
import { countWords, findSceneContext, newId } from './manuscript';
import { getPublisherProvenance } from './provenance';
import type {
  AnyQuillvibeOrLegacyExtension,
  BookCoverConfig,
  BookProject,
  LegacyImportExtension,
  QuillvibeBiblePayload,
  QuillvibeDesignPayload,
  QuillvibeEnvelope,
  QuillvibeExtension,
  QuillvibeManuscriptPayload,
  QuillvibeScenePayload,
  QuillvibeStylePayload,
  StudioViewId,
} from './types';

export interface ExtensionDefinition {
  extension: AnyQuillvibeOrLegacyExtension;
  bareExtension: string;
  name: string;
  shortLabel: string;
  mimeType: string;
  uti: string;
  progId: string;
  purpose: string;
}

export const QUILLVIBE_MAGIC = 'QUILLVIBE_V2' as const;
export const LEGACY_BOOKVIBE_MAGIC = 'BOOKVIBE_V1' as const;
export const QUILLVIBE_FORMAT_VERSION = '2.0.0' as const;

export const QUILLVIBE_EXTENSIONS: readonly ExtensionDefinition[] = [
  {
    extension: '.qv',
    bareExtension: 'qv',
    name: 'Quillvibe Workspace Book',
    shortLabel: 'Book Workspace',
    mimeType: 'application/vnd.quillvibe.workspace',
    uti: 'app.quillvibe.workspace',
    progId: 'Quillvibe.Workspace.2',
    purpose: 'Protected QVBX whole-book archive: manuscript, snapshots, story bible, graph, cover, copyright seal, and typography.',
  },
  {
    extension: '.qvbible',
    bareExtension: 'qvbible',
    name: 'Quillvibe Story Bible DB',
    shortLabel: 'Story Bible',
    mimeType: 'application/vnd.quillvibe.bible',
    uti: 'app.quillvibe.bible',
    progId: 'Quillvibe.Bible.2',
    purpose: 'Shareable worldbuilding database (Characters, Locations, Lore, Custom Categories).',
  },
  {
    extension: '.qvscene',
    bareExtension: 'qvscene',
    name: 'Quillvibe Standalone Scene',
    shortLabel: 'Scene Draft',
    mimeType: 'application/vnd.quillvibe.scene',
    uti: 'app.quillvibe.scene',
    progId: 'Quillvibe.Scene.2',
    purpose: 'Individual scene draft, annotations, and snapshots for isolated drafting or sharing.',
  },
  {
    extension: '.qvstyle',
    bareExtension: 'qvstyle',
    name: 'Quillvibe Typeset Preset',
    shortLabel: 'Typeset Style',
    mimeType: 'application/vnd.quillvibe.style',
    uti: 'app.quillvibe.style',
    progId: 'Quillvibe.Style.2',
    purpose: 'Shareable book layout preset (trim size, margins, serif typeface, drop caps).',
  },
  {
    extension: '.qvdesign',
    bareExtension: 'qvdesign',
    name: 'Quillvibe Cover Design Package',
    shortLabel: 'Cover Design',
    mimeType: 'application/vnd.quillvibe.design',
    uti: 'app.quillvibe.design',
    progId: 'Quillvibe.Design.1',
    purpose: 'Shareable Book Cover Studio vector artwork, blend layers, draft variants, and collaboration pins.',
  },
] as const;

/**
 * Legacy import-only definitions. These extensions are never exported or opened via double-click.
 */
export const LEGACY_IMPORT_EXTENSIONS: readonly ExtensionDefinition[] = [
  {
    extension: '.quillvibe',
    bareExtension: 'quillvibe',
    name: 'Legacy Quillvibe v2.0 Archive',
    shortLabel: 'Legacy .quillvibe',
    mimeType: 'application/vnd.quillvibe.project',
    uti: 'app.quillvibe.legacy-project',
    progId: 'Legacy.Quillvibe.2',
    purpose: 'Legacy import-only full project archive.',
  },
  {
    extension: '.qvibe',
    bareExtension: 'qvibe',
    name: 'Legacy Compact Archive',
    shortLabel: 'Legacy .qvibe',
    mimeType: 'application/vnd.quillvibe.project',
    uti: 'app.quillvibe.legacy-compact',
    progId: 'Legacy.Qvibe.2',
    purpose: 'Legacy import-only compact project archive.',
  },
  {
    extension: '.qvbook',
    bareExtension: 'qvbook',
    name: 'Legacy Manuscript Package',
    shortLabel: 'Legacy .qvbook',
    mimeType: 'application/vnd.quillvibe.manuscript',
    uti: 'app.quillvibe.legacy-manuscript',
    progId: 'Legacy.Qvbook.2',
    purpose: 'Legacy import-only manuscript package.',
  },
  {
    extension: '.bookvibe',
    bareExtension: 'bookvibe',
    name: 'Legacy Master Archive',
    shortLabel: 'Legacy Project',
    mimeType: 'application/vnd.bookvibe.project+json',
    uti: 'org.bookvibe.project',
    progId: 'Legacy.Project.1',
    purpose: 'Legacy import-only project archive.',
  },
  {
    extension: '.bvibe',
    bareExtension: 'bvibe',
    name: 'Legacy Compact Archive',
    shortLabel: 'Legacy Compact',
    mimeType: 'application/vnd.bookvibe.project+json',
    uti: 'org.bookvibe.compact-project',
    progId: 'Legacy.CompactProject.1',
    purpose: 'Legacy import-only compact project archive.',
  },
  {
    extension: '.bvbook',
    bareExtension: 'bvbook',
    name: 'Legacy Manuscript Archive',
    shortLabel: 'Legacy Manuscript',
    mimeType: 'application/vnd.bookvibe.manuscript+json',
    uti: 'org.bookvibe.manuscript',
    progId: 'Legacy.Manuscript.1',
    purpose: 'Legacy import-only manuscript archive.',
  },
  {
    extension: '.bvbible',
    bareExtension: 'bvbible',
    name: 'Legacy Story Bible Archive',
    shortLabel: 'Legacy Bible',
    mimeType: 'application/vnd.bookvibe.bible+json',
    uti: 'org.bookvibe.bible',
    progId: 'Legacy.Bible.1',
    purpose: 'Legacy import-only Story Bible archive.',
  },
  {
    extension: '.bvscene',
    bareExtension: 'bvscene',
    name: 'Legacy Scene Draft Archive',
    shortLabel: 'Legacy Scene',
    mimeType: 'application/vnd.bookvibe.scene+json',
    uti: 'org.bookvibe.scene',
    progId: 'Legacy.Scene.1',
    purpose: 'Legacy import-only scene draft archive.',
  },
  {
    extension: '.bvstyle',
    bareExtension: 'bvstyle',
    name: 'Legacy Typeset Preset Archive',
    shortLabel: 'Legacy Style',
    mimeType: 'application/vnd.bookvibe.style+json',
    uti: 'org.bookvibe.style',
    progId: 'Legacy.Style.1',
    purpose: 'Legacy import-only typeset preset.',
  },
] as const;

export const ALL_OFFICIAL_EXTENSIONS: readonly ExtensionDefinition[] = QUILLVIBE_EXTENSIONS;

export function getExtensionDefinition(ext: string): ExtensionDefinition | undefined {
  const normalized = ext.trim().toLowerCase();
  const withDot = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return QUILLVIBE_EXTENSIONS.find((item) => item.extension === withDot);
}

export function getAnyImportableExtensionDefinition(ext: string): ExtensionDefinition | undefined {
  const normalized = ext.trim().toLowerCase();
  const withDot = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return (
    QUILLVIBE_EXTENSIONS.find((item) => item.extension === withDot) ??
    LEGACY_IMPORT_EXTENSIONS.find((item) => item.extension === withDot)
  );
}

export function isLegacyImportExtension(ext: string): ext is LegacyImportExtension {
  const normalized = ext.trim().toLowerCase();
  const withDot = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return LEGACY_IMPORT_EXTENSIONS.some((item) => item.extension === withDot);
}

export function extractExtensionFromFilename(filename: string): QuillvibeExtension | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  const def = getExtensionDefinition(filename.slice(dot));
  return def ? (def.extension as QuillvibeExtension) : null;
}

export function extractAnyImportableExtensionFromFilename(
  filename: string,
): AnyQuillvibeOrLegacyExtension | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  const def = getAnyImportableExtensionDefinition(filename.slice(dot));
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

export function buildQuillvibeEnvelope(
  extension: QuillvibeExtension,
  rawProject: BookProject,
  options?: { sceneId?: string; presetName?: string; seriesName?: string },
): QuillvibeEnvelope {
  const def = getExtensionDefinition(extension);
  if (!def) {
    throw new Error(`Unsupported Quillvibe extension: ${extension}`);
  }

  // Always strip local private signing keys before emitting portable export files
  const project = stripPrivateAuthorSecrets(rawProject);
  let payload: unknown;

  switch (extension) {
    case '.qv': {
      payload = project;
      break;
    }
    case '.qvbible': {
      const biblePayload: QuillvibeBiblePayload = {
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
    case '.qvscene': {
      const ctx = options?.sceneId
        ? findSceneContext(project, options.sceneId)
        : undefined;
      const fallbackScene = project.parts[0]?.chapters[0]?.scenes[0];
      const scene = ctx?.scene ?? fallbackScene;
      if (!scene) {
        throw new Error('No scene available to export as standalone scene.');
      }
      const scenePayload: QuillvibeScenePayload = {
        bookTitle: project.title,
        chapterTitle: ctx?.chapter.title ?? project.parts[0]?.chapters[0]?.title ?? 'Draft',
        scene,
      };
      payload = scenePayload;
      break;
    }
    case '.qvstyle': {
      const stylePayload: QuillvibeStylePayload = {
        presetName:
          options?.presetName?.trim() ||
          `${project.title} (${project.typography.trimSize})`,
        paperTheme: project.paperTheme,
        typography: project.typography,
      };
      payload = stylePayload;
      break;
    }
    case '.qvdesign': {
      if (!project.cover) {
        throw new Error('No Book Cover Studio layout available to export.');
      }
      const designPayload: QuillvibeDesignPayload = {
        designName: options?.presetName?.trim() || `${project.title} Cover`,
        bookTitle: project.title,
        author: project.authorIdentity?.penName || project.author || 'Author',
        trimSize: project.typography.trimSize,
        cover: structuredClone(project.cover),
      };
      payload = designPayload;
      break;
    }
  }

  return {
    magic: QUILLVIBE_MAGIC,
    formatVersion: QUILLVIBE_FORMAT_VERSION,
    extension,
    mimeType: def.mimeType,
    uti: def.uti,
    exportedAt: new Date().toISOString(),
    provenanceMark: getPublisherProvenance(rawProject.id).mark,
    payload,
  };
}

export function serializeExtensionFile(
  extension: QuillvibeExtension,
  rawProject: BookProject,
  options?: { sceneId?: string; presetName?: string; seriesName?: string },
): string {
  const envelope = buildQuillvibeEnvelope(extension, rawProject, options);
  return JSON.stringify(envelope, null, 2);
}

export async function serializeQuillvibeBinary(
  extension: QuillvibeExtension,
  rawProject: BookProject,
  options?: {
    sceneId?: string;
    presetName?: string;
    seriesName?: string;
    password?: string;
  },
): Promise<Uint8Array> {
  const envelope = buildQuillvibeEnvelope(extension, rawProject, options);
  const includesAuthorIdentity = extension === '.qv';
  const encodeOpts: EncodeQvbxOptions = {
    password: options?.password,
    sealAuthorKeyId: includesAuthorIdentity ? rawProject.authorIdentity?.authorKeyId : undefined,
    enforceRestrictions: Boolean(rawProject.collaborators && rawProject.collaborators.length > 0),
  };
  return encodeQuillvibeBinary(envelope, encodeOpts);
}

export type ParsedQuillvibeFile =
  | { extension: '.qv' | '.quillvibe' | '.qvibe' | '.bookvibe' | '.bvibe'; payload: BookProject }
  | { extension: '.qvbook' | '.bvbook'; payload: QuillvibeManuscriptPayload }
  | { extension: '.qvbible' | '.bvbible'; payload: QuillvibeBiblePayload }
  | { extension: '.qvscene' | '.bvscene'; payload: QuillvibeScenePayload }
  | { extension: '.qvstyle' | '.bvstyle'; payload: QuillvibeStylePayload }
  | { extension: '.qvdesign'; payload: QuillvibeDesignPayload };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateDecodedEnvelope(
  parsed: Record<string, unknown>,
  filenameHint?: string,
): ParsedQuillvibeFile {
  scanPayloadForThreats(parsed);

  if (parsed.magic !== QUILLVIBE_MAGIC && parsed.magic !== LEGACY_BOOKVIBE_MAGIC) {
    if (Array.isArray(parsed.parts) && isRecord(parsed.bible) && typeof parsed.title === 'string') {
      return {
        extension: '.qv',
        payload: normalizeProjectDefaults(parsed as unknown as BookProject),
      };
    }
    throw new Error('Missing Quillvibe format header.');
  }

  const declaredExt =
    typeof parsed.extension === 'string'
      ? getAnyImportableExtensionDefinition(parsed.extension)?.extension
      : undefined;
  const hintExt = filenameHint
    ? extractAnyImportableExtensionFromFilename(filenameHint) ?? undefined
    : undefined;
  const extension = declaredExt ?? hintExt;

  if (!extension) {
    throw new Error('Unrecognized Quillvibe file extension header.');
  }
  if (!isRecord(parsed.payload)) {
    throw new Error(`Invalid payload structure for ${extension}.`);
  }

  const payload = parsed.payload;

  switch (extension) {
    case '.qv':
    case '.quillvibe':
    case '.qvibe':
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
    case '.qvbook':
    case '.bvbook': {
      if (!Array.isArray(payload.parts)) {
        throw new Error('Manuscript payload must include a parts array.');
      }
      return { extension, payload: payload as unknown as QuillvibeManuscriptPayload };
    }
    case '.qvbible':
    case '.bvbible': {
      if (
        !Array.isArray(payload.characters) ||
        !Array.isArray(payload.locations) ||
        !Array.isArray(payload.lore)
      ) {
        throw new Error('Story Bible payload requires characters, locations, and lore arrays.');
      }
      return { extension, payload: payload as unknown as QuillvibeBiblePayload };
    }
    case '.qvscene':
    case '.bvscene': {
      if (!isRecord(payload.scene) || typeof payload.scene.content !== 'string') {
        throw new Error('Scene payload requires a valid scene object.');
      }
      return { extension, payload: payload as unknown as QuillvibeScenePayload };
    }
    case '.qvstyle':
    case '.bvstyle': {
      if (!isRecord(payload.typography)) {
        throw new Error('Typeset style payload requires a typography object.');
      }
      return { extension, payload: payload as unknown as QuillvibeStylePayload };
    }
    case '.qvdesign': {
      if (!isRecord(payload.cover) || !isRecord(payload.cover.elements)) {
        throw new Error('Cover design payload requires a valid cover layout object.');
      }
      return { extension, payload: payload as unknown as QuillvibeDesignPayload };
    }
  }
}

export function parseExtensionFile(rawJson: string, filenameHint?: string): ParsedQuillvibeFile {
  let parsed: unknown;
  try {
    parsed = safeJsonParse(rawJson);
  } catch {
    throw new Error('Selected file is not valid Quillvibe data.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Invalid Quillvibe file root object.');
  }

  return validateDecodedEnvelope(parsed, filenameHint);
}

export interface DecodedQuillvibeResult {
  parsed: ParsedQuillvibeFile;
  isProtectedBinary: boolean;
  isLegacyImport: boolean;
}

export async function parseQuillvibeInput(
  input: Uint8Array | string,
  options?: { filenameHint?: string; password?: string; base64Encoded?: boolean },
): Promise<DecodedQuillvibeResult> {
  let bytes: Uint8Array | null = null;
  let text = '';

  if (input instanceof Uint8Array) {
    if (isQvbxBinary(input)) {
      bytes = input;
    } else {
      text = new TextDecoder().decode(input);
    }
  } else if (options?.base64Encoded) {
    const raw = base64ToUint8Array(input);
    if (isQvbxBinary(raw)) {
      bytes = raw;
    } else {
      text = new TextDecoder().decode(raw);
    }
  } else {
    text = input;
  }

  let parsed: ParsedQuillvibeFile;
  let isProtectedBinary = false;

  if (bytes) {
    isProtectedBinary = true;
    const envelope = await decodeQuillvibeBinary(bytes, options?.password);
    parsed = validateDecodedEnvelope(envelope as unknown as Record<string, unknown>, options?.filenameHint);
  } else {
    parsed = parseExtensionFile(text, options?.filenameHint);
  }

  if (
    parsed.extension === '.qv' ||
    parsed.extension === '.quillvibe' ||
    parsed.extension === '.qvibe' ||
    parsed.extension === '.bookvibe' ||
    parsed.extension === '.bvibe'
  ) {
    const keyCheck = await verifyProjectAuthorKeyIntegrity(parsed.payload);
    if (!keyCheck.ok) {
      throw new QuillvibeCodecError(
        'AUTHOR_KEY_TAMPERED',
        keyCheck.reason || 'Author Key validation failed.',
      );
    }
  }

  const isLegacyImport = isLegacyImportExtension(parsed.extension);
  return { parsed, isProtectedBinary, isLegacyImport };
}

export interface AppliedExtensionResult {
  project: BookProject;
  focusView: StudioViewId;
  focusTypesetSubTab?: 'interior' | 'cover' | 'publish';
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
  parsed: ParsedQuillvibeFile,
  currentProject: BookProject,
): AppliedExtensionResult {
  switch (parsed.extension) {
    case '.qv':
    case '.quillvibe':
    case '.qvibe':
    case '.bookvibe':
    case '.bvibe': {
      const next = normalizeProjectDefaults(parsed.payload);
      const firstScene = next.parts[0]?.chapters[0]?.scenes[0]?.id;
      return {
        project: next,
        focusView: 'editor',
        focusSceneId: firstScene,
        summaryMessage: isLegacyImportExtension(parsed.extension)
          ? `Imported legacy ${parsed.extension} project “${next.title}” into Quillvibe`
          : `Opened ${parsed.extension} project “${next.title}”`,
      };
    }

    case '.qvbook':
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
        publishing: parsed.payload.publishing ?? currentProject.publishing,
      });
      const firstScene = next.parts[0]?.chapters[0]?.scenes[0]?.id;
      return {
        project: next,
        focusView: 'editor',
        focusSceneId: firstScene,
        summaryMessage: `Loaded ${parsed.extension} manuscript “${next.title}”`,
      };
    }

    case '.qvbible':
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
        summaryMessage: `Imported ${totalImported} entries from ${parsed.extension} (${parsed.payload.seriesName})`,
      };
    }

    case '.qvscene':
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
        summaryMessage: `Opened ${parsed.extension} “${incoming.title}” (${countWords(incoming.content)} words)`,
      };
    }

    case '.qvstyle':
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
        focusTypesetSubTab: 'interior',
        summaryMessage: `Applied ${parsed.extension} preset “${parsed.payload.presetName}”`,
      };
    }

    case '.qvdesign': {
      const incomingCover = structuredClone(parsed.payload.cover) as BookCoverConfig;
      const existingComments = currentProject.cover?.comments ?? [];
      const incomingComments = incomingCover.comments ?? [];
      const commentMap = new Map(existingComments.map((c) => [c.id, c]));
      for (const c of incomingComments) {
        commentMap.set(c.id, c);
      }
      incomingCover.comments = Array.from(commentMap.values());

      const existingVariants = currentProject.cover?.variants ?? [];
      const incomingVariants = incomingCover.variants ?? [];
      const variantMap = new Map(existingVariants.map((v) => [v.id, v]));
      for (const v of incomingVariants) {
        variantMap.set(v.id, v);
      }
      incomingCover.variants = Array.from(variantMap.values());

      const next: BookProject = normalizeProjectDefaults({
        ...structuredClone(currentProject),
        cover: incomingCover,
      });
      return {
        project: next,
        focusView: 'typeset',
        focusTypesetSubTab: 'cover',
        summaryMessage: `Loaded .qvdesign cover “${parsed.payload.designName}” (${incomingComments.length} review pin${incomingComments.length === 1 ? '' : 's'})`,
      };
    }
  }
}

export async function exportCoverDesignArchive(
  project: BookProject,
  designName?: string,
  password?: string,
): Promise<Uint8Array> {
  return serializeQuillvibeBinary('.qvdesign', project, {
    presetName: designName,
    password,
  });
}

export async function importCoverDesignArchive(
  input: Uint8Array | string,
  currentProject: BookProject,
  options?: { mergeCommentsOnly?: boolean; filenameHint?: string; password?: string },
): Promise<{ project: BookProject; summaryMessage: string }> {
  const decoded = await parseQuillvibeInput(input, {
    filenameHint: options?.filenameHint ?? 'cover.qvdesign',
    password: options?.password,
  });
  if (decoded.parsed.extension !== '.qvdesign') {
    throw new Error(`Expected a .qvdesign file, got ${decoded.parsed.extension}.`);
  }
  if (options?.mergeCommentsOnly) {
    const next = normalizeProjectDefaults(currentProject);
    const currentCover = next.cover;
    if (currentCover) {
      const merged = new Map((currentCover.comments ?? []).map((c) => [c.id, c]));
      for (const c of decoded.parsed.payload.cover.comments ?? []) {
        merged.set(c.id, c);
      }
      currentCover.comments = Array.from(merged.values());
    }
    return {
      project: next,
      summaryMessage: `Merged review comments from “${decoded.parsed.payload.designName}”`,
    };
  }
  const applied = applyOpenedExtensionFile(decoded.parsed, currentProject);
  return {
    project: applied.project,
    summaryMessage: applied.summaryMessage,
  };
}
