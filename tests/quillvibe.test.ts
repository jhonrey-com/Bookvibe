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
  addVerifiedCoAuthorFromToken,
  generateLocalCoAuthorInviteToken,
  getActiveSessionPermissions,
  getCollaboratorPermissions,
  mergeBookRevisions,
  parseAndVerifyCoAuthorToken,
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
  buildPortableMigrationJson,
  buildPortableMigrationMarkdown,
  buildPrintableBookHtml,
  buildRtfExport,
  computeBookPagination,
} from '../src/core/export';
import { ProjectHistoryStack } from '../src/core/history';
import { computeSnappedImagePosition } from '../src/core/scene-images';
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
  checkBookOriginDevice,
  ensureAuthorIdentity,
  generateAuthorKeyPair,
  getOrCreateLocalDeviceId,
  getOrCreatePermanentAuthorKey,
  getPermanentAuthorKeyForPenName,
  sealWorkCopyright,
  signManuscript,
} from '../src/core/identity';
import { buildTypesetPdfBytes } from '../src/core/pdf-export';
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
  it('registers the 4 official .qv formats and moves legacy extensions to import-only', () => {
    expect(QUILLVIBE_EXTENSIONS).toHaveLength(4);
    expect(QUILLVIBE_EXTENSIONS.map((e) => e.extension)).toEqual([
      '.qv',
      '.qvbible',
      '.qvscene',
      '.qvstyle',
    ]);
    expect(EXPORT_FORMAT_OPTIONS.some((opt) => opt.id === '.pdf')).toBe(true);
    expect(EXPORT_FORMAT_OPTIONS.some((opt) => (opt.id as string) === '.bookvibe')).toBe(false);
    expect(LEGACY_IMPORT_EXTENSIONS.map((e) => e.extension)).toContain('.quillvibe');
    expect(LEGACY_IMPORT_EXTENSIONS.map((e) => e.extension)).toContain('.bookvibe');
  });

  it('extractExtensionFromFilename accepts only official Quillvibe extensions and rejects legacy formats', () => {
    expect(extractExtensionFromFilename('novel.qv')).toBe('.qv');
    expect(extractExtensionFromFilename('chapter.qvscene')).toBe('.qvscene');
    expect(extractExtensionFromFilename('old.quillvibe')).toBeNull();
    expect(extractExtensionFromFilename('legacy.bookvibe')).toBeNull();
    expect(extractExtensionFromFilename('legacy.bvbook')).toBeNull();

    expect(extractAnyImportableExtensionFromFilename('old.quillvibe')).toBe('.quillvibe');
    expect(extractAnyImportableExtensionFromFilename('legacy.bookvibe')).toBe('.bookvibe');
    expect(isLegacyImportExtension('.bookvibe')).toBe(true);
    expect(isLegacyImportExtension('.quillvibe')).toBe(true);
    expect(isLegacyImportExtension('.qv')).toBe(false);
  });

  it('uses QV provenance seal, Ivory Light, Basic tier, and Spellcheck off by default', () => {
    const starter = createStarterBookProject();
    const prov = getPublisherProvenance(starter.id);
    expect(prov.publisher).toBe('jhonrey.com');
    expect(prov.mark.startsWith('QV-')).toBe(true);
    expect(verifyPublisherProvenance(prov.publisher, prov.mark, starter.id)).toBe(true);
    expect(DEFAULT_SETTINGS.appTheme).toBe('ivory');
    expect(DEFAULT_SETTINGS.toolTier).toBe('basic');
    expect(DEFAULT_SETTINGS.enableSpellcheck).toBe(false);
  });
});

describe('Quillvibe Proprietary QVBX Container & Security', () => {
  it('encodes and decodes .qv, .qvbible, .qvscene, and .qvstyle as QVBX binary', async () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    const sceneId = getAllScenes(project)[0]!.scene.id;

    for (const ext of ['.qv', '.qvbible', '.qvscene', '.qvstyle'] as const) {
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
    const lockedBytes = await serializeQuillvibeBinary('.qv', project, {
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
    expect(envelope.extension).toBe('.qv');
  });

  it('detects damaged or externally tampered QVBX bytes and refuses recovery', async () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    const bytes = await serializeQuillvibeBinary('.qv', project);
    const corrupted = new Uint8Array(bytes);
    corrupted[corrupted.length - 5] ^= 0xff;

    await expect(decodeQuillvibeBinary(corrupted)).rejects.toMatchObject({
      code: 'DAMAGED_OR_TAMPERED',
    } satisfies Partial<QuillvibeCodecError>);
  });

  it('detects Author Key swapping/tampering between QVBX header and inner payload', async () => {
    const base = normalizeProjectDefaults(createStarterBookProject());
    const signed = await signManuscript(base);
    const env = buildQuillvibeEnvelope('.qv', signed);
    const mismatched = await encodeQuillvibeBinary(env, {
      sealAuthorKeyId: 'QVK-DIFFERENTKEY1',
    });

    await expect(decodeQuillvibeBinary(mismatched)).rejects.toMatchObject({
      code: 'AUTHOR_KEY_TAMPERED',
    } satisfies Partial<QuillvibeCodecError>);
  });

  it('rejects malware/script payloads and executable headers inside decoded QVBX containers', async () => {
    const scriptProject = normalizeProjectDefaults(createEmptyBookProject('<script>alert(1)</script>', 'Pen'));
    const scriptEnv = buildQuillvibeEnvelope('.qv', scriptProject);
    const scriptEncoded = await encodeQuillvibeBinary(scriptEnv);

    await expect(decodeQuillvibeBinary(scriptEncoded)).rejects.toMatchObject({
      code: 'MALWARE_DETECTED',
    } satisfies Partial<QuillvibeCodecError>);

    const exeProject = normalizeProjectDefaults(createEmptyBookProject('Normal Title', 'Pen'));
    exeProject.cover!.backgroundImageDataUrl = 'data:image/png;base64,TVqQAAMAAAAEAAAA';
    const exeEnv = buildQuillvibeEnvelope('.qv', exeProject);
    const exeEncoded = await encodeQuillvibeBinary(exeEnv);

    await expect(decodeQuillvibeBinary(exeEncoded)).rejects.toMatchObject({
      code: 'MALWARE_DETECTED',
    } satisfies Partial<QuillvibeCodecError>);
  });

  it('supports explicit importing from legacy .bookvibe JSON while decoding via parseQuillvibeInput', async () => {
    const starter = createStarterBookProject();
    const legacyJson = serializeExtensionFile('.qv', starter)
      .replace('"QUILLVIBE_V2"', '"BOOKVIBE_V1"')
      .replace('".qv"', '".bookvibe"');

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

  it('verifies Origin Device ID, Copyright Seal, Verified Multi-Device Co-Author tokens, PDF 1.4 export, and History Stack', async () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    const signed = await signManuscript(project);
    const localDevice = getOrCreateLocalDeviceId();
    expect(localDevice.startsWith('QVD-')).toBe(true);
    const originCheck = checkBookOriginDevice(signed);
    expect(originCheck.isOriginDevice).toBe(true);
    expect(originCheck.originDeviceId).toBe(localDevice);

    const copyrighted = await sealWorkCopyright(signed, { ownerName: 'Mira Solis', rightsTerritory: 'Worldwide' });
    expect(copyrighted.copyrightOwnership?.sealId.startsWith('QVC-')).toBe(true);
    expect(copyrighted.copyrightOwnership?.ownerName).toBe('Mira Solis');

    const coAuthToken = await generateLocalCoAuthorInviteToken({
      name: 'Elena Vance',
      penName: 'E. Vance',
      role: 'co-author',
    });
    expect(coAuthToken.token.startsWith('QVCA1.')).toBe(true);
    expect(coAuthToken.coAuthorKeyId.startsWith('QVCK-')).toBe(true);

    // Reject same-device self-adding when requireDistinctDevice = true
    await expect(
      parseAndVerifyCoAuthorToken(coAuthToken.token, { hostDeviceId: localDevice, requireDistinctDevice: true }),
    ).rejects.toThrow();

    // Accept when verified against a different host device
    const verifiedRemote = await parseAndVerifyCoAuthorToken(coAuthToken.token, {
      hostDeviceId: 'QVD-OTHERDEVICE99',
      requireDistinctDevice: true,
    });
    expect(verifiedRemote.sameDevice).toBe(false);

    const paired = await addVerifiedCoAuthorFromToken(copyrighted, coAuthToken.token, {
      requireDistinctDevice: false,
    });
    expect(paired.collaborator.coAuthorKeyId).toBe(coAuthToken.coAuthorKeyId);

    const pdfBytes = buildTypesetPdfBytes(copyrighted);
    const pdfText = new TextDecoder().decode(pdfBytes);
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('jhonrey.com');
    expect(pdfText.trim().endsWith('%%EOF')).toBe(true);

    const hist = new ProjectHistoryStack<string>(5);
    hist.pushSnapshot('v1', 'edit');
    hist.pushSnapshot('v2', 'edit');
    expect(hist.canUndo()).toBe(true);
    expect(hist.undo('v3')?.state).toBe('v2');
    expect(hist.redo('v2')?.state).toBe('v3');
  });

  it('round-trips all four official extensions (.qv, .qvbible, .qvscene, .qvstyle), routes, migration exports, and image snapping', async () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    const firstSceneId = getAllScenes(project)[0]!.scene.id;

    for (const ext of ['.qv', '.qvbible', '.qvscene', '.qvstyle'] as const) {
      const bin = await serializeQuillvibeBinary(ext, project, { sceneId: firstSceneId });
      const decoded = await parseQuillvibeInput(bin, { filenameHint: `sample${ext}` });
      expect(decoded.parsed.extension).toBe(ext);
      const applied = applyOpenedExtensionFile(decoded.parsed, project);
      expect(applied.summaryMessage.length).toBeGreaterThan(0);
    }

    expect(resolvePathToRoute('/', true).canonicalPath).toBe('/start');
    expect(resolvePathToRoute('/', false).canonicalPath).toBe('/write');
    expect(resolvePathToRoute('/help', false)).toMatchObject({ view: 'help', canonicalPath: '/help' });
    expect(resolvePathToRoute('/faq', false)).toMatchObject({ view: 'help', canonicalPath: '/faq' });
    expect(resolvePathToRoute('/course', false)).toMatchObject({ view: 'course', canonicalPath: '/course' });

    expect(buildRtfExport(project).startsWith('{\\rtf1')).toBe(true);
    expect(buildPortableMigrationMarkdown(project)).toContain('# Story Bible');
    expect(JSON.parse(buildPortableMigrationJson(project)).format).toBe('quillvibe-portable-migration-v1');

    const snapped = computeSnappedImagePosition(
      { offsetX: 197, offsetY: 14, widthPx: 200, heightPx: 140 },
      [],
      600,
      { snapGrid: true, gridPx: 12, magnetPx: 8 },
    );
    expect(snapped.offsetX).toBe(200);
    expect(snapped.guideX).toBe(300);
  });
});
