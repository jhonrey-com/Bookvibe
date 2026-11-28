export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export type RichBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; runs: InlineRun[] }
  | { kind: 'blockquote'; lines: InlineRun[][] }
  | { kind: 'bullet-list'; items: InlineRun[][] }
  | { kind: 'ordered-list'; items: InlineRun[][] }
  | { kind: 'hr' }
  | { kind: 'paragraph'; lines: InlineRun[][] };

const SCENE_BREAK_RE = /^(?:\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)\s*$/;
const BULLET_LINE_RE = /^[-*]\s+(.*)$/;
const ORDERED_LINE_RE = /^\d+\.\s+(.*)$/;

/**
 * Parses inline **bold**, *italic*, ***both***, ~~strikethrough~~, and <u>underline</u> runs safely.
 */
export function parseInlineMarkdownRuns(input: string): InlineRun[] {
  const parseRec = (
    text: string,
    style: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean },
  ): InlineRun[] => {
    const out: InlineRun[] = [];
    const pushRun = (chunk: string, st = style) => {
      if (!chunk) return;
      const prev = out[out.length - 1];
      if (
        prev &&
        Boolean(prev.bold) === Boolean(st.bold) &&
        Boolean(prev.italic) === Boolean(st.italic) &&
        Boolean(prev.underline) === Boolean(st.underline) &&
        Boolean(prev.strike) === Boolean(st.strike)
      ) {
        prev.text += chunk;
        return;
      }
      out.push({
        text: chunk,
        ...(st.bold ? { bold: true } : {}),
        ...(st.italic ? { italic: true } : {}),
        ...(st.underline ? { underline: true } : {}),
        ...(st.strike ? { strike: true } : {}),
      });
    };

    let idx = 0;
    while (idx < text.length) {
      if (text.startsWith('<u>', idx)) {
        const close = text.indexOf('</u>', idx + 3);
        if (close > idx + 3 && !text.slice(idx + 3, close).includes('\n')) {
          const inner = parseRec(text.slice(idx + 3, close), { ...style, underline: true });
          inner.forEach((r) => pushRun(r.text, r));
          idx = close + 4;
          continue;
        }
      }
      if (text.startsWith('~~', idx)) {
        const close = text.indexOf('~~', idx + 2);
        if (close > idx + 2 && !text.slice(idx + 2, close).includes('\n')) {
          const inner = parseRec(text.slice(idx + 2, close), { ...style, strike: true });
          inner.forEach((r) => pushRun(r.text, r));
          idx = close + 2;
          continue;
        }
      }
      if (text.startsWith('***', idx)) {
        const close = text.indexOf('***', idx + 3);
        if (close > idx + 3 && !text.slice(idx + 3, close).includes('\n')) {
          const inner = parseRec(text.slice(idx + 3, close), { ...style, bold: true, italic: true });
          inner.forEach((r) => pushRun(r.text, r));
          idx = close + 3;
          continue;
        }
      }
      if (text.startsWith('**', idx)) {
        const close = text.indexOf('**', idx + 2);
        if (close > idx + 2 && !text.slice(idx + 2, close).includes('\n')) {
          const inner = parseRec(text.slice(idx + 2, close), { ...style, bold: true });
          inner.forEach((r) => pushRun(r.text, r));
          idx = close + 2;
          continue;
        }
      }
      if (text[idx] === '*') {
        const close = text.indexOf('*', idx + 1);
        if (close > idx + 1 && !text.slice(idx + 1, close).includes('\n')) {
          const inner = parseRec(text.slice(idx + 1, close), { ...style, italic: true });
          inner.forEach((r) => pushRun(r.text, r));
          idx = close + 1;
          continue;
        }
      }
      const candidates = [
        text.indexOf('*', idx + 1),
        text.indexOf('~~', idx + 1),
        text.indexOf('<u>', idx + 1),
      ].filter((pos) => pos !== -1);
      const nextToken = candidates.length > 0 ? Math.min(...candidates) : -1;
      if (nextToken === -1) {
        pushRun(text.slice(idx));
        break;
      }
      pushRun(text.slice(idx, nextToken));
      idx = nextToken;
    }
    return out;
  };

  return parseRec(input, {});
}

export function serializeInlineRunsToMarkdown(runs: InlineRun[]): string {
  return runs
    .map((run) => {
      if (!run.text) return '';
      let txt = run.text;
      if (run.bold && run.italic) txt = `***${txt}***`;
      else if (run.bold) txt = `**${txt}**`;
      else if (run.italic) txt = `*${txt}*`;
      if (run.strike) txt = `~~${txt}~~`;
      if (run.underline) txt = `<u>${txt}</u>`;
      return txt;
    })
    .join('');
}

/**
 * Parses manuscript Markdown into structured rich blocks for display or testing.
 */
export function parseMarkdownToBlocks(markdown: string): RichBlock[] {
  const normalized = (markdown ?? '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) return [];

  const lines = normalized.split('\n');
  const blocks: RichBlock[] = [];
  let paraLines: string[] = [];
  let quoteLines: string[] = [];
  let bulletItems: string[] = [];
  let orderedItems: string[] = [];

  const flushPara = () => {
    if (paraLines.length === 0) return;
    blocks.push({
      kind: 'paragraph',
      lines: paraLines.map((line) => parseInlineMarkdownRuns(line)),
    });
    paraLines = [];
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    blocks.push({
      kind: 'blockquote',
      lines: quoteLines.map((line) => parseInlineMarkdownRuns(line)),
    });
    quoteLines = [];
  };

  const flushBullets = () => {
    if (bulletItems.length === 0) return;
    blocks.push({
      kind: 'bullet-list',
      items: bulletItems.map((line) => parseInlineMarkdownRuns(line)),
    });
    bulletItems = [];
  };

  const flushOrdered = () => {
    if (orderedItems.length === 0) return;
    blocks.push({
      kind: 'ordered-list',
      items: orderedItems.map((line) => parseInlineMarkdownRuns(line)),
    });
    orderedItems = [];
  };

  const flushAll = () => {
    flushPara();
    flushQuote();
    flushBullets();
    flushOrdered();
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }

    if (SCENE_BREAK_RE.test(trimmed)) {
      flushAll();
      blocks.push({ kind: 'hr' });
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, runs: parseInlineMarkdownRuns(headingMatch[2]) });
      continue;
    }

    const quoteMatch = rawLine.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushPara();
      flushBullets();
      flushOrdered();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const bulletMatch = rawLine.match(BULLET_LINE_RE);
    if (bulletMatch) {
      flushPara();
      flushQuote();
      flushOrdered();
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = rawLine.match(ORDERED_LINE_RE);
    if (orderedMatch) {
      flushPara();
      flushQuote();
      flushBullets();
      orderedItems.push(orderedMatch[1]);
      continue;
    }

    flushQuote();
    flushBullets();
    flushOrdered();
    paraLines.push(rawLine);
  }

  flushAll();
  return blocks;
}

export function serializeBlocksToMarkdown(blocks: RichBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === 'hr') return '* * *';
      if (block.kind === 'heading') {
        const prefix = '#'.repeat(block.level);
        return `${prefix} ${serializeInlineRunsToMarkdown(block.runs)}`.trimEnd();
      }
      if (block.kind === 'blockquote') {
        return block.lines
          .map((line) => `> ${serializeInlineRunsToMarkdown(line)}`.trimEnd())
          .join('\n');
      }
      if (block.kind === 'bullet-list') {
        return block.items
          .map((item) => `- ${serializeInlineRunsToMarkdown(item)}`.trimEnd())
          .join('\n');
      }
      if (block.kind === 'ordered-list') {
        return block.items
          .map((item, idx) => `${idx + 1}. ${serializeInlineRunsToMarkdown(item)}`.trimEnd())
          .join('\n');
      }
      return block.lines.map((line) => serializeInlineRunsToMarkdown(line)).join('\n');
    })
    .filter((chunk) => chunk.length > 0)
    .join('\n\n');
}

function appendInlineRunsToDom(parent: HTMLElement, runs: InlineRun[]): void {
  for (const run of runs) {
    if (!run.text) continue;
    let node: Node = document.createTextNode(run.text);
    if (run.italic) {
      const em = document.createElement('em');
      em.appendChild(node);
      node = em;
    }
    if (run.bold) {
      const strong = document.createElement('strong');
      strong.appendChild(node);
      node = strong;
    }
    if (run.strike) {
      const s = document.createElement('s');
      s.appendChild(node);
      node = s;
    }
    if (run.underline) {
      const u = document.createElement('u');
      u.appendChild(node);
      node = u;
    }
    parent.appendChild(node);
  }
}

/**
 * Renders Markdown safely into rich prose DOM nodes using DOM primitives only (no innerHTML).
 */
export function renderMarkdownToRichElement(container: HTMLElement, markdown: string): void {
  container.replaceChildren();
  const blocks = parseMarkdownToBlocks(markdown);
  if (blocks.length === 0) return;

  for (const block of blocks) {
    if (block.kind === 'hr') {
      const hr = document.createElement('hr');
      hr.className = 'bv-scene-break';
      container.appendChild(hr);
      continue;
    }
    if (block.kind === 'heading') {
      const tag = block.level === 1 ? 'h1' : block.level === 3 ? 'h3' : 'h2';
      const el = document.createElement(tag);
      appendInlineRunsToDom(el, block.runs);
      container.appendChild(el);
      continue;
    }
    if (block.kind === 'blockquote') {
      const bq = document.createElement('blockquote');
      block.lines.forEach((line, idx) => {
        if (idx > 0) bq.appendChild(document.createElement('br'));
        appendInlineRunsToDom(bq, line);
      });
      container.appendChild(bq);
      continue;
    }
    if (block.kind === 'bullet-list' || block.kind === 'ordered-list') {
      const list = document.createElement(block.kind === 'ordered-list' ? 'ol' : 'ul');
      for (const itemRuns of block.items) {
        const li = document.createElement('li');
        appendInlineRunsToDom(li, itemRuns);
        if (!li.hasChildNodes()) li.appendChild(document.createElement('br'));
        list.appendChild(li);
      }
      container.appendChild(list);
      continue;
    }
    const p = document.createElement('p');
    block.lines.forEach((line, idx) => {
      if (idx > 0) p.appendChild(document.createElement('br'));
      appendInlineRunsToDom(p, line);
    });
    if (!p.hasChildNodes()) {
      p.appendChild(document.createElement('br'));
    }
    container.appendChild(p);
  }
}

function wrapStyledMarkdown(text: string, open: string, close = open): string {
  if (!text) return '';
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const trail = text.match(/\s*$/)?.[0] ?? '';
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  return `${lead}${open}${core}${close}${trail}`;
}

function serializeInlineNode(
  node: Node,
  inBold = false,
  inItalic = false,
  inUnderline = false,
  inStrike = false,
): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (tag === 'BR') return '\n';

  const deco = (el.style.textDecorationLine || el.style.textDecoration || '').toLowerCase();
  const nextBold =
    inBold ||
    tag === 'STRONG' ||
    tag === 'B' ||
    el.style.fontWeight === 'bold' ||
    Number(el.style.fontWeight) >= 600;
  const nextItalic = inItalic || tag === 'EM' || tag === 'I' || el.style.fontStyle === 'italic';
  const nextUnderline = inUnderline || tag === 'U' || deco.includes('underline');
  const nextStrike = inStrike || tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || deco.includes('line-through');

  let inner = '';
  for (const child of Array.from(el.childNodes)) {
    inner += serializeInlineNode(child, nextBold, nextItalic, nextUnderline, nextStrike);
  }

  let res = inner;
  if (!inBold && nextBold && !inItalic && nextItalic) res = wrapStyledMarkdown(res, '***');
  else if (!inBold && nextBold) res = wrapStyledMarkdown(res, '**');
  else if (!inItalic && nextItalic) res = wrapStyledMarkdown(res, '*');
  if (!inStrike && nextStrike) res = wrapStyledMarkdown(res, '~~');
  if (!inUnderline && nextUnderline) res = wrapStyledMarkdown(res, '<u>', '</u>');
  return res;
}

function normalizeBlockLine(raw: string): string {
  return raw.replace(/\n+$/g, '').trimEnd();
}

/**
 * Serializes a contenteditable rich prose container back to clean Markdown paragraphs.
 */
export function serializeRichElementToMarkdown(container: HTMLElement): string {
  const parts: string[] = [];
  let inlineBuffer = '';

  const flushInlineBuffer = () => {
    const cleaned = normalizeBlockLine(inlineBuffer);
    inlineBuffer = '';
    if (cleaned.length > 0) {
      parts.push(cleaned);
    }
  };

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      inlineBuffer += serializeInlineNode(child);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'HR') {
      flushInlineBuffer();
      parts.push('* * *');
      continue;
    }

    if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
      flushInlineBuffer();
      const prefix = tag === 'H1' ? '#' : tag === 'H3' ? '###' : '##';
      const inner = normalizeBlockLine(serializeInlineNode(el)).replace(/\n+/g, ' ');
      if (inner) parts.push(`${prefix} ${inner}`);
      continue;
    }

    if (tag === 'BLOCKQUOTE') {
      flushInlineBuffer();
      const inner = normalizeBlockLine(serializeInlineNode(el));
      if (inner) {
        parts.push(
          inner
            .split('\n')
            .map((line) => (line.trim() ? `> ${line}` : '>'))
            .join('\n'),
        );
      }
      continue;
    }

    if (tag === 'UL' || tag === 'OL') {
      flushInlineBuffer();
      const lis = Array.from(el.children).filter((c) => c.tagName.toUpperCase() === 'LI');
      const lines = lis
        .map((li, idx) => {
          const text = normalizeBlockLine(serializeInlineNode(li)).replace(/\n+/g, ' ');
          if (!text) return '';
          return tag === 'OL' ? `${idx + 1}. ${text}` : `- ${text}`;
        })
        .filter(Boolean);
      if (lines.length > 0) {
        parts.push(lines.join('\n'));
      }
      continue;
    }

    if (tag === 'P' || tag === 'DIV') {
      flushInlineBuffer();
      const inner = normalizeBlockLine(serializeInlineNode(el));
      if (inner.length > 0) {
        parts.push(inner);
      }
      continue;
    }

    inlineBuffer += serializeInlineNode(el);
  }

  flushInlineBuffer();
  return parts.join('\n\n');
}
