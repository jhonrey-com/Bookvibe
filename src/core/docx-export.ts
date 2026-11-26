import { ensureAuthorIdentity } from './identity';
import {
  applySmartTypography,
  buildStoredZip,
  convertSceneProseToParagraphs,
  escapeXmlText,
  formatChapterLabel,
} from './export';
import type { BookProject } from './types';

interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

function parseInlineSegments(raw: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const tokenRegex = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(raw)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ text: raw.slice(lastIdx, match.index), bold: false, italic: false });
    }
    const token = match[0];
    if (token.startsWith('***') && token.endsWith('***')) {
      segments.push({ text: token.slice(3, -3), bold: true, italic: true });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      segments.push({ text: token.slice(2, -2), bold: true, italic: false });
    } else {
      segments.push({ text: token.slice(1, -1), bold: false, italic: true });
    }
    lastIdx = tokenRegex.lastIndex;
  }

  if (lastIdx < raw.length) {
    segments.push({ text: raw.slice(lastIdx), bold: false, italic: false });
  }
  return segments.length > 0 ? segments : [{ text: raw, bold: false, italic: false }];
}

function renderRunXml(seg: InlineSegment): string {
  const rPrParts: string[] = [];
  if (seg.bold) rPrParts.push('<w:b/>');
  if (seg.italic) rPrParts.push('<w:i/>');
  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXmlText(seg.text)}</w:t></w:r>`;
}

function renderParagraphXml(text: string, opts?: { style?: string; align?: 'left' | 'center' | 'right'; pageBreakBefore?: boolean; italic?: boolean; bold?: boolean }): string {
  const pPrParts: string[] = [];
  if (opts?.style) pPrParts.push(`<w:pStyle w:val="${escapeXmlText(opts.style)}"/>`);
  if (opts?.pageBreakBefore) pPrParts.push('<w:pageBreakBefore/>');
  if (opts?.align) pPrParts.push(`<w:jc w:val="${opts.align}"/>`);
  const pPr = pPrParts.length > 0 ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';

  const segments = parseInlineSegments(text).map((seg) => ({
    ...seg,
    bold: opts?.bold ? true : seg.bold,
    italic: opts?.italic ? true : seg.italic,
  }));
  const runs = segments.map(renderRunXml).join('');
  return `<w:p>${pPr}${runs}</w:p>`;
}

function buildContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function buildRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocumentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="320" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="1440" w:after="240"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="360"/></w:pPr>
    <w:rPr><w:i/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:ind w:left="720" w:right="720"/><w:spacing w:before="160" w:after="160"/></w:pPr>
    <w:rPr><w:i/></w:rPr>
  </w:style>
</w:styles>`;
}

function buildDocumentXml(project: BookProject): string {
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author || 'Author';
  const bodyNodes: string[] = [];

  bodyNodes.push(renderParagraphXml(project.title || 'Untitled Book', { style: 'Title', align: 'center' }));
  if (project.subtitle?.trim()) {
    bodyNodes.push(renderParagraphXml(project.subtitle.trim(), { style: 'Subtitle', align: 'center' }));
  }
  bodyNodes.push(renderParagraphXml(`By ${penName}`, { align: 'center' }));

  const imprint = project.publishing?.imprintName?.trim();
  if (imprint) {
    bodyNodes.push(renderParagraphXml(imprint, { align: 'center', italic: true }));
  }
  if (project.dedication?.trim()) {
    bodyNodes.push(renderParagraphXml(project.dedication.trim(), { style: 'Quote', align: 'center', pageBreakBefore: true }));
  }
  if (project.copyrightNotice?.trim()) {
    bodyNodes.push(renderParagraphXml(project.copyrightNotice.trim(), { align: 'center' }));
  }

  let chapNum = 0;
  for (let pIdx = 0; pIdx < project.parts.length; pIdx++) {
    const part = project.parts[pIdx];
    if (project.parts.length > 1 || part.title.trim()) {
      bodyNodes.push(
        renderParagraphXml(part.title || `Part ${pIdx + 1}`, {
          style: 'Heading1',
          pageBreakBefore: true,
        }),
      );
    }

    for (const chapter of part.chapters) {
      chapNum++;
      const label = formatChapterLabel(chapNum, project.typography.chapterNumeralStyle);
      const headingText = chapter.title.trim() ? `${label}: ${chapter.title.trim()}` : label;
      bodyNodes.push(
        renderParagraphXml(headingText, {
          style: 'Heading2',
          pageBreakBefore: true,
        }),
      );
      if (chapter.subtitle?.trim()) {
        bodyNodes.push(renderParagraphXml(chapter.subtitle.trim(), { style: 'Subtitle', align: 'left' }));
      }

      chapter.scenes.forEach((scene, sIdx) => {
        if (sIdx > 0) {
          bodyNodes.push(renderParagraphXml('* * *', { align: 'center' }));
        }
        const blocks = convertSceneProseToParagraphs(
          scene.content,
          project.typography.smartTypography,
        );
        for (const block of blocks) {
          if (/^\*\s*\*\s*\*$/.test(block)) {
            bodyNodes.push(renderParagraphXml('* * *', { align: 'center' }));
          } else if (block.startsWith('> ')) {
            bodyNodes.push(renderParagraphXml(block.replace(/^>\s?/gm, ''), { style: 'Quote' }));
          } else if (block.startsWith('## ')) {
            bodyNodes.push(renderParagraphXml(block.slice(3), { style: 'Heading2' }));
          } else if (block.startsWith('# ')) {
            bodyNodes.push(renderParagraphXml(block.slice(2), { style: 'Heading1' }));
          } else {
            const cleanText = project.typography.smartTypography ? applySmartTypography(block) : block;
            bodyNodes.push(renderParagraphXml(cleanText));
          }
        }
      });
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyNodes.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

/**
 * Generates an uncompressed OOXML .docx ZIP package from a Quillvibe BookProject.
 * Compatible with desktop word processors and cloud document editors with zero dependencies.
 */
export function buildDocxBytes(project: BookProject): Uint8Array {
  const encoder = new TextEncoder();
  return buildStoredZip([
    { name: '[Content_Types].xml', data: encoder.encode(buildContentTypesXml()) },
    { name: '_rels/.rels', data: encoder.encode(buildRootRelsXml()) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(buildDocumentRelsXml()) },
    { name: 'word/styles.xml', data: encoder.encode(buildStylesXml()) },
    { name: 'word/document.xml', data: encoder.encode(buildDocumentXml(project)) },
  ]);
}

export function buildDocxBlob(project: BookProject): Blob {
  const bytes = buildDocxBytes(project);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
