import { describe, expect, it } from 'vitest';
import sampleBookRaw from '../examples/the-salt-cartographer.bookvibe?raw';
import sampleBibleRaw from '../examples/salt-archipelago.bvbible?raw';
import sampleSceneRaw from '../examples/harbor-bell.bvscene?raw';
import sampleStyleRaw from '../examples/classic-trade-6x9.bvstyle?raw';
import { getSceneMentions, indexBibleMentions } from '../src/core/bible';
import { ALARM_RINGTONES } from '../src/core/alarm';
import {
  acceptSceneAnnotation,
  addCollaborator,
  addSceneAnnotation,
  mergeBookRevisions,
} from '../src/core/collab';
import { validateSyncServerUrl } from '../src/core/enterprise-sync';
import {
  FONT_STACKS,
  TRIM_SPECS,
  applySmartTypography,
  buildEpubBlobBytes,
  buildEpubExportPayload,
  buildHtmlExport,
  buildMarkdownExport,
  buildPlainTextExport,
  buildPrintableBookHtml,
  computeBookPagination,
  formatChapterLabel,
} from '../src/core/export';
import {
  computeSmartAlignSnap,
  createShapeLayer,
  createTextLayer,
  sanitizeSvgMarkup,
  snapValueToGrid,
} from '../src/core/cover';
import {
  installFontPackFromExtension,
  resolveEffectiveFontCss,
  sanitizeFontFamilyName,
  validateFontBytes,
} from '../src/core/fonts';
import {
  buildEditorialHandoffReport,
  extractDocxParagraphsFromXml,
  importDocxBytesToBookProject,
  importGoogleDocsHtmlToBookProject,
  importMarkdownToBookProject,
  importPlainTextToBookProject,
  importRtfToBookProject,
} from '../src/core/migrate';
import { getPublisherProvenance, verifyPublisherProvenance } from '../src/core/provenance';
import {
  DEFAULT_SETTINGS,
  formatAppWindowTitle,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from '../src/core/settings';
import { CONTROL_REFERENCE_ITEMS } from '../src/ui/controls-catalog';
import { ICON_DIRECTORY } from '../src/ui/icon-directory';
import {
  applyExtensionPreset,
  computeManifestSha256,
  isSafeRegexPattern,
  loadExtensionAuditLog,
  loadInstalledExtensions,
  runExtensionReadabilityReport,
  runExtensionRulesOnScene,
  runExtensionTransformOnScene,
  SAMPLE_EXTERNAL_EXTENSION_JSON,
  validateExternalExtensionManifest,
} from '../src/core/plugins';
import {
  acceptAllProofreadMarks,
  acceptProofreadMark,
  addProofreadMark,
  computeCleanProofPreview,
  realignMarksAfterEdit,
  rejectProofreadMark,
  stetProofreadMark,
} from '../src/core/proofread';
import {
  ALL_OFFICIAL_EXTENSIONS,
  BOOKVIBE_EXTENSIONS,
  BOOKVIBE_MAGIC,
  QUILLVIBE_EXTENSIONS,
  QUILLVIBE_MAGIC,
  applyOpenedExtensionFile,
  parseExtensionFile,
  serializeExtensionFile,
} from '../src/core/extensions';
import { resolvePathToRoute, routeForState } from '../src/core/router';
import { COURSE_MODULES, getCourseCompletionSummary, toggleCourseLessonDone } from '../src/ui/course';
import {
  addGraphEdge,
  addGraphNode,
  applyAutoLayout,
  applyRadialLayout,
  applyTimelineFlowLayout,
  changeGraphNodeKind,
  exportGraphAsSvgString,
  seedGraphFromProject,
} from '../src/core/graph';
import { generateAuthorKeyPair, signManuscript } from '../src/core/identity';
import {
  addBookToLibrary,
  createInitialLibrary,
  deleteBookFromLibrary,
  duplicateBookInLibrary,
  normalizeProjectDefaults,
  switchActiveBook,
} from '../src/core/library';
import {
  addChapterToPart,
  addPartToProject,
  addSceneToChapter,
  countParagraphs,
  countWords,
  deleteSceneFromProject,
  estimateReadingMinutes,
  estimateStandardPages,
  findSceneContext,
  getProjectWordCount,
  moveScene,
  splitSceneAtOffset,
} from '../src/core/manuscript';
import { createStarterBookProject } from '../src/core/sample-book';
import {
  computeWordDiff,
  createSnapshotForScene,
  restoreSnapshotToScene,
} from '../src/core/snapshots';

describe('Bookvibe Official File Extension Suite', () => {
  it('registers all 6 official extensions with unique metadata and magic headers', () => {
    expect(BOOKVIBE_EXTENSIONS.map((e) => e.extension)).toEqual([
      '.bookvibe',
      '.bvibe',
      '.bvbook',
      '.bvbible',
      '.bvscene',
      '.bvstyle',
    ]);

    const project = createStarterBookProject();
    for (const def of BOOKVIBE_EXTENSIONS) {
      const json = serializeExtensionFile(def.extension, project);
      const rawObj = JSON.parse(json) as Record<string, unknown>;
      expect(rawObj.magic).toBe(BOOKVIBE_MAGIC);
      expect(rawObj.extension).toBe(def.extension);
      expect(rawObj.mimeType).toBe(def.mimeType);
      expect(rawObj.uti).toBe(def.uti);

      const parsed = parseExtensionFile(json, `sample${def.extension}`);
      expect(parsed.extension).toBe(def.extension);

      const applied = applyOpenedExtensionFile(parsed, project);
      expect(applied.project.parts.length).toBeGreaterThan(0);
      expect(applied.summaryMessage.length).toBeGreaterThan(5);
    }
  });

  it('routes each specialized extension to its matching studio workspace', () => {
    const project = createStarterBookProject();

    const sceneJson = serializeExtensionFile('.bvscene', project, { sceneId: 'scene-2' });
    const sceneApplied = applyOpenedExtensionFile(
      parseExtensionFile(sceneJson, 'draft.bvscene'),
      project,
    );
    expect(sceneApplied.focusView).toBe('editor');
    expect(sceneApplied.focusSceneId).toBe('scene-2');

    const bibleJson = serializeExtensionFile('.bvbible', project);
    const bibleApplied = applyOpenedExtensionFile(
      parseExtensionFile(bibleJson, 'atlas.bvbible'),
      project,
    );
    expect(bibleApplied.focusView).toBe('bible');

    const styleProject = structuredClone(project);
    styleProject.paperTheme = 'parchment';
    styleProject.typography.trimSize = '5x8';
    const styleJson = serializeExtensionFile('.bvstyle', styleProject, {
      presetName: 'Pocket Print',
    });
    const styleApplied = applyOpenedExtensionFile(
      parseExtensionFile(styleJson, 'pocket.bvstyle'),
      project,
    );
    expect(styleApplied.focusView).toBe('typeset');
    expect(styleApplied.project.paperTheme).toBe('parchment');
    expect(styleApplied.project.typography.trimSize).toBe('5x8');
  });

  it('builds clean HTML and Plain Text exports alongside EPUB and Markdown', () => {
    const project = createStarterBookProject();
    const html = buildHtmlExport(project);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('The Salt Cartographer');

    const txt = buildPlainTextExport(project);
    expect(txt).toContain('THE SALT CARTOGRAPHER');
    expect(txt).toContain('Chapter I: The Brass Astrolabe');
  });

  it('rejects malformed or missing magic headers and strips prototype pollution keys', () => {
    expect(() => parseExtensionFile('{"magic":"WRONG"}')).toThrow();
    expect(() => parseExtensionFile('not json')).toThrow();

    const project = createStarterBookProject();
    const malicious = serializeExtensionFile('.bvstyle', project).replace(
      '"presetName":',
      '"__proto__": {"polluted": true}, "presetName":',
    );
    const parsed = parseExtensionFile(malicious, 'safe.bvstyle');
    expect(Object.prototype.hasOwnProperty.call(parsed.payload, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('Multi-Book Library, Pen Name, Author Key & Export Security', () => {
  it('manages multiple books and preserves pen names per book', () => {
    let lib = createInitialLibrary(createStarterBookProject());
    expect(lib.books).toHaveLength(1);

    const added = addBookToLibrary(lib, 'Second Novel', 'J. R. Vance');
    lib = added.library;
    expect(lib.books).toHaveLength(2);
    expect(added.newBook.authorIdentity?.penName).toBe('J. R. Vance');

    const dup = duplicateBookInLibrary(lib, added.newBook.id);
    lib = dup.library;
    expect(lib.books).toHaveLength(3);

    lib = switchActiveBook(lib, lib.books[0].id);
    expect(lib.activeBookId).toBe(lib.books[0].id);

    lib = deleteBookFromLibrary(lib, dup.duplicated!.id);
    expect(lib.books).toHaveLength(2);
  });

  it('signs manuscript with author key and strips privateKeyJwk on every export', async () => {
    let project = createStarterBookProject();
    const pair = await generateAuthorKeyPair();
    project.authorIdentity = {
      ...project.authorIdentity!,
      ...pair,
      penName: 'E. Meridian',
      signatureText: 'E. Meridian',
    };
    project = await signManuscript(project);
    expect(project.authorIdentity?.manuscriptDigest.length).toBeGreaterThan(15);
    expect(project.authorIdentity?.privateKeyJwk).toBeTruthy();

    const exportedBookvibe = serializeExtensionFile('.bookvibe', project);
    expect(exportedBookvibe).not.toContain('privateKeyJwk');
    expect(exportedBookvibe).toContain('E. Meridian');

    const exportedBvbook = serializeExtensionFile('.bvbook', project);
    expect(exportedBvbook).not.toContain('privateKeyJwk');
  });
});

describe('Co-Authors, Proofreader Notes & Offline Desktop Sync Merge', () => {
  it('applies proofreader suggestions with snapshot backup and merges peer edits safely', () => {
    let local = createStarterBookProject();
    local = addCollaborator(local, {
      name: 'K. Lin',
      role: 'proofreader',
      creditLine: 'Line Proofreader',
    });

    local = addSceneAnnotation(local, 'scene-1', {
      authorName: 'K. Lin',
      role: 'proofreader',
      quote: 'measured nine fathoms',
      suggestion: 'sounded nine fathoms',
      note: 'Nautical precision',
    });

    const latestAnn = local.parts[0].chapters[0].scenes[0].annotations![0];
    const accepted = acceptSceneAnnotation(local, 'scene-1', latestAnn.id);
    expect(accepted.appliedReplacement).toBe(true);
    local = accepted.project;
    expect(local.parts[0].chapters[0].scenes[0].content).toContain('sounded nine fathoms');

    // Simulate offline peer edit on scene-2 with newer timestamp + conflicting edit on scene-1 with older timestamp
    const remote = structuredClone(local);
    remote.parts[0].chapters[0].scenes[1].content = 'Updated Brinehaven draft from Wi-Fi peer.';
    remote.parts[0].chapters[0].scenes[1].updatedAt = '2026-12-01T10:00:00.000Z';
    remote.parts[0].chapters[0].scenes[0].content = 'Older conflicting edit from peer.';
    remote.parts[0].chapters[0].scenes[0].updatedAt = '2026-11-10T08:00:00.000Z';

    const merged = mergeBookRevisions(local, remote, 'Peer Laptop');
    expect(merged.updatedScenes).toBe(1);
    expect(merged.conflictSnapshots).toBe(2);
    expect(merged.project.parts[0].chapters[0].scenes[1].content).toContain('Updated Brinehaven draft');
    // Older conflicting scene-1 edit did not overwrite local prose, and was preserved as snapshot
    expect(merged.project.parts[0].chapters[0].scenes[0].content).toContain('sounded nine fathoms');
    expect(
      merged.project.parts[0].chapters[0].scenes[0].snapshots.some((s) =>
        s.label.includes('Sync conflict from Peer Laptop'),
      ),
    ).toBe(true);
  });
});

describe('Interactive Story Graph & Customizable Story Bible', () => {
  it('supports seeding, interchanging node types, connecting edges, and auto-layout', () => {
    const project = normalizeProjectDefaults(createStarterBookProject());
    let graph = seedGraphFromProject(project);
    expect(graph.nodes.length).toBeGreaterThan(5);
    expect(graph.edges.length).toBeGreaterThan(2);

    const added = addGraphNode(graph, { kind: 'plot', label: 'Midpoint Storm' });
    graph = added.graph;
    graph = changeGraphNodeKind(graph, added.node.id, 'custom');
    expect(graph.nodes.find((n) => n.id === added.node.id)?.kind).toBe('custom');

    const edgeRes = addGraphEdge(graph, added.node.id, graph.nodes[0].id, 'triggers');
    graph = edgeRes.graph;
    expect(edgeRes.edge).toBeDefined();

    const laidOut = applyAutoLayout(graph);
    expect(laidOut.nodes.every((n) => n.x > 0 && n.y > 0)).toBe(true);
  });
});

describe('Manuscript Hierarchy & Counters', () => {
  it('computes accurate word, paragraph, page, and reading-time metrics', () => {
    const sample = 'First paragraph with five words.\n\n* * *\n\nSecond paragraph—hyphenated-word here.';
    expect(countWords(sample)).toBe(9);
    expect(countParagraphs(sample)).toBe(2);
    expect(estimateStandardPages(501)).toBe(3);
    expect(estimateReadingMinutes(460)).toBe(2);

    const project = createStarterBookProject();
    expect(getProjectWordCount(project)).toBeGreaterThan(150);
  });

  it('supports adding, moving across chapters, splitting, and deleting scenes', () => {
    let project = createStarterBookProject();
    const partAdded = addPartToProject(project, 'Part III');
    project = partAdded.project;
    expect(project.parts).toHaveLength(3);

    const chapAdded = addChapterToPart(project, 'part-1', 'Chapter Extra');
    project = chapAdded.project;
    const sceneAdded = addSceneToChapter(project, project.parts[0].chapters[0].id, 'Bridge Scene');
    project = sceneAdded.project;

    project = moveScene(project, 'scene-2', 'chap-2', 0);
    const movedCtx = findSceneContext(project, 'scene-2');
    expect(movedCtx?.chapter.id).toBe('chap-2');
    expect(movedCtx?.sceneIndex).toBe(0);

    const s1 = findSceneContext(project, 'scene-1')!.scene;
    const split = splitSceneAtOffset(project, 'scene-1', Math.floor(s1.content.length / 2));
    expect(split.newSceneId).toBeDefined();
    project = split.project;
    expect(findSceneContext(project, split.newSceneId!)?.scene.content.length).toBeGreaterThan(10);

    const del = deleteSceneFromProject(project, split.newSceneId!);
    expect(findSceneContext(del.project, split.newSceneId!)).toBeUndefined();
  });
});

describe('Revision Snapshots & Word-Level Diffing', () => {
  it('captures snapshots, computes word diffs, and restores safely with auto-backup', () => {
    let project = createStarterBookProject();
    const beforeSnap = createSnapshotForScene(project, 'scene-1', 'Checkpoint A');
    project = beforeSnap.project;
    expect(beforeSnap.snapshot).toBeDefined();

    const editedText = 'Tomas stood beside the iron gate with a brass lantern.';
    const diff = computeWordDiff(
      'Tomas knelt beside the iron well.',
      editedText,
    );
    expect(diff.addedWords).toBeGreaterThan(0);
    expect(diff.removedWords).toBeGreaterThan(0);
    expect(diff.tokens.some((t) => t.type === 'insert')).toBe(true);
    expect(diff.tokens.some((t) => t.type === 'delete')).toBe(true);

    project.parts[0].chapters[0].scenes[0].content = 'Completely replaced text';
    const restored = restoreSnapshotToScene(project, 'scene-1', beforeSnap.snapshot!.id);
    const ctx = findSceneContext(restored, 'scene-1')!;
    expect(ctx.scene.content).toBe(beforeSnap.snapshot!.content);
    expect(ctx.scene.snapshots[0].label).toBe('Auto-backup before restore');
  });
});

describe('Story Bible Automatic Mention Indexing', () => {
  it('detects characters, aliases, locations, and lore across scenes using boundary matching', () => {
    const project = createStarterBookProject();
    const index = indexBibleMentions(project);

    const tomas = index.get('char-tomas');
    expect(tomas).toBeDefined();
    expect(tomas!.totalOccurrences).toBeGreaterThanOrEqual(4);
    expect(tomas!.appearances.map((a) => a.sceneId)).toContain('scene-1');

    const sextant = index.get('lore-sextant');
    expect(sextant!.appearances.length).toBeGreaterThanOrEqual(2);

    const scene1 = findSceneContext(project, 'scene-1')!.scene;
    const mentions = getSceneMentions(scene1, project.bible);
    expect(mentions.map((m) => m.name)).toContain('Clara Holm');
    expect(mentions.map((m) => m.name)).toContain('Margin Sextant');
  });
});

describe('Typesetting, Smart Typography & EPUB 3 Export with Cover & Credits', () => {
  it('transforms smart quotes, em-dashes, chapter labels, Markdown, and valid EPUB 3 ZIP', () => {
    expect(applySmartTypography('"Look," she said--it is fading...')).toBe(
      '“Look,” she said—it is fading…',
    );
    expect(formatChapterLabel(4, 'roman')).toBe('Chapter IV');
    expect(formatChapterLabel(3, 'word')).toBe('Chapter Three');
    expect(formatChapterLabel(7, 'numeric')).toBe('Chapter 7');

    const project = createStarterBookProject();
    const md = buildMarkdownExport(project);
    expect(md).toContain('title: "The Salt Cartographer"');
    expect(md).toContain('## Chapter I: The Brass Astrolabe');
    expect(md).toContain('Co-Author');
    expect(md).toContain('Proofreader');

    const dummyPng = 'data:image/png;base64,iVBORw0KGgo=';
    const payload = buildEpubExportPayload(project, dummyPng);
    expect(payload.chapters).toHaveLength(3);
    expect(payload.coverImagePngBase64).toBe('iVBORw0KGgo=');
    expect(payload.creditsXhtml).toContain('Proofreader');

    const epubBytes = buildEpubBlobBytes(project, dummyPng);
    expect(epubBytes[0]).toBe(0x50);
    expect(epubBytes[1]).toBe(0x4b);
    expect(epubBytes[2]).toBe(0x03);
    expect(epubBytes[3]).toBe(0x04);
    const ascii = new TextDecoder().decode(epubBytes);
    expect(ascii).toContain('mimetypeapplication/epub+zip');
    expect(ascii).toContain('OEBPS/cover.png');
    expect(ascii).toContain('OEBPS/cover.xhtml');
  });

  it('parses and applies every double-clickable sample file in examples/', () => {
    const base = createStarterBookProject();
    const examples: Array<[string, string]> = [
      ['the-salt-cartographer.bookvibe', sampleBookRaw],
      ['salt-archipelago.bvbible', sampleBibleRaw],
      ['harbor-bell.bvscene', sampleSceneRaw],
      ['classic-trade-6x9.bvstyle', sampleStyleRaw],
    ];
    for (const [filename, raw] of examples) {
      const parsed = parseExtensionFile(raw, filename);
      const applied = applyOpenedExtensionFile(parsed, base);
      expect(applied.project.title).toBeTruthy();
      expect(applied.summaryMessage.length).toBeGreaterThan(5);
    }
  });
});

describe('Proofreading Marks Engine', () => {
  it('supports delete, insert, transpose, stet, accept, reject, clean preview, and realignment', () => {
    let project = normalizeProjectDefaults(createStarterBookProject());
    const sceneId = 'scene-1';
    const baseText = findSceneContext(project, sceneId)!.scene.content;

    // Cross out the first phrase
    const delWord = 'brass';
    const delIdx = baseText.toLowerCase().indexOf(delWord);
    expect(delIdx).toBeGreaterThan(-1);
    const addDel = addProofreadMark(project, sceneId, {
      kind: 'delete',
      start: delIdx,
      end: delIdx + delWord.length,
      authorName: 'K. Lin',
      role: 'proofreader',
    });
    project = addDel.project;

    // Mark stet on a phrase
    const stetTarget = 'nine fathoms';
    const stetIdx = baseText.indexOf(stetTarget);
    const addStet = addProofreadMark(project, sceneId, {
      kind: 'stet',
      start: stetIdx,
      end: stetIdx + stetTarget.length,
      authorName: 'K. Lin',
      role: 'proofreader',
    });
    project = stetProofreadMark(addStet.project, sceneId, addStet.mark!.id);
    expect(
      findSceneContext(project, sceneId)!.scene.proofreadMarks!.some((m) => m.status === 'stet'),
    ).toBe(true);

    // Clean preview hides deleted word while leaving prose readable
    const sceneNow = findSceneContext(project, sceneId)!;
    const clean = computeCleanProofPreview(sceneNow.scene.content, sceneNow.scene.proofreadMarks!);
    expect(clean.length).toBeLessThan(sceneNow.scene.content.length);

    // Accept deletion -> creates snapshot & removes target word
    const accepted = acceptProofreadMark(project, sceneId, addDel.mark!.id);
    expect(accepted.applied).toBe(true);
    project = accepted.project;
    const afterAccept = findSceneContext(project, sceneId)!.scene;
    expect(afterAccept.snapshots.length).toBeGreaterThan(0);

    // Realignment test + reject + acceptAll
    const extraInsert = addProofreadMark(project, sceneId, {
      kind: 'insert',
      start: 5,
      end: 5,
      replacement: 'carefully ',
      authorName: 'K. Lin',
      role: 'proofreader',
    });
    project = acceptAllProofreadMarks(extraInsert.project, sceneId);
    expect(findSceneContext(project, sceneId)!.scene.content).toContain('carefully ');

    const dummyReject = addProofreadMark(project, sceneId, {
      kind: 'comment',
      start: 0,
      end: 4,
      note: 'Check phrasing',
      authorName: 'K. Lin',
      role: 'proofreader',
    });
    const afterRej = rejectProofreadMark(dummyReject.project, sceneId, dummyReject.mark!.id);
    expect(
      findSceneContext(afterRej, sceneId)!.scene.proofreadMarks!.some((m) => m.status === 'rejected'),
    ).toBe(true);

    const realigned = realignMarksAfterEdit(
      [{ ...dummyReject.mark!, start: 20, end: 25, status: 'open' }],
      '01234567890123456789abcde',
      'XX01234567890123456789abcde',
    );
    expect(realigned[0].start).toBeGreaterThanOrEqual(0);
  });
});

describe('Sandboxed Integrated & External Extensions (.bvext)', () => {
  it('validates external manifests, blocks ReDoS & bad scopes, enforces permissions, and audits access', async () => {
    expect(isSafeRegexPattern('\\bcolor\\b')).toBe(true);
    expect(isSafeRegexPattern('(a+)+')).toBe(false);
    expect(isSafeRegexPattern('a\\1')).toBe(false);

    const manifest = validateExternalExtensionManifest(SAMPLE_EXTERNAL_EXTENSION_JSON);
    expect(manifest.id).toBe('ext.uk-house-style');
    const hash = await computeManifestSha256(SAMPLE_EXTERNAL_EXTENSION_JSON);
    expect(hash.length).toBeGreaterThanOrEqual(8);

    // Reject core impersonation, script tags, or unknown permissions
    expect(() =>
      validateExternalExtensionManifest(
        SAMPLE_EXTERNAL_EXTENSION_JSON.replace('ext.uk-house-style', 'core.fake'),
      ),
    ).toThrow();
    expect(() =>
      validateExternalExtensionManifest(
        SAMPLE_EXTERNAL_EXTENSION_JSON.replace('read:active-scene', 'fs:write-disk'),
      ),
    ).toThrow();
    expect(() =>
      validateExternalExtensionManifest(
        SAMPLE_EXTERNAL_EXTENSION_JSON.replace('Editorial Guild', '<script>alert(1)</script>'),
      ),
    ).toThrow();

    // Test permission enforcement & integrated extensions execution
    const integrated = loadInstalledExtensions();
    const proofingExt = integrated.find((e) => e.manifest.id === 'core.editorial-proofing')!;
    const transformExt = integrated.find((e) => e.manifest.id === 'core.typo-cleanup')!;
    const metricsExt = integrated.find((e) => e.manifest.id === 'core.readability-ledger')!;
    const presetExt = integrated.find((e) => e.manifest.id === 'core.print-presets')!;

    let project = normalizeProjectDefaults(createStarterBookProject());
    // Inject a color word & double space in scene-1 to test external rule + integrated cleanup
    project.parts[0].chapters[0].scenes[0].content += ' She admired the color  of the sea--dark and very deep.';

    const externalInstalled = {
      manifest,
      source: 'external' as const,
      enabled: true,
      grantedPermissions: [...manifest.permissions],
      installedAt: new Date().toISOString(),
      sha256: hash,
    };
    const ukRun = runExtensionRulesOnScene(externalInstalled, project, 'scene-1');
    expect(ukRun.addedMarks).toBeGreaterThanOrEqual(1);
    project = ukRun.project;

    // Revoking propose:proofread-marks must immediately deny execution
    expect(() =>
      runExtensionRulesOnScene(
        { ...externalInstalled, grantedPermissions: ['read:active-scene'] },
        project,
        'scene-1',
      ),
    ).toThrow(/Permission denied/);

    const proofRun = runExtensionRulesOnScene(proofingExt, project, 'scene-1');
    expect(proofRun.addedMarks).toBeGreaterThanOrEqual(2);

    const typoRun = runExtensionTransformOnScene(transformExt, 'tr-collapse-spaces', proofRun.project, 'scene-1');
    expect(typoRun.changed).toBe(true);

    const readability = runExtensionReadabilityReport(metricsExt, typoRun.project, 'scene-1');
    expect(readability.words).toBeGreaterThan(50);

    const presetProj = applyExtensionPreset(presetExt, 'preset-pocket-5x8', typoRun.project);
    expect(presetProj.typography.trimSize).toBe('5x8');

    expect(loadExtensionAuditLog().length).toBeGreaterThan(0);
  });
});

describe('Bookvibe v1.3 Beta Modules (Provenance, Settings, Fonts, Migration, Cover & Graph)', () => {
  it('computes and verifies jhonrey.com publisher provenance marks', () => {
    const prov = getPublisherProvenance('book-sample-1');
    expect(prov.publisher).toBe('jhonrey.com');
    expect(prov.mark.length).toBeGreaterThan(8);
    expect(prov.verified).toBe(true);
    expect(verifyPublisherProvenance(prov.publisher, prov.mark, 'book-sample-1')).toBe(true);
    expect(verifyPublisherProvenance(prov.publisher, 'BV-TAMPERED-0000', 'book-sample-1')).toBe(false);
    expect(verifyPublisherProvenance('other.example', prov.mark, 'book-sample-1')).toBe(false);
  });

  it('sanitizes out-of-range settings and persists round-trips cleanly', () => {
    const clamped = sanitizeSettings({
      editorFontSizePx: 99,
      uiDensity: 'x' as unknown as 'comfortable',
      editorLineHeight: 0.2,
    });
    expect(clamped.editorFontSizePx).toBe(28);
    expect(clamped.uiDensity).toBe('comfortable');
    expect(clamped.editorLineHeight).toBe(1.3);

    const saved = saveSettings({
      ...DEFAULT_SETTINGS,
      uiDensity: 'compact',
      editorFontSizePx: 20,
      developerMode: true,
    });
    const loaded = loadSettings();
    expect(loaded).toEqual(saved);
    expect(loaded.uiDensity).toBe('compact');
    expect(loaded.developerMode).toBe(true);
  });

  it('validates binary font headers, sanitizes family names, and enforces font-pack permissions', async () => {
    const pad12 = (bytes: number[]) => {
      const out = new Uint8Array(12);
      out.set(bytes);
      return out;
    };

    expect(validateFontBytes(pad12([0x00, 0x01, 0x00, 0x00]), 'Serif.ttf')).toBe('ttf');
    expect(validateFontBytes(pad12([0x4f, 0x54, 0x54, 0x4f]), 'Display.otf')).toBe('otf');
    expect(validateFontBytes(pad12([0x77, 0x4f, 0x46, 0x46]), 'Body.woff')).toBe('woff');
    expect(validateFontBytes(pad12([0x77, 0x4f, 0x46, 0x32]), 'Book.woff2')).toBe('woff2');
    expect(validateFontBytes(pad12([0x12, 0x34, 0x56, 0x78]), 'Bad.ttf')).toBeNull();
    expect(validateFontBytes(new Uint8Array([0x00, 0x01, 0x00]), 'Short.ttf')).toBeNull();

    const safeName = sanitizeFontFamilyName('My<Font>!.ttf');
    expect(safeName).not.toContain('<');
    expect(safeName).not.toContain('>');
    expect(safeName).not.toContain('.ttf');
    expect(resolveEffectiveFontCss('garamond')).toBe(FONT_STACKS.garamond.css);

    const extWithoutPerm = {
      manifest: {
        magic: 'BOOKVIBE_EXT_V1' as const,
        id: 'ext.font-test',
        name: 'Blocked Font Pack',
        version: '1.0.0',
        author: 'Test',
        description: 'Test font pack',
        kind: 'external' as const,
        permissions: ['add:font-pack' as const],
        dataUsageSummary: 'Adds custom font stacks.',
        fonts: [
          {
            id: 'font-editorial-pro',
            family: 'Editorial Pro',
            cssStack: '"Editorial Pro", serif',
            category: 'serif' as const,
          },
        ],
      },
      source: 'external' as const,
      enabled: true,
      grantedPermissions: [],
      installedAt: new Date().toISOString(),
      sha256: 'abc123',
    };
    await expect(installFontPackFromExtension(extWithoutPerm)).rejects.toThrow(/Permission denied/);
  });

  it('strips active scripts, event handlers, and javascript URIs from cover SVGs', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>evil()</script><a href="javascript:steal()"><rect width="10" height="10" onclick="xss()"/></a></svg>';
    const clean = sanitizeSvgMarkup(dirty);
    expect(clean.toLowerCase()).not.toContain('<script');
    expect(clean.toLowerCase()).not.toContain('onload=');
    expect(clean.toLowerCase()).not.toContain('onclick=');
    expect(clean.toLowerCase()).not.toContain('javascript:');
  });

  it('supports radial, timeline flow, and vector SVG export on Story Graph', () => {
    const graph = seedGraphFromProject(createStarterBookProject());
    const radial = applyRadialLayout(graph);
    const flow = applyTimelineFlowLayout(graph);
    expect(radial.nodes).toHaveLength(graph.nodes.length);
    expect(flow.nodes).toHaveLength(graph.nodes.length);
    expect(radial.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(flow.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);

    const svgOut = exportGraphAsSvgString(radial);
    expect(svgOut).toContain('<svg');
    expect(svgOut).toContain(radial.nodes[0].label);
  });

  it('imports Markdown, Plain Text, HTML, RTF, DOC XML paragraphs, and generates Editorial Handoff', () => {
    const mdBook = importMarkdownToBookProject(
      '# Harbor Chronicle\n\n## Chapter 1\nLanterns along the quay.\n\n## Chapter 2\nBells before dawn.\n',
      'harbor.md',
    );
    expect(mdBook.title).toBe('Harbor Chronicle');
    expect(mdBook.parts[0].chapters.length).toBeGreaterThanOrEqual(2);

    const txtBook = importPlainTextToBookProject('Opening note paragraph.', 'notes.txt');
    expect(txtBook.parts[0].chapters[0].scenes[0].content).toContain('Opening note paragraph.');

    const htmlBook = importGoogleDocsHtmlToBookProject(
      '<h1>Doc Title</h1><h2>Part One</h2><p>Clean imported sentence.</p>',
      'export.html',
    );
    const htmlSceneText = htmlBook.parts[0].chapters[0].scenes[0].content;
    expect(htmlSceneText).toContain('Clean imported sentence.');
    expect(htmlSceneText).not.toContain('<');

    const rtfBook = importRtfToBookProject('{\\rtf1 Hello \\par World}', 'draft.rtf');
    expect(rtfBook.parts[0].chapters[0].scenes[0].content).toContain('Hello');

    const docxParas = extractDocxParagraphsFromXml('<w:p><w:r><w:t>Hi</w:t></w:r></w:p>');
    expect(docxParas.map((p) => p.text)).toContain('Hi');

    const handoff = buildEditorialHandoffReport(createStarterBookProject());
    expect(handoff).toContain('# Editorial Handoff Sheet');
  });

  it('keeps every entry in ICON_DIRECTORY assigned to a unique icon', () => {
    const names = ICON_DIRECTORY.map((entry) => entry.icon);
    expect(new Set(names).size).toBe(names.length);
  });

  it('documents bottom sprint controls (15m/Start/Reset), sliders, levers, and dropdowns uniquely', () => {
    const ids = CONTROL_REFERENCE_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CONTROL_REFERENCE_ITEMS.every((item) => item.summary.length > 0 && item.howToUse.length > 0)).toBe(true);

    const corpus = CONTROL_REFERENCE_ITEMS.map((i) => `${i.name} ${i.howToUse} ${i.keywords}`).join(' ');
    expect(corpus).toContain('15m');
    expect(corpus).toContain('Start');
    expect(corpus).toContain('Reset');
    expect(CONTROL_REFERENCE_ITEMS.some((i) => i.controlType === 'Slider')).toBe(true);
    expect(CONTROL_REFERENCE_ITEMS.some((i) => i.controlType === 'Lever')).toBe(true);
    expect(CONTROL_REFERENCE_ITEMS.some((i) => i.controlType === 'Dropdown')).toBe(true);
  });

  it('builds physical trim-sized book PDF HTML with TOC, page numbers, and optional running headers', () => {
    expect(TRIM_SPECS.royal.cssPageSize).toBe('6.14in 9.21in');
    expect(TRIM_SPECS.letter.cssPageSize).toBe('8.5in 11in');

    const book = normalizeProjectDefaults(createStarterBookProject());
    book.typography.trimSize = 'royal';
    const paginated = computeBookPagination(book);
    expect(paginated.tocEntries.length).toBeGreaterThanOrEqual(2);
    expect(paginated.pages.some((p) => p.kind === 'toc')).toBe(true);

    const htmlWithHead = buildPrintableBookHtml(book);
    expect(htmlWithHead).toContain('@page {');
    expect(htmlWithHead).toContain('size: 6.14in 9.21in;');
    expect(htmlWithHead).toContain('margin: 0;');
    expect(htmlWithHead).toContain('Table of Contents');
    expect(htmlWithHead).toContain('class="running-head"');
    expect(htmlWithHead).toContain('class="page-footer"');

    const noHeadNoToc = normalizeProjectDefaults(book);
    noHeadNoToc.typography.runningHeader = false;
    noHeadNoToc.typography.includeTableOfContents = false;
    const htmlMinimal = buildPrintableBookHtml(noHeadNoToc);
    expect(htmlMinimal).not.toContain('class="running-head"');
    expect(htmlMinimal).not.toContain('Table of Contents');
  });

  it('resolves built-in and builtin-prefixed font keys cleanly in resolveEffectiveFontCss', () => {
    expect(resolveEffectiveFontCss('garamond', 'baskerville')).toBe(FONT_STACKS.baskerville.css);
    expect(resolveEffectiveFontCss('garamond', 'builtin:inter')).toBe(FONT_STACKS.inter.css);
    expect(resolveEffectiveFontCss('palatino')).toBe(FONT_STACKS.palatino.css);
    expect(resolveEffectiveFontCss('garamond', 'Custom Serif Face')).toContain('Custom Serif Face');
  });

  it('numbers Markdown scene-break splits sequentially without skipping Scene 2', () => {
    const mdBook = importMarkdownToBookProject(
      '# Harbor\n\n## Chapter 1\nFirst part.\n\n* * *\n\nSecond part.\n\n---\n\nThird part.\n',
      'harbor.md',
    );
    const titles = mdBook.parts[0].chapters[0].scenes.map((s) => s.title);
    expect(titles).toEqual(['Chapter 1', 'Scene 2', 'Scene 3']);
  });

  it('imports .docx ZIP entries written with bit-3 data descriptors via Central Directory', async () => {
    const enc = new TextEncoder();
    const nameBytes = enc.encode('word/document.xml');
    const xmlBytes = enc.encode(
      '<w:document><w:body><w:p><w:r><w:t>Central directory paragraph.</w:t></w:r></w:p></w:body></w:document>',
    );
    const localSize = 30 + nameBytes.length;
    const ddOffset = localSize + xmlBytes.length;
    const cdOffset = ddOffset + 16;
    const cdSize = 46 + nameBytes.length;
    const eocdOffset = cdOffset + cdSize;
    const zip = new Uint8Array(eocdOffset + 22);
    const dv = new DataView(zip.buffer);

    // Local file header with flags=0x0008 and zeroed sizes (bit-3 data descriptor style)
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0008, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(26, nameBytes.length, true);
    zip.set(nameBytes, 30);
    zip.set(xmlBytes, localSize);

    // Data descriptor
    dv.setUint32(ddOffset, 0x08074b50, true);
    dv.setUint32(ddOffset + 8, xmlBytes.length, true);
    dv.setUint32(ddOffset + 12, xmlBytes.length, true);

    // Central directory header pointing to local header offset 0
    dv.setUint32(cdOffset, 0x02014b50, true);
    dv.setUint16(cdOffset + 4, 20, true);
    dv.setUint16(cdOffset + 6, 20, true);
    dv.setUint16(cdOffset + 8, 0x0008, true);
    dv.setUint16(cdOffset + 10, 0, true);
    dv.setUint32(cdOffset + 20, xmlBytes.length, true);
    dv.setUint32(cdOffset + 24, xmlBytes.length, true);
    dv.setUint16(cdOffset + 28, nameBytes.length, true);
    dv.setUint32(cdOffset + 42, 0, true);
    zip.set(nameBytes, cdOffset + 46);

    // EOCD
    dv.setUint32(eocdOffset, 0x06054b50, true);
    dv.setUint16(eocdOffset + 8, 1, true);
    dv.setUint16(eocdOffset + 10, 1, true);
    dv.setUint32(eocdOffset + 12, cdSize, true);
    dv.setUint32(eocdOffset + 16, cdOffset, true);

    const docxBook = await importDocxBytesToBookProject(zip, 'descriptor.docx');
    expect(docxBook.parts[0].chapters[0].scenes[0].content).toContain('Central directory paragraph.');
  });

  it('defaults settings to Ivory Light theme, Basic tier, and wider writing sheet', () => {
    expect(DEFAULT_SETTINGS.appTheme).toBe('ivory');
    expect(DEFAULT_SETTINGS.toolTier).toBe('basic');
    expect(DEFAULT_SETTINGS.editorSheetMaxWidthPx).toBe(820);
    const cleaned = sanitizeSettings({
      appTheme: 'obsidian',
      toolTier: 'advanced',
      binderWidthPx: 999,
      inspectorWidthPx: 100,
    });
    expect(cleaned.appTheme).toBe('obsidian');
    expect(cleaned.toolTier).toBe('advanced');
    expect(cleaned.binderWidthPx).toBe(440);
    expect(cleaned.inspectorWidthPx).toBe(210);
  });

  it('round-trips all 6 Quillvibe extensions with QUILLVIBE_V2 header alongside legacy Bookvibe', () => {
    expect(QUILLVIBE_EXTENSIONS.map((e) => e.extension)).toEqual([
      '.quillvibe',
      '.qvibe',
      '.qvbook',
      '.qvbible',
      '.qvscene',
      '.qvstyle',
    ]);
    expect(ALL_OFFICIAL_EXTENSIONS.length).toBe(12);

    const project = createStarterBookProject();
    for (const def of QUILLVIBE_EXTENSIONS) {
      const json = serializeExtensionFile(def.extension, project);
      const raw = JSON.parse(json) as Record<string, unknown>;
      expect(raw.magic).toBe(QUILLVIBE_MAGIC);
      const parsed = parseExtensionFile(json, `book${def.extension}`);
      expect(parsed.extension).toBe(def.extension);
      const applied = applyOpenedExtensionFile(parsed, project);
      expect(applied.project.parts.length).toBeGreaterThan(0);
    }
  });

  it('creates Cover Studio shape & text layers with magnetic center snap and grid quantization', () => {
    const shape = createShapeLayer('front', 'rounded-rect', '#8c6a35');
    expect(shape.shape).toBe('rounded-rect');
    expect(shape.xPct).toBe(50);

    const txt = createTextLayer('front', 'Collector Copy', '#181a20');
    expect(txt.text).toBe('Collector Copy');

    expect(snapValueToGrid(47.3, 4, true)).toBe(48);
    const mag = computeSmartAlignSnap(49.1, 24.4, { snapGrid: true, gridStepPct: 4 });
    expect(mag.xPct).toBe(50);
    expect(mag.guideX).toBe(50);
    expect(mag.yPct).toBe(25);
    expect(mag.guideY).toBe(25);
  });

  it('routes /start, /write, /course, and /studio cleanly and tracks deep course curriculum', () => {
    expect(resolvePathToRoute('/', true)).toMatchObject({ showStartSplash: true, canonicalPath: '/start' });
    expect(resolvePathToRoute('/start', false)).toMatchObject({ showStartSplash: true, canonicalPath: '/start' });
    expect(resolvePathToRoute('/course', false)).toMatchObject({
      view: 'course',
      showStartSplash: false,
      canonicalPath: '/course',
    });
    expect(resolvePathToRoute('/studio/cover', false)).toMatchObject({
      view: 'typeset',
      typesetSubTab: 'cover',
      showStartSplash: false,
    });
    expect(routeForState('typeset', 'cover')).toBe('/studio/cover');
    expect(routeForState('course')).toBe('/course');

    expect(COURSE_MODULES.length).toBe(7);
    for (const mod of COURSE_MODULES) {
      for (const lesson of mod.lessons) {
        expect(lesson.concepts.length).toBeGreaterThanOrEqual(2);
        expect(lesson.steps.length).toBeGreaterThanOrEqual(3);
        expect(lesson.checkpoint.options.length).toBeGreaterThanOrEqual(2);
      }
    }
    toggleCourseLessonDone('m1-title', true);
    const summary = getCourseCompletionSummary();
    expect(summary.completed).toBeGreaterThanOrEqual(1);
    expect(summary.total).toBe(20);
  });

  it('formats configurable window/browser titles and validates enterprise sync security', () => {
    const project = createStarterBookProject();
    expect(
      formatAppWindowTitle({ windowTitleMode: 'book', windowTitleCustom: '' }, project, 'editor', 'interior', true),
    ).toBe('Quillvibe - The Salt Cartographer');
    expect(
      formatAppWindowTitle({ windowTitleMode: 'author', windowTitleCustom: '' }, project, 'editor', 'interior', true),
    ).toContain('Quillvibe - ');
    expect(
      formatAppWindowTitle({ windowTitleMode: 'section', windowTitleCustom: '' }, project, 'typeset', 'cover', true),
    ).toBe('Quillvibe - Book Cover Studio');
    expect(
      formatAppWindowTitle({ windowTitleMode: 'brand', windowTitleCustom: '' }, project, 'editor', 'interior', true),
    ).toBe('Quillvibe');
    expect(
      formatAppWindowTitle(
        { windowTitleMode: 'custom', windowTitleCustom: '{book} · {section} · {author}' },
        project,
        'course',
        'interior',
        false,
      ),
    ).toContain('The Salt Cartographer · Book Writing Course');

    expect(ALARM_RINGTONES.length).toBeGreaterThanOrEqual(5);

    expect(validateSyncServerUrl('https://sync.publisher.example/api/').ok).toBe(true);
    expect(validateSyncServerUrl('http://192.168.1.44:8080/').ok).toBe(true);
    expect(validateSyncServerUrl('http://localhost:3000').ok).toBe(true);
    expect(validateSyncServerUrl('http://public.example.com/sync').ok).toBe(false);
    expect(validateSyncServerUrl('https://user:secret@example.com/sync').ok).toBe(false);
    expect(validateSyncServerUrl('javascript:alert(1)').ok).toBe(false);
  });
});
