import { describe, expect, it } from 'vitest';
import { base64ToUint8Array, scanPayloadForThreats, uint8ArrayToBase64 } from '../src/core/codec';
import {
  acceptSceneAnnotation,
  addCollaborator,
  getActiveSessionPermissions,
  parseAndVerifyCoAuthorToken,
} from '../src/core/collab';
import { buildDocxBytes } from '../src/core/docx-export';
import { escapeXmlText } from '../src/core/export';
import {
  applyOpenedExtensionFile,
  exportCoverDesignArchive,
  importCoverDesignArchive,
  parseQuillvibeInput,
  serializeQuillvibeBinary,
} from '../src/core/extensions';
import { seedGraphFromProject, syncGraphNodeBackToBook } from '../src/core/graph';
import {
  createEmptyBookProject,
  deleteBookFromLibrary,
  sortLibraryBooksByLatest,
  upsertBookInLibrary,
} from '../src/core/library';
import {
  addSceneToChapter,
  deleteSceneFromProject,
  isSceneLocked,
  moveScene,
  toggleChapterLock,
  togglePartLock,
  updateSceneInProject,
} from '../src/core/manuscript';
import { extractDocxParagraphsFromXml } from '../src/core/migrate';
import { isSafeRegexPattern, validateExternalExtensionManifest } from '../src/core/plugins';
import { acceptProofreadMark } from '../src/core/proofread';
import { resolvePathToRoute, routeForState } from '../src/core/router';
import { mapAppThemeToPaperTheme, mapPaperThemeToAppTheme } from '../src/core/settings';
import { restoreSnapshotToScene } from '../src/core/snapshots';
import { createCoverVariantSnapshot, createPathLayer, sanitizeSvgMarkup } from '../src/core/cover';
import type { QuillvibeExtension } from '../src/core/types';

describe('Quillvibe v3.1.0 features', () => {
  it('generates a complete OOXML .docx ZIP package with manuscript content', () => {
    const project = createEmptyBookProject('Harbor Lights & Letters', 'M. Navarro');
    project.subtitle = 'A Coastal Novel';
    project.parts[0].chapters[0].title = 'The Low Tide';
    project.parts[0].chapters[0].scenes[0].content =
      'She held **three letters** beneath the *amber* lantern.\n\n> Remember the harbor bell.';

    const bytes = buildDocxBytes(project);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const ascii = new TextDecoder().decode(bytes);
    expect(ascii).toContain('[Content_Types].xml');
    expect(ascii).toContain('word/document.xml');
    expect(ascii).toContain('word/styles.xml');
    expect(ascii).toContain('Harbor Lights &amp; Letters');
    expect(ascii).toContain('The Low Tide');
    expect(ascii).toContain('three letters');
  });

  it('locks and unlocks parts and chapters cleanly', () => {
    const project = createEmptyBookProject('Locked Book', 'Author');
    const partId = project.parts[0].id;
    const chapId = project.parts[0].chapters[0].id;
    const sceneId = project.parts[0].chapters[0].scenes[0].id;

    expect(isSceneLocked(project, sceneId).locked).toBe(false);

    const chapLocked = toggleChapterLock(project, chapId, true);
    const chapStatus = isSceneLocked(chapLocked, sceneId);
    expect(chapStatus.locked).toBe(true);
    expect(chapStatus.scope).toBe('chapter');

    const unlocked = toggleChapterLock(chapLocked, chapId, false);
    expect(isSceneLocked(unlocked, sceneId).locked).toBe(false);

    const partLocked = togglePartLock(unlocked, partId, true);
    const partStatus = isSceneLocked(partLocked, sceneId);
    expect(partStatus.locked).toBe(true);
    expect(partStatus.scope).toBe('part');
  });

  it('links app theme and manuscript paper theme cleanly', () => {
    expect(mapAppThemeToPaperTheme('ivory')).toBe('ivory');
    expect(mapAppThemeToPaperTheme('parchment')).toBe('parchment');
    expect(mapAppThemeToPaperTheme('obsidian')).toBe('obsidian');
    expect(mapPaperThemeToAppTheme('obsidian')).toBe('obsidian');
    expect(mapPaperThemeToAppTheme('parchment')).toBe('parchment');
    expect(mapPaperThemeToAppTheme('ivory')).toBe('ivory');
  });

  it('exports, imports, and merges review comments in .qvdesign cover packages', async () => {
    const sourceBook = createEmptyBookProject('Signal Tower', 'K. Solis');
    const pathLayer = createPathLayer(
      'front',
      [
        { xPct: 20, yPct: 30 },
        { xPct: 80, yPct: 30 },
      ],
      { name: 'Horizon Rule', strokeColor: '#c7a97b', strokeWidth: 4, blendMode: 'overlay' },
    );
    sourceBook.cover = {
      ...sourceBook.cover!,
      pathLayers: [pathLayer],
      comments: [
        {
          id: 'pin-1',
          face: 'front',
          xPct: 50,
          yPct: 40,
          author: 'Cover Artist',
          text: 'Shift serif title 4% higher.',
          resolved: false,
          createdAt: '2026-11-26T00:00:00.000Z',
        },
      ],
      variants: [
        {
          id: 'var-1',
          name: 'Gold Rule Draft',
          createdAt: '2026-11-26T00:00:00.000Z',
          snapshot: createCoverVariantSnapshot(sourceBook.cover!),
        },
      ],
    };

    const bytes = await exportCoverDesignArchive(sourceBook, 'Signal Cover v1');
    const targetBook = createEmptyBookProject('Signal Tower', 'K. Solis');
    const mergedOnly = await importCoverDesignArchive(bytes, targetBook, { mergeCommentsOnly: true });
    expect(mergedOnly.project.cover?.comments?.length).toBe(1);
    expect(mergedOnly.project.cover?.pathLayers?.length ?? 0).toBe(0);

    const fullApplied = await importCoverDesignArchive(bytes, targetBook);
    expect(fullApplied.project.cover?.pathLayers?.[0]?.name).toBe('Horizon Rule');
    expect(fullApplied.project.cover?.variants?.[0]?.name).toBe('Gold Rule Draft');
  });

  it('resolves /settings and /manual standalone routes and syncs Story Graph back to Book', () => {
    expect(resolvePathToRoute('/settings').view).toBe('settings');
    expect(resolvePathToRoute('/manual').view).toBe('manual');
    expect(routeForState('settings')).toBe('/settings');
    expect(routeForState('manual')).toBe('/manual');

    const project = createEmptyBookProject('Relay Station', 'A. Lim');
    project.bible.characters.push({
      id: 'char-99',
      name: 'Elena',
      aliases: '',
      role: 'Navigator',
      motivation: 'Find the beacon',
      appearance: '',
      notes: '',
    });
    const seeded = seedGraphFromProject(project);
    project.storyGraph = seeded;
    const elenaNode = seeded.nodes.find((n) => n.refId === 'char-99');
    expect(elenaNode).toBeTruthy();

    const syncedProj = syncGraphNodeBackToBook(project, elenaNode!.id, {
      label: 'Commander Elena',
      subtitle: 'Chief Navigator',
      notes: 'Restore relay power',
    });
    expect(syncedProj.bible.characters.find((c) => c.id === 'char-99')?.name).toBe('Commander Elena');
    expect(syncedProj.bible.characters.find((c) => c.id === 'char-99')?.role).toBe('Chief Navigator');
  });

  it('encodes and decodes all 5 official QVBX extensions (unlocked, password-locked, and chunked base64)', async () => {
    const project = createEmptyBookProject('Harbor Chronicle', 'J. Reyes');
    const exts: QuillvibeExtension[] = ['.qv', '.qvbible', '.qvscene', '.qvstyle', '.qvdesign'];

    for (const ext of exts) {
      const unlockedBytes = await serializeQuillvibeBinary(ext, project);
      const parsedFromBytes = await parseQuillvibeInput(unlockedBytes, {
        filenameHint: `sample${ext}`,
      });
      expect(parsedFromBytes.parsed.extension).toBe(ext);
      expect(parsedFromBytes.isProtectedBinary).toBe(true);

      const lockedBytes = await serializeQuillvibeBinary(ext, project, {
        password: 'quill-secret-pass',
      });
      const b64WithWhitespace = `${uint8ArrayToBase64(lockedBytes).slice(0, 24)}\n${uint8ArrayToBase64(lockedBytes).slice(24)}`;
      const parsedFromB64 = await parseQuillvibeInput(b64WithWhitespace, {
        filenameHint: `locked${ext}`,
        base64Encoded: true,
        password: 'quill-secret-pass',
      });
      expect(parsedFromB64.parsed.extension).toBe(ext);

      const applied = applyOpenedExtensionFile(parsedFromB64.parsed, project);
      if (ext === '.qvdesign') {
        expect(applied.focusView).toBe('typeset');
        expect(applied.focusTypesetSubTab).toBe('cover');
      }
    }

    // Verify large multi-chunk aligned base64 round-trip (>32766 bytes)
    const bigPayload = new Uint8Array(70_000);
    for (let i = 0; i < bigPayload.length; i++) {
      bigPayload[i] = (i * 31) & 0xff;
    }
    const decodedBig = base64ToUint8Array(uint8ArrayToBase64(bigPayload));
    expect(decodedBig.length).toBe(bigPayload.length);
    expect(decodedBig[0]).toBe(bigPayload[0]);
    expect(decodedBig[69_999]).toBe(bigPayload[69_999]);
  });

  it('deletes books cleanly from library and sorts most recently modified book to the top', () => {
    const older = createEmptyBookProject('Older Draft', 'Author A');
    older.updatedAt = '2026-11-20T10:00:00.000Z';
    older.parts[0].chapters[0].scenes[0].updatedAt = '2026-11-20T10:00:00.000Z';

    const newer = createEmptyBookProject('Latest Edit', 'Author B');
    newer.updatedAt = '2026-11-25T10:00:00.000Z';
    newer.parts[0].chapters[0].scenes[0].updatedAt = '2026-11-25T10:00:00.000Z';

    const initial = { activeBookId: older.id, books: [older, newer] };
    const upserted = upsertBookInLibrary(initial, older, { touchTimestamp: false });
    expect(upserted.books[0].id).toBe(newer.id);

    const touchedOlder = upsertBookInLibrary(upserted, older, { touchTimestamp: true });
    expect(touchedOlder.books[0].id).toBe(older.id);

    const sorted = sortLibraryBooksByLatest([
      older,
      { ...newer, updatedAt: '2099-01-01T00:00:00.000Z' },
    ]);
    expect(sorted[0].id).toBe(newer.id);

    const afterDelete = deleteBookFromLibrary(touchedOlder, newer.id);
    expect(afterDelete.books.some((b) => b.id === newer.id)).toBe(false);
    expect(afterDelete.books.length).toBe(1);
    expect(afterDelete.activeBookId).toBe(older.id);
  });

  it('enforces scene locks across editing, moving, proofread marks, snapshots, annotations, and graph sync', () => {
    let project = createEmptyBookProject('Lock Guard Book', 'Primary Author');
    const chapId = project.parts[0].chapters[0].id;
    const secondAdded = addSceneToChapter(project, chapId, 'Second Scene');
    project = secondAdded.project;

    const scene = project.parts[0].chapters[0].scenes[0];
    const sceneId = scene.id;
    scene.content = 'Original immutable prose.';
    scene.proofreadMarks = [
      {
        id: 'pm-lock-1',
        kind: 'delete',
        start: 9,
        end: 18,
        originalText: 'immutable',
        replacement: '',
        note: 'Remove',
        authorName: 'Editor',
        role: 'editor',
        status: 'open',
        createdAt: '2026-11-26T00:00:00.000Z',
      },
    ];
    scene.snapshots = [
      {
        id: 'snap-lock-1',
        createdAt: '2026-11-26T00:00:00.000Z',
        label: 'Older snap',
        content: 'Old snapshot text.',
        wordCount: 3,
      },
    ];
    scene.annotations = [
      {
        id: 'ann-lock-1',
        authorName: 'CoAuthor',
        role: 'co-author',
        quote: 'Original',
        suggestion: 'Revised',
        note: 'Change word',
        status: 'open',
        createdAt: '2026-11-26T00:00:00.000Z',
      },
    ];
    const seededGraph = seedGraphFromProject(project);
    project.storyGraph = seededGraph;
    project = toggleChapterLock(project, chapId);
    expect(isSceneLocked(project, sceneId).locked).toBe(true);
    const sceneGraphNode = seededGraph.nodes.find((n) => n.kind === 'scene' && n.refId === sceneId);
    expect(sceneGraphNode).toBeTruthy();

    const updated = updateSceneInProject(project, sceneId, { content: 'Tampered' });
    expect(updated.parts[0].chapters[0].scenes[0].content).toBe('Original immutable prose.');

    const deleted = deleteSceneFromProject(project, sceneId);
    expect(deleted.project.parts[0].chapters[0].scenes.length).toBe(2);

    const moved = moveScene(project, sceneId, chapId, 1);
    expect(moved.parts[0].chapters[0].scenes[0].id).toBe(sceneId);

    const proofRes = acceptProofreadMark(project, sceneId, 'pm-lock-1');
    expect(proofRes.applied).toBe(false);
    expect(proofRes.project.parts[0].chapters[0].scenes[0].content).toBe('Original immutable prose.');

    const snapRestored = restoreSnapshotToScene(project, sceneId, 'snap-lock-1');
    expect(snapRestored.parts[0].chapters[0].scenes[0].content).toBe('Original immutable prose.');

    const annRes = acceptSceneAnnotation(project, sceneId, 'ann-lock-1');
    expect(annRes.appliedReplacement).toBe(false);
    expect(annRes.project.parts[0].chapters[0].scenes[0].content).toBe('Original immutable prose.');

    const graphSynced = syncGraphNodeBackToBook(project, sceneGraphNode!.id, {
      label: 'Hacked Title',
      notes: 'Hacked synopsis',
    });
    expect(graphSynced.parts[0].chapters[0].scenes[0].title).toBe(scene.title);
  });

  it('sanitizes dangerous SVG tags/handlers and rejects base64 SVG XSS payloads', () => {
    const cleanSvg = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>body{display:none}</style><animate attributeName="x"/><a href="https://evil.example"><rect width="10" height="10" onload="alert(1)"/></a><image href="https://tracker.example/x.png"/></svg>',
    );
    expect(cleanSvg.toLowerCase()).not.toContain('<style');
    expect(cleanSvg.toLowerCase()).not.toContain('<animate');
    expect(cleanSvg.toLowerCase()).not.toContain('<a ');
    expect(cleanSvg.toLowerCase()).not.toContain('onload');
    expect(cleanSvg.toLowerCase()).not.toContain('https://tracker.example');

    const maliciousSvgB64 = uint8ArrayToBase64(
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>',
      ),
    );
    expect(() =>
      scanPayloadForThreats({
        coverDataUrl: `data:image/svg+xml;base64,${maliciousSvgB64}`,
      }),
    ).toThrow(/Blocked SVG payload/i);
  });

  it('rejects ReDoS regex patterns and unsafe font CSS stacks in plugins', () => {
    expect(isSafeRegexPattern('((?:a+))+')).toBe(false);
    expect(isSafeRegexPattern('(a|a)+')).toBe(false);
    expect(isSafeRegexPattern('\\b[A-Z]{2,}\\b')).toBe(true);

    const badFontManifest = JSON.stringify({
      magic: 'QUILLVIBE_EXT_V2',
      id: 'ext-bad-font',
      name: 'Unsafe Font',
      version: '1.0.0',
      author: 'QA',
      description: 'Test extension',
      dataUsageSummary: 'Reads local font list only.',
      permissions: ['add:font-pack'],
      fonts: [{ id: 'bad-f', family: 'Bad', category: 'serif', cssStack: 'Georgia; } body { background:red' }],
    });
    expect(() => validateExternalExtensionManifest(badFontManifest)).toThrow(/unsafe CSS characters/i);
  });

  it('enforces ECDSA-only collaborator tokens and non-owner fallback restrictions', async () => {
    await expect(
      parseAndVerifyCoAuthorToken('QVCA1.eyJ2IjoxfQ.sha256.deadbeef'),
    ).rejects.toThrow();

    let project = createEmptyBookProject('Collab Rights', 'Alice Owner');
    project = addCollaborator(project, { name: 'Bob Reviewer', role: 'proofreader' });
    project.activeAuthorLabel = 'Unknown Stranger';

    const perms = getActiveSessionPermissions(project);
    expect(perms.isOwner).toBe(false);
    expect(perms.canEditProse).toBe(false);
    expect(perms.canExportFiles).toBe(false);
    expect(perms.canManageCollaborators).toBe(false);
    expect(perms.canProofreadOnly).toBe(true);
  });

  it('seeds Story Graph nodes with non-overlapping coordinates and handles XML control/entity edge cases', () => {
    let project = createEmptyBookProject('Graph Layout Book', 'Author');
    const chapId = project.parts[0].chapters[0].id;
    project = addSceneToChapter(project, chapId, 'Scene Two').project;
    project = addSceneToChapter(project, chapId, 'Scene Three').project;
    const seeded = seedGraphFromProject(project);
    const coords = new Set(seeded.nodes.map((n) => `${n.x},${n.y}`));
    expect(coords.size).toBe(seeded.nodes.length);

    // Pre-existing overlapping nodes should also be cleanly separated during Sync / seedGraphFromProject
    project.storyGraph = {
      ...seeded,
      nodes: seeded.nodes.map((n) => ({ ...n, x: 36, y: 36 })),
    };
    const healed = seedGraphFromProject(project);
    for (let i = 0; i < healed.nodes.length; i++) {
      for (let j = i + 1; j < healed.nodes.length; j++) {
        const a = healed.nodes[i];
        const b = healed.nodes[j];
        expect(Math.abs(a.x - b.x) >= 252 || Math.abs(a.y - b.y) >= 136).toBe(true);
      }
    }

    expect(escapeXmlText('Hello\u0000\u0008 <World> & "Test"')).toBe('Hello &lt;World&gt; &amp; &quot;Test&quot;');
    const docParas = extractDocxParagraphsFromXml(
      '<w:document><w:body><w:p><w:r><w:t>Literal &amp;lt;tag&amp;gt; &#8217;quote&#x2019;</w:t></w:r></w:p></w:body></w:document>',
    );
    expect(docParas[0].text).toBe('Literal &lt;tag&gt; ’quote’');
  });
});
