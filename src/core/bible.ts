import { getAllScenes } from './manuscript';
import type {
  BookProject,
  CharacterEntry,
  LocationEntry,
  LoreEntry,
  SceneNode,
  StoryBible,
} from './types';

export interface SceneAppearance {
  sceneId: string;
  sceneTitle: string;
  chapterTitle: string;
  occurrences: number;
}

export interface BibleEntityMatch {
  entryId: string;
  kind: 'character' | 'location' | 'lore';
  name: string;
  subtitle: string;
  totalOccurrences: number;
  appearances: SceneAppearance[];
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitSearchTerms(primary: string, aliases = ''): string[] {
  const parts = [primary, ...aliases.split(',')]
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  // Deduplicate case-insensitively while preferring longer terms first
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const term of parts.sort((a, b) => b.length - a.length)) {
    const key = term.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(term);
    }
  }
  return unique;
}

export function countTermOccurrences(text: string, terms: string[]): number {
  if (!text.trim() || terms.length === 0) return 0;
  const pattern = terms.map(escapeRegExp).join('|');
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'giu');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export function indexBibleMentions(project: BookProject): Map<string, BibleEntityMatch> {
  const scenes = getAllScenes(project);
  const index = new Map<string, BibleEntityMatch>();

  const registerEntity = (
    entryId: string,
    kind: 'character' | 'location' | 'lore',
    name: string,
    subtitle: string,
    terms: string[],
  ) => {
    const appearances: SceneAppearance[] = [];
    let totalOccurrences = 0;

    for (const item of scenes) {
      const searchable = `${item.scene.title}\n${item.scene.content}\n${item.scene.pov}\n${item.scene.location}`;
      const count = countTermOccurrences(searchable, terms);
      if (count > 0) {
        totalOccurrences += count;
        appearances.push({
          sceneId: item.scene.id,
          sceneTitle: item.scene.title,
          chapterTitle: item.chapter.title,
          occurrences: count,
        });
      }
    }

    index.set(entryId, {
      entryId,
      kind,
      name,
      subtitle,
      totalOccurrences,
      appearances,
    });
  };

  for (const ch of project.bible.characters) {
    registerEntity(ch.id, 'character', ch.name, ch.role, splitSearchTerms(ch.name, ch.aliases));
  }
  for (const loc of project.bible.locations) {
    registerEntity(loc.id, 'location', loc.name, loc.region, splitSearchTerms(loc.name));
  }
  for (const lore of project.bible.lore) {
    registerEntity(lore.id, 'lore', lore.name, lore.category, splitSearchTerms(lore.name));
  }

  return index;
}

export function getSceneMentions(
  scene: SceneNode,
  bible: StoryBible,
): Array<{ id: string; kind: 'character' | 'location' | 'lore'; name: string; subtitle: string; count: number }> {
  const searchable = `${scene.title}\n${scene.content}\n${scene.pov}\n${scene.location}`;
  const detected: Array<{
    id: string;
    kind: 'character' | 'location' | 'lore';
    name: string;
    subtitle: string;
    count: number;
  }> = [];

  for (const ch of bible.characters) {
    const count = countTermOccurrences(searchable, splitSearchTerms(ch.name, ch.aliases));
    if (count > 0) {
      detected.push({ id: ch.id, kind: 'character', name: ch.name, subtitle: ch.role, count });
    }
  }
  for (const loc of bible.locations) {
    const count = countTermOccurrences(searchable, splitSearchTerms(loc.name));
    if (count > 0) {
      detected.push({ id: loc.id, kind: 'location', name: loc.name, subtitle: loc.region, count });
    }
  }
  for (const lore of bible.lore) {
    const count = countTermOccurrences(searchable, splitSearchTerms(lore.name));
    if (count > 0) {
      detected.push({ id: lore.id, kind: 'lore', name: lore.name, subtitle: lore.category, count });
    }
  }

  return detected.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function upsertCharacter(project: BookProject, entry: CharacterEntry): BookProject {
  const next = structuredClone(project);
  const idx = next.bible.characters.findIndex((c) => c.id === entry.id);
  if (idx >= 0) next.bible.characters[idx] = entry;
  else next.bible.characters.push(entry);
  return next;
}

export function upsertLocation(project: BookProject, entry: LocationEntry): BookProject {
  const next = structuredClone(project);
  const idx = next.bible.locations.findIndex((l) => l.id === entry.id);
  if (idx >= 0) next.bible.locations[idx] = entry;
  else next.bible.locations.push(entry);
  return next;
}

export function upsertLore(project: BookProject, entry: LoreEntry): BookProject {
  const next = structuredClone(project);
  const idx = next.bible.lore.findIndex((l) => l.id === entry.id);
  if (idx >= 0) next.bible.lore[idx] = entry;
  else next.bible.lore.push(entry);
  return next;
}
