import { normalizeProjectDefaults } from './library';
import { countWords, findSceneContext, isSceneLocked, newId } from './manuscript';
import type {
  BookProject,
  CollaboratorRole,
  ProofreadMark,
  ProofreadMarkKind,
} from './types';

export interface ProofreadMarkSpec {
  kind: ProofreadMarkKind;
  label: string;
  symbol: string;
  shortDesc: string;
  fullDesc: string;
  requiresSelection: boolean;
  promptsReplacement: boolean;
  promptsNote: boolean;
  toneClass: string;
}

export const PROOFREAD_MARK_SPECS: Record<ProofreadMarkKind, ProofreadMarkSpec> = {
  delete: {
    kind: 'delete',
    label: 'Cross Out / Delete',
    symbol: '₰',
    shortDesc: 'Mark selected word or sentence for deletion.',
    fullDesc:
      'Draws a strikethrough deleatur mark through selected prose. Original text stays recoverable until accepted; accepting creates a revision snapshot first.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-del',
  },
  insert: {
    kind: 'insert',
    label: 'Caret Insert',
    symbol: '∧',
    shortDesc: 'Insert missing word or punctuation at cursor.',
    fullDesc:
      'Places a traditional proofreader caret (∧) between words to propose new text without disturbing existing sentences until approved.',
    requiresSelection: false,
    promptsReplacement: true,
    promptsNote: false,
    toneClass: 'bv-pr-ins',
  },
  substitute: {
    kind: 'substitute',
    label: 'Replace / Substitute',
    symbol: '⇄',
    shortDesc: 'Cross out phrase and propose replacement wording.',
    fullDesc:
      'Pairs a strikethrough on the existing phrase with a caret insertion beside it so author and proofreader see both versions side by side.',
    requiresSelection: true,
    promptsReplacement: true,
    promptsNote: false,
    toneClass: 'bv-pr-sub',
  },
  comment: {
    kind: 'comment',
    label: 'Margin Comment',
    symbol: 'AQ',
    shortDesc: 'Attach a copyeditor query or comment to text.',
    fullDesc:
      'Anchors an author query (AQ) to the selected phrase or cursor location for continuity checks, pacing notes, or factual questions.',
    requiresSelection: false,
    promptsReplacement: false,
    promptsNote: true,
    toneClass: 'bv-pr-comment',
  },
  highlight: {
    kind: 'highlight',
    label: 'Highlight Passage',
    symbol: '★',
    shortDesc: 'Highlight word or sentence for follow-up review.',
    fullDesc:
      'Shades the selected passage to revisit later for tone, rhythm, or consistency without altering text.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: true,
    toneClass: 'bv-pr-highlight',
  },
  transpose: {
    kind: 'transpose',
    label: 'Transpose',
    symbol: 'tr',
    shortDesc: 'Swap order of adjacent words or letters.',
    fullDesc:
      'Traditional transpose (tr) mark reverses two selected words (e.g., "ship the" -> "the ship") or swaps two middle letters in a misspelled word.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  stet: {
    kind: 'stet',
    label: 'Stet (Let Stand)',
    symbol: 'stet',
    shortDesc: 'Keep original prose unchanged ("let it stand").',
    fullDesc:
      'From the Latin for "let it stand". Draws a dotted rule beneath disputed prose to overrule a prior deletion or edit mark.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-stet',
  },
  paragraph: {
    kind: 'paragraph',
    label: 'New Paragraph',
    symbol: '¶',
    shortDesc: 'Split into a new paragraph at cursor.',
    fullDesc:
      'Inserts a pilcrow (¶) break mark to start a fresh paragraph at the selected cursor offset or word boundary.',
    requiresSelection: false,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  'run-in': {
    kind: 'run-in',
    label: 'Run-In Paragraph',
    symbol: 'no ¶',
    shortDesc: 'Merge across paragraph break.',
    fullDesc:
      'Traditional "no ¶" (run-in) mark joins separated paragraphs back into a continuous block of prose.',
    requiresSelection: false,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  closeup: {
    kind: 'closeup',
    label: 'Close Up Space',
    symbol: '⏝',
    shortDesc: 'Remove extra spaces in selection.',
    fullDesc:
      'Traditional close-up arcs (⏝) remove unwanted whitespace between words, prefixes, or punctuation.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  space: {
    kind: 'space',
    label: 'Insert Space',
    symbol: '#',
    shortDesc: 'Insert word space at cursor.',
    fullDesc:
      'Hash mark (#) indicates a missing single space between joined words or after punctuation.',
    requiresSelection: false,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  capitalize: {
    kind: 'capitalize',
    label: 'Capitalize (CAPS)',
    symbol: '≡',
    shortDesc: 'Convert selected text to uppercase.',
    fullDesc:
      'Triple-underline proof mark proposes uppercase formatting for selected text, acronyms, or headings.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  lowercase: {
    kind: 'lowercase',
    label: 'Lowercase (lc)',
    symbol: 'lc',
    shortDesc: 'Convert selected text to lowercase.',
    fullDesc:
      'Slash lowercase (lc) mark converts unintended capitals back to standard lowercase prose.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  italic: {
    kind: 'italic',
    label: 'Set Italic (ital)',
    symbol: 'ital',
    shortDesc: 'Mark selection for italic formatting.',
    fullDesc:
      'Single underline (ital) wraps selected prose in *italic* Markdown emphasis for ship names, internal thought, or foreign terms.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
  bold: {
    kind: 'bold',
    label: 'Set Bold (bf)',
    symbol: 'bf',
    shortDesc: 'Mark selection for boldface formatting.',
    fullDesc:
      'Wavy underline (bf) wraps selected prose in **bold** Markdown weight.',
    requiresSelection: true,
    promptsReplacement: false,
    promptsNote: false,
    toneClass: 'bv-pr-badge',
  },
};

export const PROOFREAD_TOOLBAR_ORDER: ProofreadMarkKind[] = [
  'delete',
  'insert',
  'substitute',
  'comment',
  'highlight',
  'transpose',
  'paragraph',
  'run-in',
  'closeup',
  'space',
  'capitalize',
  'lowercase',
  'italic',
  'bold',
  'stet',
];

export function computeAutomaticReplacement(kind: ProofreadMarkKind, selected: string): string {
  switch (kind) {
    case 'delete':
      return '';
    case 'capitalize':
      return selected.toUpperCase();
    case 'lowercase':
      return selected.toLowerCase();
    case 'italic': {
      const clean = selected.trim();
      return clean ? `*${clean}*` : selected;
    }
    case 'bold': {
      const clean = selected.trim();
      return clean ? `**${clean}**` : selected;
    }
    case 'closeup':
      return selected.replace(/\s+/g, '');
    case 'space':
      return selected.trim().length > 0 ? selected : ' ';
    case 'paragraph':
      return '\n\n';
    case 'run-in':
      return selected.includes('\n') ? selected.replace(/\s*\r?\n\s*/g, ' ') : ' ';
    case 'transpose': {
      const twoWords = selected.match(/^(\s*)(\S+)(\s+)(\S+)(\s*)$/);
      if (twoWords) {
        return `${twoWords[1]}${twoWords[4]}${twoWords[3]}${twoWords[2]}${twoWords[5]}`;
      }
      if (selected.length >= 2) {
        // Swap last two characters when single short word typo like "teh" is selected
        const head = selected.slice(0, -2);
        const a = selected[selected.length - 2];
        const b = selected[selected.length - 1];
        return `${head}${b}${a}`;
      }
      return selected;
    }
    case 'stet':
      return selected;
    default:
      return selected;
  }
}

export function resolveMarkRange(
  content: string,
  mark: Pick<ProofreadMark, 'start' | 'end' | 'originalText' | 'kind'>,
): { start: number; end: number } | null {
  const len = content.length;
  const clampedStart = Math.max(0, Math.min(len, mark.start));
  const clampedEnd = Math.max(clampedStart, Math.min(len, mark.end));

  if (!mark.originalText) {
    return { start: clampedStart, end: clampedStart };
  }

  if (content.slice(clampedStart, clampedEnd) === mark.originalText) {
    return { start: clampedStart, end: clampedEnd };
  }

  // Fallback: locate closest matching text if surrounding edits shifted offsets
  let bestIdx = -1;
  let bestDist = Infinity;
  let cursor = content.indexOf(mark.originalText);
  while (cursor !== -1) {
    const dist = Math.abs(cursor - clampedStart);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = cursor;
    }
    cursor = content.indexOf(mark.originalText, cursor + 1);
  }
  if (bestIdx >= 0) {
    return { start: bestIdx, end: bestIdx + mark.originalText.length };
  }
  return null;
}

export function addProofreadMark(
  project: BookProject,
  sceneId: string,
  input: {
    kind: ProofreadMarkKind;
    start: number;
    end: number;
    replacement?: string;
    note?: string;
    authorName: string;
    role: CollaboratorRole;
  },
): { project: BookProject; mark?: ProofreadMark } {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return { project: next };

  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const contentLen = scene.content.length;
  const start = Math.max(0, Math.min(contentLen, input.start));
  const end = Math.max(start, Math.min(contentLen, input.end));
  const originalText = scene.content.slice(start, end);

  const replacement =
    input.replacement !== undefined
      ? input.replacement
      : computeAutomaticReplacement(input.kind, originalText);

  const mark: ProofreadMark = {
    id: newId('pm'),
    kind: input.kind,
    start,
    end,
    originalText,
    replacement,
    note: (input.note ?? '').trim(),
    authorName: input.authorName.trim() || 'Proofreader',
    role: input.role,
    status: input.kind === 'stet' ? 'stet' : 'open',
    createdAt: new Date().toISOString(),
  };

  scene.proofreadMarks = [...(scene.proofreadMarks ?? []), mark].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  return { project: next, mark };
}

function isTextMutatingMark(mark: ProofreadMark): boolean {
  if (mark.kind === 'comment' || mark.kind === 'highlight' || mark.kind === 'stet') {
    return false;
  }
  return true;
}

export function applySingleMarkToText(
  content: string,
  marks: ProofreadMark[],
  targetMarkId: string,
): { content: string; marks: ProofreadMark[]; applied: boolean } {
  const clonedMarks = structuredClone(marks);
  const idx = clonedMarks.findIndex((m) => m.id === targetMarkId);
  if (idx < 0) return { content, marks: clonedMarks, applied: false };

  const target = clonedMarks[idx];
  const range = resolveMarkRange(content, target);
  if (!range) return { content, marks: clonedMarks, applied: false };

  if (!isTextMutatingMark(target)) {
    target.status = 'accepted';
    return { content, marks: clonedMarks, applied: true };
  }

  let effectiveStart = range.start;
  let effectiveEnd = range.end;
  // For run-in when cursor is near newline, expand across surrounding blank lines cleanly
  if (target.kind === 'run-in' && effectiveStart === effectiveEnd) {
    while (effectiveStart > 0 && /[\r\n\s]/.test(content[effectiveStart - 1])) effectiveStart--;
    while (effectiveEnd < content.length && /[\r\n\s]/.test(content[effectiveEnd])) effectiveEnd++;
  }

  const nextContent =
    content.slice(0, effectiveStart) + target.replacement + content.slice(effectiveEnd);
  const delta = target.replacement.length - (effectiveEnd - effectiveStart);

  target.status = 'accepted';
  for (let i = 0; i < clonedMarks.length; i++) {
    if (i === idx) continue;
    const other = clonedMarks[i];
    if (other.status !== 'open') continue;
    if (other.start >= effectiveEnd) {
      other.start = Math.max(0, other.start + delta);
      other.end = Math.max(other.start, other.end + delta);
    } else if (other.end > effectiveStart && other.end <= effectiveEnd && other.start < effectiveStart) {
      other.end = Math.max(other.start, effectiveStart + target.replacement.length);
    }
  }

  return { content: nextContent, marks: clonedMarks, applied: true };
}

export function acceptProofreadMark(
  project: BookProject,
  sceneId: string,
  markId: string,
): { project: BookProject; applied: boolean } {
  if (isSceneLocked(project, sceneId).locked) return { project, applied: false };
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return { project: next, applied: false };

  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const marks = scene.proofreadMarks ?? [];
  const target = marks.find((m) => m.id === markId);
  if (!target) return { project: next, applied: false };

  const prevContent = scene.content;
  const res = applySingleMarkToText(scene.content, marks, markId);
  if (!res.applied) return { project: next, applied: false };

  if (prevContent !== res.content) {
    const spec = PROOFREAD_MARK_SPECS[target.kind];
    scene.snapshots.unshift({
      id: newId('snap'),
      createdAt: new Date().toISOString(),
      label: `Before ${spec.label} (${target.authorName})`,
      content: prevContent,
      wordCount: countWords(prevContent),
    });
    scene.content = res.content;
    scene.updatedAt = new Date().toISOString();
  }
  scene.proofreadMarks = res.marks;
  return { project: next, applied: true };
}

export function rejectProofreadMark(
  project: BookProject,
  sceneId: string,
  markId: string,
): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;
  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const mark = (scene.proofreadMarks ?? []).find((m) => m.id === markId);
  if (mark) mark.status = 'rejected';
  return next;
}

export function stetProofreadMark(
  project: BookProject,
  sceneId: string,
  markId: string,
): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;
  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const mark = (scene.proofreadMarks ?? []).find((m) => m.id === markId);
  if (mark) mark.status = 'stet';
  return next;
}

export function updateProofreadMarkNote(
  project: BookProject,
  sceneId: string,
  markId: string,
  note: string,
): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;
  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const mark = (scene.proofreadMarks ?? []).find((m) => m.id === markId);
  if (mark) mark.note = note.trim();
  return next;
}

export function acceptAllProofreadMarks(project: BookProject, sceneId: string): BookProject {
  if (isSceneLocked(project, sceneId).locked) return project;
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;

  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  const openMarks = (scene.proofreadMarks ?? []).filter((m) => m.status === 'open');
  if (openMarks.length === 0) return next;

  const prevContent = scene.content;
  let currentContent = scene.content;
  let currentMarks = structuredClone(scene.proofreadMarks ?? []);

  // Process descending so earlier offsets stay intact
  const orderedIds = [...openMarks].sort((a, b) => b.start - a.start).map((m) => m.id);
  for (const id of orderedIds) {
    const res = applySingleMarkToText(currentContent, currentMarks, id);
    currentContent = res.content;
    currentMarks = res.marks;
  }

  if (currentContent !== prevContent) {
    scene.snapshots.unshift({
      id: newId('snap'),
      createdAt: new Date().toISOString(),
      label: `Before accepting ${openMarks.length} proofread mark(s)`,
      content: prevContent,
      wordCount: countWords(prevContent),
    });
    scene.content = currentContent;
    scene.updatedAt = new Date().toISOString();
  }
  scene.proofreadMarks = currentMarks;
  return next;
}

export function rejectAllProofreadMarks(project: BookProject, sceneId: string): BookProject {
  const next = normalizeProjectDefaults(project);
  const ctx = findSceneContext(next, sceneId);
  if (!ctx) return next;
  const scene = next.parts[ctx.partIndex].chapters[ctx.chapterIndex].scenes[ctx.sceneIndex];
  for (const mark of scene.proofreadMarks ?? []) {
    if (mark.status === 'open') mark.status = 'rejected';
  }
  return next;
}

export function computeCleanProofPreview(content: string, marks: ProofreadMark[]): string {
  const openIds = marks
    .filter((m) => m.status === 'open')
    .sort((a, b) => b.start - a.start)
    .map((m) => m.id);
  let out = content;
  let workingMarks = structuredClone(marks);
  for (const id of openIds) {
    const res = applySingleMarkToText(out, workingMarks, id);
    out = res.content;
    workingMarks = res.marks;
  }
  return out;
}

export function realignMarksAfterEdit(
  marks: ProofreadMark[] | undefined,
  prevContent: string,
  nextContent: string,
): ProofreadMark[] {
  if (!marks || marks.length === 0 || prevContent === nextContent) return marks ?? [];

  let prefix = 0;
  const minLen = Math.min(prevContent.length, nextContent.length);
  while (prefix < minLen && prevContent[prefix] === nextContent[prefix]) {
    prefix++;
  }

  let prevSuffix = prevContent.length;
  let nextSuffix = nextContent.length;
  while (
    prevSuffix > prefix &&
    nextSuffix > prefix &&
    prevContent[prevSuffix - 1] === nextContent[nextSuffix - 1]
  ) {
    prevSuffix--;
    nextSuffix--;
  }

  const delta = nextSuffix - prevSuffix;
  return marks.map((m) => {
    if (m.status !== 'open' && m.status !== 'stet') return m;
    if (m.start >= prevSuffix) {
      return {
        ...m,
        start: Math.max(0, m.start + delta),
        end: Math.max(0, m.end + delta),
      };
    }
    const relocated = resolveMarkRange(nextContent, m);
    if (relocated) {
      return { ...m, start: relocated.start, end: relocated.end };
    }
    return m;
  });
}
