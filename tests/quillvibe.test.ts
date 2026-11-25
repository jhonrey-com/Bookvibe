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
import { routeConnector } from '../src/core/connector-router';
import {
  alignBoxes,
  computeStudioSmartSnap,
  computeUnifiedBounds,
  CoordinateSystem,
  scaleBoxesAroundPivot,
} from '../src/core/cover-studio-math';
import {
  findShortestNarrativePath,
  ForceGraphSimulation,
  getNeighborhoodIds,
  resolveNodeColorByRules,
} from '../src/core/force-engine';
import {
  exportStoryGraphToJsonCanvas,
  extractWikilinksAndTags,
  importJsonCanvasToStoryGraph,
  syncWikilinkEdgesInGraph,
} from '../src/core/graph-canvas-io';
import { ProjectHistoryStack } from '../src/core/history';
import { validateExternalExtensionManifest } from '../src/core/plugins';
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
    expect(resolvePathToRoute('/developer', false)).toMatchObject({ view: 'developer', canonicalPath: '/developer' });
    expect(resolvePathToRoute('/developers', false)).toMatchObject({ view: 'developer', canonicalPath: '/developer' });

    const validExt = validateExternalExtensionManifest(
      JSON.stringify({
        magic: 'QUILLVIBE_EXT_V2',
        id: 'press.test-ext',
        name: 'Test Style Pack',
        version: '1.0.0',
        author: 'jhonrey.com',
        description: 'Sample ruleset',
        dataUsageSummary: 'Reads active scene.',
        permissions: ['read:active-scene', 'propose:proofread-marks'],
        rules: [
          { id: 'r1', label: 'Double hyphen', pattern: '--', markKind: 'substitute', replacement: '—', note: 'Use em-dash' },
        ],
      }),
    );
    expect(validExt.id).toBe('press.test-ext');
    expect(() =>
      validateExternalExtensionManifest(
        JSON.stringify({
          magic: 'QUILLVIBE_EXT_V2',
          id: 'core.impersonate',
          name: 'Bad',
          version: '1.0.0',
          author: 'Dev',
          description: 'Bad',
          dataUsageSummary: 'None',
          permissions: ['read:active-scene'],
        }),
      ),
    ).toThrow(/reserved/i);
    expect(() =>
      validateExternalExtensionManifest(
        JSON.stringify({
          magic: 'QUILLVIBE_EXT_V2',
          id: 'dev.redos',
          name: 'ReDoS Test',
          version: '1.0.0',
          author: 'Dev',
          description: 'Test',
          dataUsageSummary: 'None',
          permissions: ['read:active-scene', 'propose:proofread-marks'],
          rules: [
            { id: 'bad', label: 'Evil', pattern: '(a+)+', markKind: 'comment', note: 'Unsafe' },
          ],
        }),
      ),
    ).toThrow(/unsafe/i);

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

describe('Cover Studio Math, Smart Snap, Storyboard Router & Force Graph', () => {
  it('inverts screen/world coordinates across zoom & pan and snaps cleanly within 5px screen threshold', () => {
    const coord = new CoordinateSystem({
      artboardWidth: 400,
      artboardHeight: 600,
      zoom: 2,
      panX: 80,
      panY: 40,
      originX: 20,
      originY: 10,
    });
    const pt = coord.worldToScreen(25, 50);
    const back = coord.screenToWorld(pt.x, pt.y);
    expect(back.x).toBeCloseTo(25, 4);
    expect(back.y).toBeCloseTo(50, 4);

    // Card centered near 50% X snaps strictly when within 5px, and bypasses when disabled (Ctrl held)
    const snapOn = computeStudioSmartSnap(
      { id: 'moving', left: 39.8, top: 20, width: 20, height: 10 },
      [],
      coord,
      { disabled: false },
    );
    expect(snapOn.snappedLeftPct).toBe(40);
    expect(snapOn.guides.some((g) => g.orientation === 'vertical' && g.positionPct === 50)).toBe(true);

    const snapBypass = computeStudioSmartSnap(
      { id: 'moving', left: 39.8, top: 20, width: 20, height: 10 },
      [],
      coord,
      { disabled: true },
    );
    expect(snapBypass.snappedLeftPct).toBe(39.8);
    expect(snapBypass.guides).toHaveLength(0);

    // Equal spacing across 3 items triggers spacing badge indicators
    const siblings = [
      { id: 'a', left: 10, top: 20, width: 10, height: 10 },
      { id: 'b', left: 30, top: 20, width: 10, height: 10 },
    ];
    const spacingSnap = computeStudioSmartSnap(
      { id: 'c', left: 50.2, top: 20, width: 10, height: 10 },
      siblings,
      new CoordinateSystem({ artboardWidth: 400, artboardHeight: 600, zoom: 1 }),
    );
    expect(spacingSnap.snappedLeftPct).toBe(50);
    expect(spacingSnap.spacingBadges.length).toBeGreaterThanOrEqual(2);

    const bounds = computeUnifiedBounds(siblings)!;
    expect(bounds).toMatchObject({ left: 10, top: 20, width: 30, height: 10 });
    const scaled = scaleBoxesAroundPivot(siblings, bounds, { ...bounds, width: 60 });
    expect(scaled.get('b')?.left).toBe(50);

    const aligned = alignBoxes(siblings, 'tidy');
    expect(aligned.get('b')?.left).toBe(aligned.get('a')?.left);
  });

  it('routes orthogonal elbow, curved Bezier, and straight edge-clipped connectors around obstacles', () => {
    const src = { id: 'n1', x: 0, y: 100, width: 160, height: 80 };
    const dst = { id: 'n2', x: 400, y: 100, width: 160, height: 80 };
    const blocker = { id: 'obs', x: 220, y: 60, width: 120, height: 160 };

    const elbow = routeConnector({
      sourceBox: src,
      targetBox: dst,
      routingMode: 'elbow',
      obstacles: [src, dst, blocker],
    });
    expect(elbow.d).toContain('Q ');
    expect(elbow.midHandle).not.toBeNull();
    // Detour path avoids vertical pass straight through the blocker card
    expect(elbow.labelPoint.y < blocker.y || elbow.labelPoint.y > blocker.y + blocker.height).toBe(true);

    const curved = routeConnector({ sourceBox: src, targetBox: dst, routingMode: 'curved' });
    expect(curved.d).toContain(' C ');
    expect(curved.sourceSide).toBe('right');
    expect(curved.targetSide).toBe('left');

    const straight = routeConnector({ sourceBox: src, targetBox: dst, routingMode: 'straight' });
    expect(straight.startPoint.x).toBe(160);
    expect(straight.endPoint.x).toBe(400);
  });

  it('runs ForceGraphSimulation with pins, isolates hop neighborhoods, finds shortest path, and round-trips .canvas + wikilinks', () => {
    const graph = {
      nodes: [
        { id: 'a', kind: 'character' as const, label: 'Aria', subtitle: 'Protagonist', x: 100, y: 100, color: '#c7a97b', notes: 'Allies with [[Rook]] #hero', pinned: true },
        { id: 'b', kind: 'character' as const, label: 'Rook', subtitle: 'Captain', x: 120, y: 100, color: '#c7a97b', notes: '' },
        { id: 'c', kind: 'faction' as const, label: 'Iron Guild', subtitle: 'Faction', x: 300, y: 200, color: '#e06c75', notes: '', tags: ['guild'] },
      ],
      edges: [
        { id: 'e1', sourceId: 'a', targetId: 'b', label: 'trusts', style: 'solid' as const, color: '#c7a97b' },
        { id: 'e2', sourceId: 'b', targetId: 'c', label: 'defected from', style: 'dashed' as const, color: '#e06c75' },
      ],
      groups: [{ id: 'g1', label: 'Act I', x: 40, y: 40, width: 380, height: 240, color: '#c7a97b' }],
      colorRules: [{ id: 'r1', query: 'kind:faction', color: '#ff5555' }],
    };

    const sim = new ForceGraphSimulation(graph);
    sim.runSteps(20);
    expect(sim.bodies.get('a')?.x).toBe(100);
    expect(sim.bodies.get('b')?.x).not.toBe(120);

    expect(Array.from(getNeighborhoodIds(graph, 'a', 1))).toEqual(['a', 'b']);
    expect(findShortestNarrativePath(graph, 'a', 'c')).toEqual({
      nodeIds: ['a', 'b', 'c'],
      edgeIds: ['e1', 'e2'],
    });
    expect(resolveNodeColorByRules(graph.nodes[2], graph.colorRules)).toBe('#ff5555');

    const parsed = extractWikilinksAndTags('See [[Aria]] and [[New Oracle]] #mystery');
    expect(parsed.links).toEqual(['Aria', 'New Oracle']);
    expect(parsed.tags).toEqual(['mystery']);

    const synced = syncWikilinkEdgesInGraph(graph, 'a', 'Works with [[Rook]] and [[Vesper]] #act1');
    expect(synced.nodes.some((n) => n.label === 'Vesper')).toBe(true);
    expect(synced.edges.some((e) => e.label === 'wikilink')).toBe(true);

    const canvasJson = exportStoryGraphToJsonCanvas(graph);
    const reimported = importJsonCanvasToStoryGraph(canvasJson);
    expect(reimported.groups).toHaveLength(1);
    expect(reimported.nodes).toHaveLength(3);
    expect(reimported.edges).toHaveLength(2);
  });
});
