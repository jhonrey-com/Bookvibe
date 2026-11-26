import { describe, expect, it } from 'vitest';
import { buildDocxBytes } from '../src/core/docx-export';
import { exportCoverDesignArchive, importCoverDesignArchive } from '../src/core/extensions';
import { seedGraphFromProject, syncGraphNodeBackToBook } from '../src/core/graph';
import { createEmptyBookProject } from '../src/core/library';
import { isSceneLocked, toggleChapterLock, togglePartLock } from '../src/core/manuscript';
import { resolvePathToRoute, routeForState } from '../src/core/router';
import { mapAppThemeToPaperTheme, mapPaperThemeToAppTheme } from '../src/core/settings';
import { createCoverVariantSnapshot, createPathLayer } from '../src/core/cover';

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
});
