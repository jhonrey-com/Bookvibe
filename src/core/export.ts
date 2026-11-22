import { COLLABORATOR_ROLE_LABELS } from './collab';
import { ensureAuthorIdentity } from './identity';
import { getProjectWordCount } from './manuscript';
import type {
  BookProject,
  ChapterNumeralStyle,
  FontFamilyId,
  TrimSize,
} from './types';

export interface TrimSpec {
  id: TrimSize;
  label: string;
  widthIn: number;
  heightIn: number;
  cssPageSize: string;
}

export const TRIM_SPECS: Record<TrimSize, TrimSpec> = {
  '5x8': {
    id: '5x8',
    label: '5" × 8" Pocket Trade',
    widthIn: 5,
    heightIn: 8,
    cssPageSize: '5in 8in',
  },
  '5.5x8.5': {
    id: '5.5x8.5',
    label: '5.5" × 8.5" Digest Trade',
    widthIn: 5.5,
    heightIn: 8.5,
    cssPageSize: '5.5in 8.5in',
  },
  '6x9': {
    id: '6x9',
    label: '6" × 9" Standard Trade',
    widthIn: 6,
    heightIn: 9,
    cssPageSize: '6in 9in',
  },
  a5: {
    id: 'a5',
    label: 'A5 (148 × 210 mm)',
    widthIn: 5.83,
    heightIn: 8.27,
    cssPageSize: '148mm 210mm',
  },
};

export const FONT_STACKS: Record<FontFamilyId, { label: string; css: string }> = {
  garamond: {
    label: 'Garamond / Literary Serif',
    css: '"EB Garamond", "Cormorant Garamond", Garamond, Georgia, "Times New Roman", serif',
  },
  baskerville: {
    label: 'Baskerville / Classic Book',
    css: 'Baskerville, "Libre Baskerville", "Book Antiqua", Georgia, serif',
  },
  palatino: {
    label: 'Palatino / Old-Style Serif',
    css: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  },
  inter: {
    label: 'Editorial Sans',
    css: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

const ROMAN_UNITS: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
];

export function toRoman(num: number): string {
  let n = Math.max(1, Math.floor(num));
  let out = '';
  for (const [val, sym] of ROMAN_UNITS) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

export function formatChapterLabel(indexOneBased: number, style: ChapterNumeralStyle): string {
  switch (style) {
    case 'roman':
      return `Chapter ${toRoman(indexOneBased)}`;
    case 'word': {
      const word = NUMBER_WORDS[indexOneBased] ?? String(indexOneBased);
      return `Chapter ${word}`;
    }
    case 'numeric':
      return `Chapter ${indexOneBased}`;
  }
}

export function applySmartTypography(text: string): string {
  return text
    .replace(/---/g, '—')
    .replace(/--/g, '—')
    .replace(/\.\.\./g, '…')
    .replace(/(^|[\s(\[—])"/gm, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(\[—“])'/gm, '$1‘')
    .replace(/'/g, '’');
}

export function escapeXmlText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function inlineMarkdownToXhtml(text: string): string {
  const escaped = escapeXmlText(text);
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

export function convertSceneProseToParagraphs(raw: string, useSmartTypography: boolean): string[] {
  const processed = useSmartTypography ? applySmartTypography(raw) : raw;
  return processed
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

export function buildMarkdownExport(project: BookProject): string {
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author;
  const lines: string[] = [
    '---',
    `title: "${project.title.replace(/"/g, '\\"')}"`,
    `subtitle: "${project.subtitle.replace(/"/g, '\\"')}"`,
    `author: "${penName.replace(/"/g, '\\"')}"`,
    `authorKeyId: "${identity.authorKeyId}"`,
    `language: "${project.language}"`,
    `wordCount: ${getProjectWordCount(project)}`,
    '---',
    '',
    `# ${project.title}`,
  ];

  if (project.subtitle.trim()) {
    lines.push(`*${project.subtitle}*`);
  }
  if (penName.trim()) {
    lines.push('', `By ${penName}`);
  }
  if (identity.signatureText.trim() && identity.signatureText !== penName) {
    lines.push(`Signature: ${identity.signatureText}`);
  }
  if (identity.manuscriptDigest) {
    lines.push(`Author Seal (${identity.authorKeyId}): \`${identity.manuscriptDigest.slice(0, 24)}…\``);
  }
  if (project.collaborators && project.collaborators.length > 0) {
    lines.push('', '## Credits');
    for (const c of project.collaborators) {
      lines.push(`- **${COLLABORATOR_ROLE_LABELS[c.role]}**: ${c.creditLine}`);
    }
  }
  if (project.dedication.trim()) {
    lines.push('', `> ${project.dedication}`);
  }

  let chapNum = 0;
  for (const part of project.parts) {
    lines.push('', `---`, '', `# ${part.title}`);
    for (const chapter of part.chapters) {
      chapNum++;
      const label = formatChapterLabel(chapNum, project.typography.chapterNumeralStyle);
      lines.push('', `## ${label}: ${chapter.title}`);
      if (chapter.subtitle.trim()) {
        lines.push(`*${chapter.subtitle}*`);
      }
      chapter.scenes.forEach((scene, sIdx) => {
        if (sIdx > 0) {
          lines.push('', '* * *');
        }
        const prose = project.typography.smartTypography
          ? applySmartTypography(scene.content)
          : scene.content;
        lines.push('', prose.trim());
      });
    }
  }

  return lines.join('\n') + '\n';
}

export function buildCreditsXhtml(project: BookProject): string {
  const identity = ensureAuthorIdentity(project);
  const items: string[] = [];

  if (identity.signatureText || identity.authorKeyId) {
    const sigPart = identity.signatureText ? `Signed: ${escapeXmlText(identity.signatureText)}` : '';
    const keyPart = identity.authorKeyId ? `Author Key: ${escapeXmlText(identity.authorKeyId)}` : '';
    const sealPart = identity.manuscriptDigest
      ? `Digest: ${escapeXmlText(identity.manuscriptDigest.slice(0, 20))}…`
      : '';
    items.push(
      `<p class="credit-seal">${[sigPart, keyPart, sealPart].filter(Boolean).join(' · ')}</p>`,
    );
  }

  if (project.collaborators && project.collaborators.length > 0) {
    items.push('<div class="credits-block">');
    for (const c of project.collaborators) {
      items.push(
        `<p class="credit-line"><strong>${escapeXmlText(COLLABORATOR_ROLE_LABELS[c.role])}:</strong> ${escapeXmlText(c.creditLine)}</p>`,
      );
    }
    items.push('</div>');
  }

  return items.join('\n');
}

export interface EpubChapterPayload {
  id: string;
  title: string;
  partTitle: string;
  xhtmlBody: string;
}

export interface EpubExportPayload {
  bookId: string;
  title: string;
  subtitle: string;
  author: string;
  language: string;
  dedication: string;
  copyrightNotice: string;
  creditsXhtml: string;
  coverImagePngBase64?: string;
  stylesheet: string;
  chapters: EpubChapterPayload[];
}

function extractPngBase64(dataUrl?: string): string | undefined {
  if (!dataUrl) return undefined;
  const prefix = 'data:image/png;base64,';
  if (dataUrl.startsWith(prefix)) {
    return dataUrl.slice(prefix.length);
  }
  return undefined;
}

export function buildEpubExportPayload(
  project: BookProject,
  coverPngDataUrl?: string,
): EpubExportPayload {
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author;
  const font = FONT_STACKS[project.typography.fontFamily].css;
  const stylesheet = [
    `body { font-family: ${font}; font-size: ${project.typography.fontSizePt}pt; line-height: ${project.typography.lineHeight}; margin: 0 auto; max-width: 38em; padding: 1.5em; color: #141414; }`,
    '.cover-wrap { text-align: center; padding: 0; margin: 0; }',
    '.cover-wrap img { max-width: 100%; max-height: 98vh; height: auto; }',
    '.front-matter { text-align: center; margin-top: 15%; }',
    '.book-title { font-size: 2.1em; letter-spacing: 0.02em; margin-bottom: 0.35em; }',
    '.book-subtitle { font-style: italic; color: #444; margin-bottom: 2em; }',
    '.book-author { letter-spacing: 0.12em; text-transform: uppercase; font-size: 0.9em; }',
    '.copyright-page { margin-top: 4em; font-size: 0.85em; color: #555; }',
    '.credits-block { margin-top: 1.2em; }',
    '.credit-line, .credit-seal { text-indent: 0; text-align: center; font-size: 0.85em; color: #444; margin: 0.25em 0; }',
    '.chapter-kicker { font-size: 0.78em; letter-spacing: 0.18em; text-transform: uppercase; color: #555; text-align: center; margin-bottom: 0.3em; }',
    '.chapter-title { font-size: 1.6em; text-align: center; margin: 0 0 0.4em; font-weight: 500; }',
    '.chapter-subtitle { font-style: italic; text-align: center; color: #555; margin: 0 0 2em; }',
    'p { text-indent: 1.4em; margin: 0 0 0.45em; text-align: justify; }',
    'p.first-paragraph { text-indent: 0; }',
    project.typography.dropCaps
      ? 'p.drop-cap::first-letter { float: left; font-size: 3.1em; line-height: 0.85; padding-right: 0.1em; padding-top: 0.05em; font-weight: 600; }'
      : '',
    'blockquote { margin: 1.2em 1.8em; font-style: italic; color: #333; }',
    '.scene-break { text-align: center; text-indent: 0; margin: 1.6em 0; letter-spacing: 0.4em; color: #555; }',
  ]
    .filter(Boolean)
    .join('\n');

  const chapters: EpubChapterPayload[] = [];
  let chapNum = 0;

  for (const part of project.parts) {
    for (const chapter of part.chapters) {
      chapNum++;
      const label = formatChapterLabel(chapNum, project.typography.chapterNumeralStyle);
      const partsHtml: string[] = [
        `<section class="chapter">`,
        `<p class="chapter-kicker">${escapeXmlText(label)}</p>`,
        `<h1 class="chapter-title">${escapeXmlText(chapter.title)}</h1>`,
      ];
      if (chapter.subtitle.trim()) {
        partsHtml.push(`<p class="chapter-subtitle">${escapeXmlText(chapter.subtitle)}</p>`);
      }

      chapter.scenes.forEach((scene, sIdx) => {
        if (sIdx > 0) {
          partsHtml.push('<p class="scene-break">* * *</p>');
        }
        const blocks = convertSceneProseToParagraphs(
          scene.content,
          project.typography.smartTypography,
        );
        let isChapterLead = sIdx === 0;
        let isFlushAfterBreak = sIdx > 0;
        for (const block of blocks) {
          if (/^\*\s*\*\s*\*$/.test(block)) {
            partsHtml.push('<p class="scene-break">* * *</p>');
            isFlushAfterBreak = true;
            continue;
          }
          if (block.startsWith('> ')) {
            const quoteText = block.replace(/^>\s?/gm, '');
            partsHtml.push(`<blockquote>${inlineMarkdownToXhtml(quoteText)}</blockquote>`);
            continue;
          }
          if (block.startsWith('## ')) {
            partsHtml.push(`<h2>${inlineMarkdownToXhtml(block.slice(3))}</h2>`);
            isFlushAfterBreak = true;
            continue;
          }
          if (block.startsWith('# ')) {
            partsHtml.push(`<h2>${inlineMarkdownToXhtml(block.slice(2))}</h2>`);
            isFlushAfterBreak = true;
            continue;
          }
          const startsWithLetter = /^\p{L}/u.test(block);
          const cls = isChapterLead
            ? project.typography.dropCaps && startsWithLetter
              ? ' class="first-paragraph drop-cap"'
              : ' class="first-paragraph"'
            : isFlushAfterBreak
              ? ' class="first-paragraph"'
              : '';
          isChapterLead = false;
          isFlushAfterBreak = false;
          partsHtml.push(`<p${cls}>${inlineMarkdownToXhtml(block)}</p>`);
        }
      });

      partsHtml.push('</section>');
      chapters.push({
        id: chapter.id,
        title: `${label}: ${chapter.title}`,
        partTitle: part.title,
        xhtmlBody: partsHtml.join('\n'),
      });
    }
  }

  return {
    bookId: project.id,
    title: project.title,
    subtitle: project.subtitle,
    author: penName,
    language: project.language || 'en',
    dedication: project.dedication,
    copyrightNotice: project.copyrightNotice,
    creditsXhtml: buildCreditsXhtml(project),
    coverImagePngBase64: extractPngBase64(coverPngDataUrl),
    stylesheet,
    chapters,
  };
}

// --- Pure TypeScript uncompressed ZIP (Stored) builder for browser fallback EPUB export ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = entry.data;
    const sum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, sum, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, sum, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localChunks.push(localHeader, dataBytes);
    centralChunks.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralChunks.reduce((acc, c) => acc + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of localChunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  for (const chunk of centralChunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  out.set(eocd, cursor);
  return out;
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

export function buildEpubBlobBytes(project: BookProject, coverPngDataUrl?: string): Uint8Array {
  const payload = buildEpubExportPayload(project, coverPngDataUrl);
  const enc = new TextEncoder();
  const lang = escapeXmlText(payload.language || 'en');
  const titleEsc = escapeXmlText(payload.title);
  const authorEsc = escapeXmlText(payload.author);

  const entries: Array<{ name: string; data: Uint8Array }> = [
    { name: 'mimetype', data: enc.encode('application/epub+zip') },
    {
      name: 'META-INF/container.xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n`,
      ),
    },
    { name: 'OEBPS/styles.css', data: enc.encode(payload.stylesheet) },
  ];

  const manifest: string[] = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="css" href="styles.css" media-type="text/css"/>',
  ];
  const spine: string[] = [];
  const navItems: string[] = [];

  if (payload.coverImagePngBase64) {
    entries.push({
      name: 'OEBPS/cover.png',
      data: decodeBase64ToBytes(payload.coverImagePngBase64),
    });
    entries.push({
      name: 'OEBPS/cover.xhtml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}"><head><meta charset="UTF-8"/><title>Cover</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body class="cover-wrap"><img src="cover.png" alt="${titleEsc}"/></body></html>`,
      ),
    });
    manifest.push('<item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/>');
    manifest.push('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="cover"/>');
    navItems.push('<li><a href="cover.xhtml">Cover</a></li>');
  }

  entries.push({
    name: 'OEBPS/titlepage.xhtml',
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}"><head><meta charset="UTF-8"/><title>${titleEsc}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body class="front-matter"><section class="title-page"><h1 class="book-title">${titleEsc}</h1><p class="book-subtitle">${escapeXmlText(payload.subtitle)}</p><p class="book-author">${authorEsc}</p></section><section class="copyright-page"><p>${escapeXmlText(payload.dedication)}</p><p>${escapeXmlText(payload.copyrightNotice)}</p>${payload.creditsXhtml}</section></body></html>`,
    ),
  });
  manifest.push('<item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>');
  spine.push('<itemref idref="titlepage"/>');
  navItems.push('<li><a href="titlepage.xhtml">Title Page</a></li>');

  payload.chapters.forEach((ch, idx) => {
    const num = String(idx + 1).padStart(3, '0');
    const href = `chapter-${num}.xhtml`;
    const itemId = `chap-${num}`;
    entries.push({
      name: `OEBPS/${href}`,
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}"><head><meta charset="UTF-8"/><title>${escapeXmlText(ch.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body>${ch.xhtmlBody}</body></html>`,
      ),
    });
    manifest.push(`<item id="${itemId}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${itemId}"/>`);
    navItems.push(`<li><a href="${href}">${escapeXmlText(ch.title)}</a></li>`);
  });

  entries.push({
    name: 'OEBPS/nav.xhtml',
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}"><head><meta charset="UTF-8"/><title>Contents</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navItems.join('')}</ol></nav></body></html>`,
    ),
  });

  entries.push({
    name: 'OEBPS/content.opf',
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:bookvibe:${escapeXmlText(payload.bookId)}</dc:identifier><dc:title>${titleEsc}</dc:title><dc:creator>${authorEsc}</dc:creator><dc:language>${lang}</dc:language><meta property="dcterms:modified">2026-11-22T00:00:00Z</meta></metadata><manifest>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`,
    ),
  });

  return buildStoredZip(entries);
}
