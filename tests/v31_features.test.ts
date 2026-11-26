import { describe, expect, it } from 'vitest';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../src/core/codec';
import { buildDocxBytes } from '../src/core/docx-export';
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
import { isSceneLocked, toggleChapterLock, togglePartLock } from '../src/core/manuscript';
import { resolvePathToRoute, routeForState } from '../src/core/router';
import { mapAppThemeToPaperTheme, mapPaperThemeToAppTheme } from '../src/core/settings';
import { createCoverVariantSnapshot, createPathLayer } from '../src/core/cover';
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
});
