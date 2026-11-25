import { COLLABORATOR_ROLE_LABELS } from './collab';
import { applySmartTypography, formatChapterLabel, TRIM_SPECS } from './export';
import { ensureAuthorIdentity } from './identity';
import type { BookProject } from './types';

interface PdfTextRun {
  x: number;
  y: number;
  font: 'R' | 'B' | 'I';
  size: number;
  text: string;
}

interface PdfPage {
  runs: PdfTextRun[];
  rules?: Array<{ x1: number; y1: number; x2: number; y2: number; width: number }>;
  footer?: string;
  header?: string;
}

const WINANSI_MAP: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

function encodeWinAnsiPdfLiteral(text: string): Uint8Array {
  const bytes: number[] = [0x28]; // '('
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let b = 0x3f; // '?'
    if (code >= 0x20 && code <= 0x7e) {
      b = code;
    } else if (code >= 0xa0 && code <= 0xff) {
      b = code;
    } else if (WINANSI_MAP[code] !== undefined) {
      b = WINANSI_MAP[code];
    }
    if (b === 0x28 || b === 0x29 || b === 0x5c) {
      bytes.push(0x5c, b);
    } else {
      bytes.push(b);
    }
  }
  bytes.push(0x29); // ')'
  return new Uint8Array(bytes);
}

function approxCharWidth(ch: string, size: number, bold = false): number {
  const factor = bold ? 1.04 : 1;
  if (ch === ' ') return size * 0.27 * factor;
  if ('ilIjtfr.,;:\'"!|()[]'.includes(ch)) return size * 0.28 * factor;
  if ('mwMWQO@%'.includes(ch)) return size * 0.72 * factor;
  if (ch >= 'A' && ch <= 'Z') return size * 0.62 * factor;
  return size * 0.46 * factor;
}

function measureTextPt(text: string, size: number, bold = false): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += approxCharWidth(text[i], size, bold);
  }
  return w;
}

function wrapLines(text: string, maxWidthPt: number, fontSizePt: number, bold = false): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (measureTextPt(next, fontSizePt, bold) <= maxWidthPt) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Generates a self-contained PDF 1.4 print-ready book interior using the project's
 * selected trim size, margins, serif/sans typeface, chapter headings, credits, and running headers.
 * Works uniformly in desktop executables, desktop browsers, and mobile browsers.
 */
export function buildTypesetPdfBytes(project: BookProject): Uint8Array {
  const trim = TRIM_SPECS[project.typography.trimSize] ?? TRIM_SPECS['6x9'];
  const pageW = Math.round(trim.widthIn * 72 * 100) / 100;
  const pageH = Math.round(trim.heightIn * 72 * 100) / 100;
  const marginPt = Math.max(36, Math.min(pageW * 0.22, (project.typography.marginInches || 0.75) * 72));
  const contentW = pageW - marginPt * 2;
  const topY = pageH - marginPt;
  const bottomY = marginPt;

  const fontSizePt = Math.max(9, Math.min(16, project.typography.fontSizePt || 11.5));
  const leadingPt = Math.max(fontSizePt * 1.15, fontSizePt * (project.typography.lineHeight || 1.5));
  const smart = project.typography.smartTypography;
  const identity = ensureAuthorIdentity(project);
  const authorName = identity.penName || project.author || 'Author';
  const useSans = project.typography.fontFamily === 'inter';

  const pages: PdfPage[] = [];
  const formatLine = (str: string) => (smart ? applySmartTypography(str) : str);

  const pushCentered = (
    page: PdfPage,
    text: string,
    y: number,
    size: number,
    font: 'R' | 'B' | 'I' = 'R',
  ) => {
    const clean = formatLine(text);
    const w = measureTextPt(clean, size, font === 'B');
    const x = Math.max(marginPt, (pageW - w) / 2);
    page.runs.push({ x, y, font, size, text: clean });
  };

  // Page 1: Title Page
  const titlePage: PdfPage = { runs: [], rules: [] };
  let titleY = pageH * 0.64;
  for (const line of wrapLines(project.title || 'Untitled Book', contentW, 24, true)) {
    pushCentered(titlePage, line, titleY, 24, 'B');
    titleY -= 30;
  }
  if (project.subtitle) {
    titleY -= 8;
    for (const line of wrapLines(project.subtitle, contentW * 0.88, 12, false)) {
      pushCentered(titlePage, line, titleY, 12, 'I');
      titleY -= 17;
    }
  }
  titlePage.rules?.push({
    x1: pageW * 0.36,
    y1: pageH * 0.44,
    x2: pageW * 0.64,
    y2: pageH * 0.44,
    width: 0.6,
  });
  pushCentered(titlePage, authorName, pageH * 0.34, 14, 'R');
  if (project.publishing?.imprintName) {
    pushCentered(titlePage, project.publishing.imprintName, marginPt + 24, 9.5, 'R');
  }
  pages.push(titlePage);

  // Page 2: Copyright, Origin Key, Copyright Seal & Credits
  const copyPage: PdfPage = { runs: [] };
  let copyY = topY - 40;
  const copyLines: Array<{ text: string; font: 'R' | 'B' | 'I'; size: number }> = [
    { text: project.copyrightNotice || `Copyright © ${new Date().getFullYear()} ${authorName}`, font: 'R', size: 9.5 },
  ];
  if (project.publishing?.editionNumber) {
    copyLines.push({ text: `${project.publishing.editionNumber}${project.publishing.isbn ? `  ·  ISBN ${project.publishing.isbn}` : ''}`, font: 'R', size: 9 });
  }
  if (identity.authorKeyId) {
    copyLines.push({
      text: `Origin Author Key: ${identity.authorKeyId}${identity.originDeviceId ? ` · Origin Device ${identity.originDeviceId}` : ''}`,
      font: 'R',
      size: 8.5,
    });
  }
  if (project.copyrightOwnership?.sealId) {
    copyLines.push({
      text: `Work Copyright Seal: ${project.copyrightOwnership.sealId} · ${project.copyrightOwnership.ownerName} (${project.copyrightOwnership.rightsTerritory})`,
      font: 'R',
      size: 8.5,
    });
  }
  if (project.collaborators && project.collaborators.length > 0) {
    copyLines.push({ text: 'Editorial & Co-Author Credits:', font: 'B', size: 9 });
    for (const c of project.collaborators) {
      copyLines.push({
        text: `• ${c.creditLine || `${COLLABORATOR_ROLE_LABELS[c.role]}: ${c.penName}`}${c.coAuthorKeyId ? ` [${c.coAuthorKeyId}]` : ''}`,
        font: 'R',
        size: 8.5,
      });
    }
  }
  copyLines.push({ text: 'Typeset with Quillvibe (jhonrey.com)', font: 'I', size: 8.5 });

  for (const item of copyLines) {
    const wrapped = wrapLines(formatLine(item.text), contentW, item.size, item.font === 'B');
    for (const wline of wrapped) {
      if (copyY < bottomY + 18) break;
      copyPage.runs.push({ x: marginPt, y: copyY, font: item.font, size: item.size, text: wline });
      copyY -= item.size * 1.45;
    }
    copyY -= 4;
  }
  pages.push(copyPage);

  // Dedication Page (optional)
  if (project.dedication && project.dedication.trim()) {
    const dedPage: PdfPage = { runs: [] };
    let dedY = pageH * 0.56;
    for (const line of wrapLines(project.dedication, contentW * 0.78, 11.5, false)) {
      pushCentered(dedPage, line, dedY, 11.5, 'I');
      dedY -= 17;
    }
    pages.push(dedPage);
  }

  // Track chapter start page indices for TOC insertion
  const tocPagePlaceholder: PdfPage = { runs: [] };
  const tocIndex = pages.length;
  if (project.typography.includeTableOfContents) {
    pages.push(tocPagePlaceholder);
  }

  const tocEntries: Array<{ label: string; title: string; pageNumber: number }> = [];
  let chapterCounter = 0;

  for (const part of project.parts) {
    if (project.parts.length > 1) {
      const partPage: PdfPage = { runs: [] };
      pushCentered(partPage, part.title, pageH * 0.54, 18, 'B');
      pages.push(partPage);
    }

    for (const chapter of part.chapters) {
      chapterCounter++;
      const chLabel = formatChapterLabel(chapterCounter, project.typography.chapterNumeralStyle);
      let curPage: PdfPage = {
        runs: [],
        header: `${project.title}  ·  ${chapter.title}`,
      };
      pages.push(curPage);
      const bookBodyPageNo = pages.length;
      if (project.typography.includePageNumbers) {
        curPage.footer = String(bookBodyPageNo);
      }
      tocEntries.push({
        label: chLabel,
        title: chapter.title,
        pageNumber: bookBodyPageNo,
      });

      let y = topY - 38;
      pushCentered(curPage, chLabel.toUpperCase(), y, 9.5, 'R');
      y -= 22;
      for (const chLine of wrapLines(chapter.title, contentW * 0.9, 16, true)) {
        pushCentered(curPage, chLine, y, 16, 'B');
        y -= 21;
      }
      if (chapter.subtitle) {
        for (const subLine of wrapLines(chapter.subtitle, contentW * 0.85, 10.5, false)) {
          pushCentered(curPage, subLine, y, 10.5, 'I');
          y -= 15;
        }
      }
      y -= 18;

      const ensureSpace = (neededPt: number) => {
        if (y - neededPt < bottomY + 18) {
          curPage = {
            runs: [],
            header: `${project.title}  ·  ${chapter.title}`,
          };
          pages.push(curPage);
          if (project.typography.includePageNumbers) {
            curPage.footer = String(pages.length);
          }
          y = topY - 12;
        }
      };

      chapter.scenes.forEach((scene, scIdx) => {
        if (scIdx > 0) {
          ensureSpace(leadingPt * 2);
          y -= leadingPt * 0.6;
          pushCentered(curPage, '* * *', y, fontSizePt, 'R');
          y -= leadingPt * 1.4;
        }

        const paragraphs = scene.content
          .split(/\n{2,}/)
          .map((p) => stripInlineMarkdown(p))
          .filter(Boolean);

        paragraphs.forEach((para, pIdx) => {
          const formatted = formatLine(para);
          const indentPt = pIdx === 0 ? 0 : 1.4 * fontSizePt;
          const firstWidth = Math.max(contentW * 0.5, contentW - indentPt);
          const words = formatted.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
          if (words.length === 0) return;

          const lines: string[] = [];
          let current = words[0];
          let limit = firstWidth;
          for (let i = 1; i < words.length; i++) {
            const candidate = `${current} ${words[i]}`;
            if (measureTextPt(candidate, fontSizePt) <= limit) {
              current = candidate;
            } else {
              lines.push(current);
              current = words[i];
              limit = contentW;
            }
          }
          lines.push(current);

          lines.forEach((lineText, lIdx) => {
            ensureSpace(leadingPt);
            const x = lIdx === 0 ? marginPt + indentPt : marginPt;
            curPage.runs.push({ x, y, font: 'R', size: fontSizePt, text: lineText });
            y -= leadingPt;
          });
        });
      });
    }
  }

  // Populate TOC page if enabled
  if (project.typography.includeTableOfContents) {
    let tocY = topY - 24;
    pushCentered(tocPagePlaceholder, 'Contents', tocY, 16, 'B');
    tocY -= 28;
    for (const item of tocEntries) {
      if (tocY < bottomY + 18) break;
      const leftText = formatLine(`${item.label} — ${item.title}`);
      const pageNum = String(item.pageNumber);
      tocPagePlaceholder.runs.push({ x: marginPt, y: tocY, font: 'R', size: 10.5, text: leftText });
      const numW = measureTextPt(pageNum, 10.5, false);
      tocPagePlaceholder.runs.push({
        x: pageW - marginPt - numW,
        y: tocY,
        font: 'R',
        size: 10.5,
        text: pageNum,
      });
      tocY -= 16;
    }
  }

  // Ensure running headers/footers on body pages don't collide cleanly with TOC
  void tocIndex;

  // Assemble PDF 1.4 Objects:
  // 1: Catalog, 2: Pages, 3: Info, 4: Font /F1 (Regular), 5: Font /F2 (Bold), 6: Font /F3 (Italic)
  // Then per page: content stream object + page object
  const objects: Uint8Array[] = [];
  const enc = new TextEncoder();

  const fontR = useSans ? 'Helvetica' : 'Times-Roman';
  const fontB = useSans ? 'Helvetica-Bold' : 'Times-Bold';
  const fontI = useSans ? 'Helvetica-Oblique' : 'Times-Italic';

  const pageObjIds: number[] = [];
  const firstPageObjId = 7;

  // Reserve slots 1..6 (index 0..5)
  for (let i = 0; i < 6; i++) objects.push(new Uint8Array(0));

  pages.forEach((page, idx) => {
    const contentId = firstPageObjId + idx * 2;
    const pageId = contentId + 1;
    pageObjIds.push(pageId);

    const streamChunks: Uint8Array[] = [];
    if (page.rules) {
      for (const r of page.rules) {
        streamChunks.push(enc.encode(`${r.width} w ${r.x1.toFixed(2)} ${r.y1.toFixed(2)} m ${r.x2.toFixed(2)} ${r.y2.toFixed(2)} l S\n`));
      }
    }
    if (page.header) {
      const hSize = 8;
      const hW = measureTextPt(page.header, hSize);
      const hx = Math.max(marginPt, (pageW - hW) / 2);
      streamChunks.push(
        enc.encode(`BT /F3 ${hSize} Tf 0.35 0.35 0.35 rg 1 0 0 1 ${hx.toFixed(2)} ${(pageH - marginPt * 0.55).toFixed(2)} Tm `),
        encodeWinAnsiPdfLiteral(formatLine(page.header)),
        enc.encode(` Tj 0 0 0 rg ET\n`),
      );
    }
    if (page.footer) {
      const fSize = 9;
      const fW = measureTextPt(page.footer, fSize);
      const fx = (pageW - fW) / 2;
      streamChunks.push(
        enc.encode(`BT /F1 ${fSize} Tf 0.28 0.28 0.28 rg 1 0 0 1 ${fx.toFixed(2)} ${(marginPt * 0.52).toFixed(2)} Tm `),
        encodeWinAnsiPdfLiteral(page.footer),
        enc.encode(` Tj 0 0 0 rg ET\n`),
      );
    }

    for (const run of page.runs) {
      const fontAlias = run.font === 'B' ? 'F2' : run.font === 'I' ? 'F3' : 'F1';
      streamChunks.push(
        enc.encode(`BT /${fontAlias} ${run.size.toFixed(2)} Tf 1 0 0 1 ${run.x.toFixed(2)} ${run.y.toFixed(2)} Tm `),
        encodeWinAnsiPdfLiteral(run.text),
        enc.encode(` Tj ET\n`),
      );
    }

    const streamBytes = concatChunks(streamChunks);
    objects.push(
      concatChunks([
        enc.encode(`${contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
        streamBytes,
        enc.encode(`endstream\nendobj\n`),
      ]),
    );
    objects.push(
      enc.encode(
        `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
      ),
    );
  });

  objects[0] = enc.encode(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects[1] = enc.encode(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj\n`);
  objects[2] = concatChunks([
    enc.encode(`3 0 obj\n<< /Title `),
    encodeWinAnsiPdfLiteral(project.title || 'Untitled Book'),
    enc.encode(` /Author `),
    encodeWinAnsiPdfLiteral(authorName),
    enc.encode(` /Creator `),
    encodeWinAnsiPdfLiteral('Quillvibe 2.3.0 (jhonrey.com)'),
    enc.encode(` /Producer `),
    encodeWinAnsiPdfLiteral('jhonrey.com Quillvibe PDF Engine'),
    enc.encode(` >>\nendobj\n`),
  ]);
  objects[3] = enc.encode(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${fontR} /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects[4] = enc.encode(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${fontB} /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects[5] = enc.encode(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${fontI} /Encoding /WinAnsiEncoding >>\nendobj\n`);

  const header = enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const offsets: number[] = [];
  let cursor = header.length;
  const bodyChunks: Uint8Array[] = [header];

  for (const objBytes of objects) {
    offsets.push(cursor);
    bodyChunks.push(objBytes);
    cursor += objBytes.length;
  }

  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  bodyChunks.push(enc.encode(trailer));

  return concatChunks(bodyChunks);
}
