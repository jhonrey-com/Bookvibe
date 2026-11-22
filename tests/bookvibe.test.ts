import { describe, expect, it } from 'vitest';
import sampleBookRaw from '../examples/the-salt-cartographer.bookvibe?raw';
import sampleBibleRaw from '../examples/salt-archipelago.bvbible?raw';
import sampleSceneRaw from '../examples/harbor-bell.bvscene?raw';
import sampleStyleRaw from '../examples/classic-trade-6x9.bvstyle?raw';
import { getSceneMentions, indexBibleMentions } from '../src/core/bible';
import {
  acceptSceneAnnotation,
  addCollaborator,
  addSceneAnnotation,
  mergeBookRevisions,
} from '../src/core/collab';
import {
  applySmartTypography,
  buildEpubBlobBytes,
  buildEpubExportPayload,
  buildMarkdownExport,
  formatChapterLabel,
} from '../src/core/export';
import {
  BOOKVIBE_EXTENSIONS,
  BOOKVIBE_MAGIC,
  applyOpenedExtensionFile,
  parseExtensionFile,
  serializeExtensionFile,
} from '../src/core/extensions';
import {
  addGraphEdge,
  addGraphNode,
  applyAutoLayout,
  changeGraphNodeKind,
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
