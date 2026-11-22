import { formatChapterLabel } from './export';
import { ensureAuthorIdentity } from './identity';
import { createEmptyBookProject } from './library';
import { countWords, getAllScenes, newId } from './manuscript';
import { getPublisherProvenance } from './provenance';
import type { BookProject, ChapterNode, PartNode, SceneNode } from './types';

function makeScene(title: string, content: string): SceneNode {
  return {
    id: newId('scene'),
    title: title.trim() || 'Opening Scene',
    synopsis: '',
    status: 'draft',
    pov: '',
    location: '',
    timeline: '',
    wordTarget: Math.max(500, Math.round(countWords(content) / 100) * 100),
    content: content.trim(),
    notes: '',
    snapshots: [],
    annotations: [],
    proofreadMarks: [],
    updatedAt: new Date().toISOString(),
  };
}

function makeChapter(title: string, scenes: SceneNode[]): ChapterNode {
  return {
    id: newId('chap'),
    title: title.trim() || 'Chapter I',
    subtitle: '',
    collapsed: false,
    scenes: scenes.length > 0 ? scenes : [makeScene('Scene 1', '')],
  };
}

function finalizeImportedBook(
  title: string,
  penName: string,
  chapters: ChapterNode[],
): BookProject {
  const base = createEmptyBookProject(title || 'Imported Manuscript', penName || 'Author');
  const part: PartNode = {
    id: newId('part'),
    title: 'Part I',
    collapsed: false,
    chapters: chapters.length > 0 ? chapters : [makeChapter('Chapter 1', [makeScene('Opening Scene', '')])],
  };
  base.parts = [part];
  return base;
}

export function importMarkdownToBookProject(rawMarkdown: string, filename = 'Imported Book'): BookProject {
  const lines = rawMarkdown.replace(/\r\n/g, '\n').split('\n');
  let title = filename.replace(/\.(md|markdown|txt)$/i, '') || 'Imported Book';
  let author = 'Author';

  let cursor = 0;
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        cursor = i + 1;
        break;
      }
      const mTitle = lines[i].match(/^title:\s*"?(.+?)"?$/i);
      if (mTitle) title = mTitle[1].trim();
      const mAuth = lines[i].match(/^author:\s*"?(.+?)"?$/i);
      if (mAuth) author = mAuth[1].trim();
    }
  }

  const chapters: ChapterNode[] = [];
  let currentChapTitle = 'Chapter 1';
  let currentSceneTitle = 'Scene 1';
  let buffer: string[] = [];
  let chapScenes: SceneNode[] = [];

  const flushScene = () => {
    const prose = buffer.join('\n').trim();
    if (prose.length > 0 || chapScenes.length === 0) {
      if (prose.length > 0) {
        chapScenes.push(makeScene(currentSceneTitle, prose));
      }
    }
    buffer = [];
  };

  const flushChapter = () => {
    flushScene();
    if (chapScenes.length > 0) {
      chapters.push(makeChapter(currentChapTitle, chapScenes));
    }
    chapScenes = [];
  };

  for (let i = cursor; i < lines.length; i++) {
    const line = lines[i];
    if (/^#\s+/.test(line) && chapters.length === 0 && chapScenes.length === 0 && buffer.join('').trim() === '') {
      title = line.replace(/^#\s+/, '').trim() || title;
      continue;
    }
    if (/^##\s+/.test(line) || /^CHAPTER\s+[A-Z0-9]+/i.test(line.trim())) {
      flushChapter();
      currentChapTitle = line.replace(/^##\s+/, '').trim();
      currentSceneTitle = currentChapTitle;
      continue;
    }
    if (/^###\s+/.test(line)) {
      flushScene();
      currentSceneTitle = line.replace(/^###\s+/, '').trim() || `Scene ${chapScenes.length + 1}`;
      continue;
    }
    if (/^\*\s*\*\s*\*$/.test(line.trim()) || /^---+$/.test(line.trim())) {
      flushScene();
      currentSceneTitle = `Scene ${chapScenes.length + 2}`;
      continue;
    }
    buffer.push(line);
  }
  flushChapter();

  if (chapters.length === 0) {
    const body = lines.slice(cursor).join('\n').trim();
    chapters.push(makeChapter('Chapter 1', [makeScene('Opening Scene', body)]));
  }

  return finalizeImportedBook(title, author, chapters);
}

export function importPlainTextToBookProject(rawText: string, filename = 'Imported Draft.txt'): BookProject {
  const normalized = rawText.replace(/\r\n/g, '\n');
  if (/^CHAPTER\s+[A-Z0-9]+/im.test(normalized)) {
    return importMarkdownToBookProject(normalized, filename);
  }
  const sections = normalized.split(/\n{3,}|\n\s*\*\s*\*\s*\*\s*\n/).map((s) => s.trim()).filter(Boolean);
  const scenes = (sections.length > 0 ? sections : [normalized.trim()]).map((s, idx) =>
    makeScene(`Scene ${idx + 1}`, s),
  );
  const title = filename.replace(/\.(txt|text)$/i, '') || 'Imported Text';
  return finalizeImportedBook(title, 'Author', [makeChapter('Chapter 1', scenes)]);
}

function domNodeToInlineMarkdown(node: Node): string {
  if (node.nodeType === 3) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(domNodeToInlineMarkdown).join('');
  if (!inner) return '';
  if (tag === 'strong' || tag === 'b') return `**${inner}**`;
  if (tag === 'em' || tag === 'i') return `*${inner}*`;
  if (tag === 'blockquote') return `> ${inner.trim()}`;
  if (tag === 'br') return '\n';
  return inner;
}

export function importGoogleDocsHtmlToBookProject(
  rawHtml: string,
  filename = 'Google Docs Import.html',
): BookProject {
  const fallbackTitle = filename.replace(/\.html?$/i, '') || 'Google Docs Import';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const titleEl = doc.querySelector('h1, .title, title');
    const title = titleEl?.textContent?.trim() || fallbackTitle;
    const mdLines: string[] = [`# ${title}`, ''];
    const blocks = doc.body.querySelectorAll('h1, h2, h3, p, blockquote, li');
    blocks.forEach((blk) => {
      const tag = blk.tagName.toLowerCase();
      const txt = domNodeToInlineMarkdown(blk).trim();
      if (!txt) return;
      if (tag === 'h1' && txt === title) return;
      if (tag === 'h1' || tag === 'h2') mdLines.push('', `## ${txt}`, '');
      else if (tag === 'h3') mdLines.push('', `### ${txt}`, '');
      else if (tag === 'blockquote') mdLines.push('', `> ${txt}`, '');
      else if (tag === 'li') mdLines.push(`- ${txt}`);
      else mdLines.push(txt, '');
    });
    return importMarkdownToBookProject(mdLines.join('\n'), fallbackTitle);
  }

  // Node fallback without DOMParser
  const stripped = rawHtml
    .replace(/<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/gi, '\n## $2\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g, '');
  return importMarkdownToBookProject(stripped, fallbackTitle);
}

export function importRtfToBookProject(rawRtf: string, filename = 'Draft.rtf'): BookProject {
  // Basic clean RTF text extractor (strips fonttbl/colortbl/stylesheet groups and RTF control words)
  const text = rawRtf
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, '')
    .replace(/\\par\b/g, '\n\n')
    .replace(/\\line\b/g, '\n')
    .replace(/\\tab\b/g, '  ')
    .replace(/\\'[0-9a-f]{2}/gi, '')
    .replace(/\\[a-z]+-?\d*\s?/gi, '')
    .replace(/[{}]/g, '')
    .trim();
  return importPlainTextToBookProject(text, filename.replace(/\.rtf$/i, ''));
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractDocxParagraphsFromXml(xml: string): Array<{ headingLevel: number; text: string }> {
  const out: Array<{ headingLevel: number; text: string }> = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pRegex.exec(xml)) !== null) {
    const pInner = pm[1];
    const styleMatch = pInner.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
    const styleName = (styleMatch?.[1] ?? '').toLowerCase();
    let headingLevel = 0;
    if (styleName.includes('heading1') || styleName === 'title') headingLevel = 1;
    else if (styleName.includes('heading2')) headingLevel = 2;
    else if (styleName.includes('heading3')) headingLevel = 3;

    const runs: string[] = [];
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRegex.exec(pInner)) !== null) {
      runs.push(decodeXmlEntities(tm[1]));
    }
    const text = runs.join('').trim();
    if (text) out.push({ headingLevel, text });
  }
  return out;
}

async function readStoredOrDeflateEntry(bytes: Uint8Array, method: number): Promise<string> {
  if (method === 0) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  if (method === 8 && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    void writer.write(copy);
    void writer.close();
    const res = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder('utf-8').decode(res);
  }
  throw new Error('Unable to decompress .docx deflate entry in this environment.');
}

export async function importDocxBytesToBookProject(
  bytes: Uint8Array,
  filename = 'Manuscript.docx',
): Promise<BookProject> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let documentXml = '';

  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder('utf-8').decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) break;

    if (name === 'word/document.xml') {
      documentXml = await readStoredOrDeflateEntry(bytes.subarray(dataStart, dataEnd), method);
      break;
    }
    offset = dataEnd;
  }

  if (!documentXml) {
    throw new Error('Selected file is not a valid Word (.docx) document with word/document.xml.');
  }

  const paras = extractDocxParagraphsFromXml(documentXml);
  const lines: string[] = [];
  let title = filename.replace(/\.docx$/i, '') || 'Word Import';

  paras.forEach((p, idx) => {
    if (idx === 0 && p.headingLevel === 1) {
      title = p.text;
      lines.push(`# ${p.text}`, '');
    } else if (p.headingLevel === 1 || p.headingLevel === 2) {
      lines.push('', `## ${p.text}`, '');
    } else if (p.headingLevel === 3) {
      lines.push('', `### ${p.text}`, '');
    } else {
      lines.push(p.text, '');
    }
  });

  return importMarkdownToBookProject(lines.join('\n'), title);
}

export async function importAnyExternalDocumentFile(file: File): Promise<BookProject> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    return importDocxBytesToBookProject(buf, file.name);
  }
  const text = await file.text();
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return importGoogleDocsHtmlToBookProject(text, file.name);
  }
  if (name.endsWith('.rtf')) {
    return importRtfToBookProject(text, file.name);
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return importMarkdownToBookProject(text, file.name);
  }
  return importPlainTextToBookProject(text, file.name);
}

export function buildEditorialHandoffReport(project: BookProject): string {
  const identity = ensureAuthorIdentity(project);
  const prov = getPublisherProvenance(project.id);
  const scenes = getAllScenes(project);
  const totalWords = scenes.reduce((acc, s) => acc + countWords(s.scene.content), 0);
  const openMarks = scenes.reduce(
    (acc, s) => acc + (s.scene.proofreadMarks ?? []).filter((m) => m.status === 'open').length,
    0,
  );
  const openNotes = scenes.reduce(
    (acc, s) => acc + (s.scene.annotations ?? []).filter((a) => a.status === 'open').length,
    0,
  );

  const lines: string[] = [
    `# Editorial Handoff Sheet — ${project.title}`,
    '',
    `- **Pen Name / Author**: ${identity.penName || project.author}`,
    `- **Imprint**: ${project.publishing?.imprintName || 'Independent'}`,
    `- **ISBN / Catalog ID**: ${project.publishing?.isbn || 'Unassigned'}`,
    `- **Edition**: ${project.publishing?.editionNumber || '1st Edition'}`,
    `- **Editorial Stage**: ${project.publishing?.editorialStage || 'draft'}`,
    `- **Total Word Count**: ${totalWords.toLocaleString()} words across ${scenes.length} scene(s)`,
    `- **Open Proofread Items**: ${openMarks} mark(s) · ${openNotes} comment(s)`,
    `- **Author Key ID**: ${identity.authorKeyId || 'Not generated'}`,
    `- **Bookvibe Build Mark**: ${prov.mark}`,
    '',
    '## Credits & Collaborators',
  ];

  if (!project.collaborators || project.collaborators.length === 0) {
    lines.push('- Solo authorship');
  } else {
    for (const c of project.collaborators) {
      lines.push(`- ${c.creditLine} (${c.role}${c.authorKeyId ? ` · Key ${c.authorKeyId}` : ''})`);
    }
  }

  lines.push('', '## Chapter Breakdown');
  let chapNum = 0;
  for (const part of project.parts) {
    for (const chap of part.chapters) {
      chapNum++;
      const chWords = chap.scenes.reduce((acc, s) => acc + countWords(s.content), 0);
      lines.push(
        `- ${formatChapterLabel(chapNum, project.typography.chapterNumeralStyle)}: ${chap.title} (${chWords.toLocaleString()} words, ${chap.scenes.length} scene(s))`,
      );
    }
  }

  return lines.join('\n') + '\n';
}
