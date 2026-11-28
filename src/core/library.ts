import { defaultBookCover } from './cover';
import { seedGraphFromProject } from './graph';
import { ensureAuthorIdentity } from './identity';
import { createPartNode, newId } from './manuscript';
import {
  createStarterBookProject,
  isLocalDevMockEnabled,
} from './sample-book';
import type { BookLibraryState, BookProject } from './types';

export function normalizeProjectDefaults(raw: BookProject): BookProject {
  const next = structuredClone(raw);
  const identity = ensureAuthorIdentity(next);
  next.authorIdentity = identity;
  if (!next.author && identity.penName) {
    next.author = identity.penName;
  }
  next.collaborators = Array.isArray(next.collaborators) ? next.collaborators : [];
  next.activeAuthorLabel = next.activeAuthorLabel || identity.penName || next.author || 'Primary Author';

  next.bible = next.bible ?? { characters: [], locations: [], lore: [] };
  next.bible.characters = (next.bible.characters ?? []).map((c) => ({
    ...c,
    customFields: Array.isArray(c.customFields) ? c.customFields : [],
  }));
  next.bible.locations = (next.bible.locations ?? []).map((l) => ({
    ...l,
    customFields: Array.isArray(l.customFields) ? l.customFields : [],
  }));
  next.bible.lore = (next.bible.lore ?? []).map((lr) => ({
    ...lr,
    customFields: Array.isArray(lr.customFields) ? lr.customFields : [],
  }));
  next.bible.customCategories = Array.isArray(next.bible.customCategories)
    ? next.bible.customCategories
    : [];
  next.bible.customEntries = (next.bible.customEntries ?? []).map((e) => ({
    ...e,
    customFields: Array.isArray(e.customFields) ? e.customFields : [],
  }));

  for (const part of next.parts) {
    for (const ch of part.chapters) {
      for (const sc of ch.scenes) {
        sc.annotations = Array.isArray(sc.annotations) ? sc.annotations : [];
        sc.proofreadMarks = Array.isArray(sc.proofreadMarks) ? sc.proofreadMarks : [];
      }
    }
  }

  if (!next.storyGraph) {
    next.storyGraph = seedGraphFromProject(next);
  }
  if (!next.cover) {
    next.cover = defaultBookCover(next);
  }
  if (!next.publishing) {
    next.publishing = {
      imprintName: 'Independent',
      isbn: '',
      editionNumber: '1st Edition',
      editorialStage: 'developmental',
    };
  }
  next.typography = {
    ...next.typography,
    includeTableOfContents: next.typography.includeTableOfContents ?? true,
    includePageNumbers: next.typography.includePageNumbers ?? true,
  };
  return next;
}

export function createEmptyBookProject(title = 'Untitled Book', penName = 'Pen Name'): BookProject {
  const id = newId('book');
  const starter = createStarterBookProject();
  const empty: BookProject = {
    id,
    title: title.trim() || 'Untitled Book',
    subtitle: '',
    author: penName.trim() || 'Pen Name',
    dedication: '',
    copyrightNotice: `Copyright © ${new Date().getFullYear()} ${penName.trim() || 'Pen Name'}. All rights reserved.`,
    language: 'en',
    wordTarget: 50000,
    paperTheme: 'ivory',
    typography: structuredClone(starter.typography),
    parts: [createPartNode('Part I')],
    bible: {
      characters: [],
      locations: [],
      lore: [],
      customCategories: [],
      customEntries: [],
    },
    authorIdentity: {
      penName: penName.trim() || 'Pen Name',
      signatureText: penName.trim() || 'Pen Name',
      signatureSvgDataUrl: '',
      authorKeyId: '',
      publicKeyJwk: '',
      lastSignedAt: '',
      manuscriptDigest: '',
    },
    collaborators: [],
    activeAuthorLabel: penName.trim() || 'Pen Name',
    updatedAt: new Date().toISOString(),
  };
  return normalizeProjectDefaults(empty);
}

/**
 * Returns the latest modification timestamp (in ms) across a book and all of its scenes.
 */
export function getBookLastModifiedMs(book: BookProject): number {
  let latest = Date.parse(book.updatedAt || '');
  if (!Number.isFinite(latest)) latest = 0;
  for (const part of book.parts) {
    for (const ch of part.chapters) {
      for (const sc of ch.scenes) {
        const t = Date.parse(sc.updatedAt || '');
        if (Number.isFinite(t) && t > latest) {
          latest = t;
        }
      }
    }
  }
  return latest;
}

/**
 * Sorts a library book array so the most recently updated book appears first.
 */
export function sortLibraryBooksByLatest(books: BookProject[]): BookProject[] {
  return [...books].sort((a, b) => getBookLastModifiedMs(b) - getBookLastModifiedMs(a));
}

export function createInitialLibrary(initialBook?: BookProject): BookLibraryState {
  const defaultBook = isLocalDevMockEnabled()
    ? createStarterBookProject()
    : createEmptyBookProject('Untitled Book', 'Author');
  const first = normalizeProjectDefaults(initialBook ?? defaultBook);
  return {
    activeBookId: first.id,
    books: [first],
  };
}

export function upsertBookInLibrary(
  library: BookLibraryState,
  book: BookProject,
  options?: { touchTimestamp?: boolean },
): BookLibraryState {
  const normalized = normalizeProjectDefaults(book);
  if (options?.touchTimestamp) {
    normalized.updatedAt = new Date().toISOString();
  }
  const idx = library.books.findIndex((b) => b.id === normalized.id);
  const books = [...library.books];
  if (idx >= 0) {
    books[idx] = normalized;
  } else {
    books.push(normalized);
  }
  return {
    activeBookId: normalized.id,
    books: sortLibraryBooksByLatest(books),
  };
}

export function addBookToLibrary(
  library: BookLibraryState,
  title: string,
  penName: string,
): { library: BookLibraryState; newBook: BookProject } {
  const newBook = createEmptyBookProject(title, penName);
  return {
    library: {
      activeBookId: newBook.id,
      books: sortLibraryBooksByLatest([...library.books, newBook]),
    },
    newBook,
  };
}

export function duplicateBookInLibrary(
  library: BookLibraryState,
  bookId: string,
): { library: BookLibraryState; duplicated?: BookProject } {
  const source = library.books.find((b) => b.id === bookId);
  if (!source) return { library };
  const copy = structuredClone(source);
  copy.id = newId('book');
  copy.title = `${source.title} (Copy)`;
  copy.updatedAt = new Date().toISOString();
  if (copy.authorIdentity) {
    copy.authorIdentity.lastSignedAt = '';
    copy.authorIdentity.manuscriptDigest = '';
  }
  return {
    library: {
      activeBookId: copy.id,
      books: sortLibraryBooksByLatest([...library.books, copy]),
    },
    duplicated: copy,
  };
}

export function switchActiveBook(library: BookLibraryState, bookId: string): BookLibraryState {
  if (!library.books.some((b) => b.id === bookId)) return library;
  return {
    ...library,
    activeBookId: bookId,
  };
}

export function deleteBookFromLibrary(
  library: BookLibraryState,
  bookId: string,
): BookLibraryState {
  if (library.books.length <= 1) return library;
  const remaining = library.books.filter((b) => b.id !== bookId);
  const activeBookId = remaining.some((b) => b.id === library.activeBookId)
    ? library.activeBookId
    : remaining[0].id;
  return {
    activeBookId,
    books: remaining,
  };
}

export function getActiveBookFromLibrary(library: BookLibraryState): BookProject {
  const fallback = isLocalDevMockEnabled()
    ? createStarterBookProject()
    : createEmptyBookProject('Untitled Book', 'Author');
  return (
    library.books.find((b) => b.id === library.activeBookId) ??
    library.books[0] ??
    normalizeProjectDefaults(fallback)
  );
}
