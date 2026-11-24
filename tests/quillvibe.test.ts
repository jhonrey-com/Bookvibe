import { describe, expect, it } from 'vitest';

import { ALARM_RINGTONES, AlarmController } from '../src/core/alarm';
import { getSceneMentions } from '../src/core/bible';
import {
  QuillvibeCodecError,
  decodeQuillvibeBinary,
  encodeQuillvibeBinary,
  inspectQuillvibeBinary,
  isQvbxBinary,
} from '../src/core/codec';
import {
  addCollaborator,
  getActiveSessionPermissions,
  getCollaboratorPermissions,
  mergeBookRevisions,
  updateCollaboratorPermissions,
} from '../src/core/collab';
import {
  loadEnterpriseSyncConfig,
  saveEnterpriseSyncConfig,
  validateSyncServerUrl,
} from '../src/core/enterprise-sync';
import {
  EXPORT_FORMAT_OPTIONS,
  applySmartTypography,
  buildMarkdownExport,
  buildPrintableBookHtml,
  computeBookPagination,
} from '../src/core/export';
import {
  LEGACY_IMPORT_EXTENSIONS,
  QUILLVIBE_EXTENSIONS,
  applyOpenedExtensionFile,
  buildQuillvibeEnvelope,
  extractAnyImportableExtensionFromFilename,
  extractExtensionFromFilename,
  isLegacyImportExtension,
  parseQuillvibeInput,
  serializeExtensionFile,
  serializeQuillvibeBinary,
} from '../src/core/extensions';
import {
  ensureAuthorIdentity,
  generateAuthorKeyPair,
  getOrCreatePermanentAuthorKey,
  getPermanentAuthorKeyForPenName,
  signManuscript,
} from '../src/core/identity';
import { createEmptyBookProject, normalizeProjectDefaults } from '../src/core/library';
import { countWords, getAllScenes, getProjectWordCount } from '../src/core/manuscript';
import {
  acceptProofreadMark,
  addProofreadMark,
  computeCleanProofPreview,
} from '../src/core/proofread';
import { getPublisherProvenance, verifyPublisherProvenance } from '../src/core/provenance';
import { resolvePathToRoute, routeForState } from '../src/core/router';
import { createStarterBookProject } from '../src/core/sample-book';
import { DEFAULT_SETTINGS, formatAppWindowTitle } from '../src/core/settings';
import { COURSE_MODULES, getCourseCompletionSummary } from '../src/ui/course';

describe('Quillvibe Core Rebrand & Formats', () => {
  it('registers all 6 official .quillvibe/.qv* formats and excludes .bookvibe from default export formats', () => {
    expect(QUILLVIBE_EXTENSIONS).toHaveLength(6);
    expect(QUILLVIBE_EXTENSIONS.map((e) => e.extension)).toEqual([
      '.quillvibe',
      '.qvibe',
      '.qvbook',
      '.qvbible',
      '.qvscene',
      '.qvstyle',
    ]);
    expect(EXPORT_FORMAT_OPTIONS.some((opt) => (opt.id as string) === '.bookvibe')).toBe(false);
    expect(LEGACY_IMPORT_EXTENSIONS.map((e) => e.extension)).toContain('.bookvibe');
  });

  it('extractExtensionFromFilename accepts only official Quillvibe extensions and rejects .bookvibe', () => {
    expect(extractExtensionFromFilename('novel.quillvibe')).toBe('.quillvibe');
    expect(extractExtensionFromFilename('chapter.qvscene')).toBe('.qvscene');
    expect(extractExtensionFromFilename('legacy.bookvibe')).toBeNull();
    expect(extractExtensionFromFilename('legacy.bvbook')).toBeNull();

    expect(extractAnyImportableExtensionFromFilename('legacy.bookvibe')).toBe('.bookvibe');
    expect(isLegacyImportExtension('.bookvibe')).toBe(true);
    expect(isLegacyImportExtension('.quillvibe')).toBe(false);
  });

  it('uses QV provenance seal and Ivory Light as default theme', () => {
    const starter = createStarterBookProject();
    const prov = getPublisherProvenance(starter.id);
    expect(prov.publisher).toBe('jhonrey.com');
    expect(prov.mark.startsWith('QV-')).toBe(true);
    expect(verifyPublisherProvenance(prov.publisher, prov.mark, starter.id)).toBe(true);
    expect(DEFAULT_SETTINGS.appTheme).toBe('ivory');
    expect(DEFAULT_SETTINGS.toolTier).toBe('basic');
  });
});

describe('Quillvibe Proprietary QVBX Container & Security', () => {
  it('encodes and decodes .quillvibe, .qvbook, .qvbible, .qvscene, and .qvstyle as QVBX binary', async () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    const sceneId = getAllScenes(project)[0]!.scene.id;

    for (const ext of ['.quillvibe', '.qvibe', '.qvbook', '.qvbible', '.qvscene', '.qvstyle'] as const) {
      const bytes = await serializeQuillvibeBinary(ext, project, { sceneId });
      expect(isQvbxBinary(bytes)).toBe(true);
      const header = inspectQuillvibeBinary(bytes);
      expect(header.extension).toBe(ext);
      expect(header.passwordProtected).toBe(false);

      const decoded = await parseQuillvibeInput(bytes, { filenameHint: `test${ext}` });
      expect(decoded.isProtectedBinary).toBe(true);
      expect(decoded.parsed.extension).toBe(ext);
      const applied = applyOpenedExtensionFile(decoded.parsed, project);
      expect(applied.project.title).toBe(project.title);
    }
  });

  it('requires password on password-locked QVBX exports and rejects wrong passwords', async () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    const lockedBytes = await serializeQuillvibeBinary('.quillvibe', project, {
      password: 'OakHarbor-Secret-2026',
    });

    const info = inspectQuillvibeBinary(lockedBytes);
    expect(info.passwordProtected).toBe(true);

    await expect(decodeQuillvibeBinary(lockedBytes)).rejects.toMatchObject({
      name: 'QuillvibeCodecError',
      code: 'PASSWORD_REQUIRED',
    } satisfies Partial<QuillvibeCodecError>);

    await expect(decodeQuillvibeBinary(lockedBytes, 'wrong-password')).rejects.toMatchObject({
      code: 'WRONG_PASSWORD_OR_DAMAGED',
    } satisfies Partial<QuillvibeCodecError>);

    const envelope = await decodeQuillvibeBinary(lockedBytes, 'OakHarbor-Secret-2026');
    expect(envelope.extension).toBe('.quillvibe');
  });

  it('detects damaged or externally tampered QVBX bytes and refuses recovery', async () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    const bytes = await serializeQuillvibeBinary('.quillvibe', project);
    const corrupted = new Uint8Array(bytes);
    corrupted[corrupted.length - 5] ^= 0xff;

    await expect(decodeQuillvibeBinary(corrupted)).rejects.toMatchObject({
      code: 'DAMAGED_OR_TAMPERED',
    } satisfies Partial<QuillvibeCodecError>);
  });

  it('detects Author Key swapping/tampering between QVBX header and inner payload', async () => {
    const base = normalizeProjectDefaults(createStarterBookProject());
    const signed = await signManuscript(base);
    const env = buildQuillvibeEnvelope('.quillvibe', signed);
    const mismatched = await encodeQuillvibeBinary(env, {
      sealAuthorKeyId: 'QVK-DIFFERENTKEY1',
    });

    await expect(decodeQuillvibeBinary(mismatched)).rejects.toMatchObject({
      code: 'AUTHOR_KEY_TAMPERED',
    } satisfies Partial<QuillvibeCodecError>);
  });

  it('rejects malware/script payloads and executable headers inside decoded QVBX containers', async () => {
    const scriptProject = normalizeProjectDefaults(createEmptyBookProject('<script>alert(1)</script>', 'Pen'));
    const scriptEnv = buildQuillvibeEnvelope('.quillvibe', scriptProject);
    const scriptEncoded = await encodeQuillvibeBinary(scriptEnv);

    await expect(decodeQuillvibeBinary(scriptEncoded)).rejects.toMatchObject({
      code: 'MALWARE_DETECTED',
    } satisfies Partial<QuillvibeCodecError>);

    const exeProject = normalizeProjectDefaults(createEmptyBookProject('Normal Title', 'Pen'));
    exeProject.cover!.backgroundImageDataUrl = 'data:image/png;base64,TVqQAAMAAAAEAAAA';
    const exeEnv = buildQuillvibeEnvelope('.quillvibe', exeProject);
    const exeEncoded = await encodeQuillvibeBinary(exeEnv);

    await expect(decodeQuillvibeBinary(exeEncoded)).rejects.toMatchObject({
      code: 'MALWARE_DETECTED',
    } satisfies Partial<QuillvibeCodecError>);
  });

  it('supports explicit importing from legacy .bookvibe JSON while decoding via parseQuillvibeInput', async () => {
    const starter = createStarterBookProject();
    const legacyJson = serializeExtensionFile('.quillvibe', starter)
      .replace('"QUILLVIBE_V2"', '"BOOKVIBE_V1"')
      .replace('".quillvibe"', '".bookvibe"');

    const res = await parseQuillvibeInput(legacyJson, { filenameHint: 'old-draft.bookvibe' });
    expect(res.isLegacyImport).toBe(true);
    expect(res.parsed.extension).toBe('.bookvibe');
    const applied = applyOpenedExtensionFile(res.parsed, starter);
    expect(applied.summaryMessage).toContain('Imported legacy .bookvibe');
  });
});

describe('Forever Pen-Name Author Keys, Team Permissions & Commercial Options', () => {
  it('binds a permanent immutable Author Key per pen name', async () => {
    const uniquePen = `Mira Solis ${Date.now()}`;
    const first = await getOrCreatePermanentAuthorKey(uniquePen);
    const second = await getOrCreatePermanentAuthorKey(`  ${uniquePen}  `);
    const lookup = getPermanentAuthorKeyForPenName(uniquePen);

    expect(first.authorKeyId.startsWith('QVK-')).toBe(true);
    expect(first.lockedForever).toBe(true);
    expect(second.authorKeyId).toBe(first.authorKeyId);
    expect(second.publicKeyJwk).toBe(first.publicKeyJwk);
    expect(lookup?.authorKeyId).toBe(first.authorKeyId);

    const generatedPair = await generateAuthorKeyPair(uniquePen);
    expect(generatedPair.authorKeyId).toBe(first.authorKeyId);
    expect(generatedPair.keyLockedForever).toBe(true);

    const otherPen = await getOrCreatePermanentAuthorKey(`Other Pen ${Date.now()}`);
    expect(otherPen.authorKeyId).not.toBe(first.authorKeyId);
  });

  it('enforces collaborator role defaults, custom overrides, and owner-only Author Key protection', () => {
    let book = createStarterBookProject();
    const id = ensureAuthorIdentity(book);
    expect(id.penName.length).toBeGreaterThan(0);

    book = addCollaborator(book, {
      name: 'Linus Reed',
      role: 'proofreader',
      creditLine: 'Copyediting',
    });
    const proof = book.collaborators![book.collaborators!.length - 1]!;
    expect(getCollaboratorPermissions(proof)).toMatchObject({
      canEditProse: false,
      canProofreadOnly: true,
      canExportFiles: false,
    });

    book.activeAuthorLabel = 'Linus Reed';
    const sessionPerms = getActiveSessionPermissions(book);
    expect(sessionPerms.isOwner).toBe(false);
    expect(sessionPerms.canEditProse).toBe(false);
    expect(sessionPerms.canModifyAuthorKey).toBe(false);

    book = updateCollaboratorPermissions(book, proof.id, { canExportFiles: true });
    expect(getActiveSessionPermissions(book).canExportFiles).toBe(true);
  });

  it('renders ARC watermark into Printable Typeset HTML and resolves dynamic window titles', () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    project.publishing = {
      ...(project.publishing ?? {
        imprintName: 'Independent Press',
        isbn: '978-1-4028-9462-6',
        editionNumber: '1st Edition',
        editorialStage: 'copyedit',
      }),
      publisherCompany: 'Harbor Literary LLC',
      arcWatermarkText: 'ADVANCE REVIEW COPY',
    };
    const html = buildPrintableBookHtml(project);
    expect(html).toContain('ADVANCE REVIEW COPY');

    expect(
      formatAppWindowTitle(
        { ...DEFAULT_SETTINGS, windowTitleMode: 'custom', windowTitleCustom: '{book} · {author} ({section})' },
        project,
        'editor',
      ),
    ).toContain(project.title);
  });
});

describe('Manuscript, Bible, Proofread, Pagination, Course & Sync Helpers', () => {
  it('computes word counts, bible mentions, proofread marks, pagination, and Markdown exports cleanly', () => {
    const project = createStarterBookProject();
    expect(countWords('One two three.')).toBe(3);
    expect(getProjectWordCount(project)).toBeGreaterThan(200);

    const scene = getAllScenes(project)[0]!.scene;
    const mentions = getSceneMentions(scene, project.bible);
    expect(mentions.length).toBeGreaterThan(0);

    const { project: withMark, mark } = addProofreadMark(project, scene.id, {
      kind: 'substitute',
      start: 0,
      end: 5,
      replacement: 'Bright',
      authorName: 'Proofreader',
      role: 'proofreader',
    });
    expect(mark).toBeDefined();
    const updatedScene = getAllScenes(withMark)[0]!.scene;
    expect(computeCleanProofPreview(updatedScene.content, updatedScene.proofreadMarks ?? []).length).toBeGreaterThan(0);
    const accepted = acceptProofreadMark(withMark, scene.id, mark!.id);
    expect(accepted.applied).toBe(true);
    expect(getAllScenes(accepted.project)[0]!.scene.content.startsWith('Bright')).toBe(true);

    expect(applySmartTypography('"Hello" -- world...')).toContain('“Hello”');
    expect(computeBookPagination(project).pages.length).toBeGreaterThan(3);
    expect(buildMarkdownExport(project)).toContain(project.title);
  });

  it('verifies merges, Enterprise HTTPS URL validation, Alarm presets, routing, and 10-module Course', () => {
    const base = createStarterBookProject();
    const copy = structuredClone(base);
    copy.parts[0]!.chapters[0]!.scenes[0]!.content += '\n\nCo-author closing note.';
    copy.parts[0]!.chapters[0]!.scenes[0]!.updatedAt = new Date(Date.now() + 60_000).toISOString();
    const merged = mergeBookRevisions(base, copy, 'Co-Author');
    expect(merged.updatedScenes).toBe(1);

    const cfg = loadEnterpriseSyncConfig(base.id);
    saveEnterpriseSyncConfig({ ...cfg, baseUrl: 'https://sync.quillvibe.example/api' });
    expect(validateSyncServerUrl('https://sync.quillvibe.example/api')).toMatchObject({
      ok: true,
      normalizedUrl: 'https://sync.quillvibe.example/api',
    });
    expect(validateSyncServerUrl('http://public.example.com/api').ok).toBe(false);

    expect(ALARM_RINGTONES).toHaveLength(5);
    const ac = new AlarmController({
      getConfig: () => ({ ringtone: 'warm-chime', volume: 0.5 }),
      onTrigger: () => undefined,
    });
    ac.setCountdownAlarm(5, 'Sprint');
    expect(ac.getSnapshot().armed).toBe(true);
    ac.destroy();

    expect(resolvePathToRoute('/course', false).view).toBe('course');
    expect(routeForState('course')).toBe('/course');
    expect(COURSE_MODULES).toHaveLength(10);
    expect(getCourseCompletionSummary().total).toBe(28);
  });
});
