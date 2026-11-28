export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type RichBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; runs: InlineRun[] }
  | { kind: 'blockquote'; lines: InlineRun[][] }
  | { kind: 'hr' }
  | { kind: 'paragraph'; lines: InlineRun[][] };

const SCENE_BREAK_RE = /^(?:\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)\s*$/;

/**
 * Parses inline bold (**text**) and italic (*text*) runs without interpreting raw HTML.
 */
export function parseInlineMarkdownRuns(input: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let idx = 0;

  const pushText = (txt: string, bold = false, italic = false) => {
    if (!txt) return;
    const prev = runs[runs.length - 1];
    if (prev && Boolean(prev.bold) === bold && Boolean(prev.italic) === italic) {
      prev.text += txt;
      return;
    }
    runs.push({ text: txt, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}) });
  };

  while (idx < input.length) {
    if (input.startsWith('***', idx)) {
      const close = input.indexOf('***', idx + 3);
      if (close > idx + 3 && !input.slice(idx + 3, close).includes('\n')) {
        pushText(input.slice(idx + 3, close), true, true);
        idx = close + 3;
        continue;
      }
    }
    if (input.startsWith('**', idx)) {
      const close = input.indexOf('**', idx + 2);
      if (close > idx + 2 && !input.slice(idx + 2, close).includes('\n')) {
        pushText(input.slice(idx + 2, close), true, false);
        idx = close + 2;
        continue;
      }
    }
    if (input[idx] === '*') {
      const close = input.indexOf('*', idx + 1);
      if (close > idx + 1 && !input.slice(idx + 1, close).includes('\n')) {
        pushText(input.slice(idx + 1, close), false, true);
        idx = close + 1;
        continue;
      }
    }
    const nextStar = input.indexOf('*', idx + 1);
    if (nextStar === -1) {
      pushText(input.slice(idx));
      break;
    }
    pushText(input.slice(idx, nextStar));
    idx = nextStar;
  }

  return runs;
}

export function serializeInlineRunsToMarkdown(runs: InlineRun[]): string {
  return runs
    .map((run) => {
      if (!run.text) return '';
      if (run.bold && run.italic) return `***${run.text}***`;
      if (run.bold) return `**${run.text}**`;
      if (run.italic) return `*${run.text}*`;
      return run.text;
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

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushPara();
      flushQuote();
      continue;
    }

    if (SCENE_BREAK_RE.test(trimmed)) {
      flushPara();
      flushQuote();
      blocks.push({ kind: 'hr' });
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushPara();
      flushQuote();
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, runs: parseInlineMarkdownRuns(headingMatch[2]) });
      continue;
    }

    const quoteMatch = rawLine.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushPara();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    flushQuote();
    paraLines.push(rawLine);
  }

  flushPara();
  flushQuote();
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
      return block.lines.map((line) => serializeInlineRunsToMarkdown(line)).join('\n');
    })
    .filter((chunk) => chunk.length > 0)
    .join('\n\n');
}

function appendInlineRunsToDom(parent: HTMLElement, runs: InlineRun[]): void {
  for (const run of runs) {
    if (!run.text) continue;
    const textNode = document.createTextNode(run.text);
    if (run.bold && run.italic) {
      const strong = document.createElement('strong');
      const em = document.createElement('em');
      em.appendChild(textNode);
      strong.appendChild(em);
      parent.appendChild(strong);
    } else if (run.bold) {
      const strong = document.createElement('strong');
      strong.appendChild(textNode);
      parent.appendChild(strong);
    } else if (run.italic) {
      const em = document.createElement('em');
      em.appendChild(textNode);
      parent.appendChild(em);
    } else {
      parent.appendChild(textNode);
    }
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

function wrapStyledMarkdown(text: string, marker: string): string {
  if (!text) return '';
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const trail = text.match(/\s*$/)?.[0] ?? '';
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  return `${lead}${marker}${core}${marker}${trail}`;
}

function serializeInlineNode(node: Node, inBold = false, inItalic = false): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (tag === 'BR') return '\n';

  const nextBold = inBold || tag === 'STRONG' || tag === 'B' || el.style.fontWeight === 'bold' || Number(el.style.fontWeight) >= 600;
  const nextItalic = inItalic || tag === 'EM' || tag === 'I' || el.style.fontStyle === 'italic';

  let inner = '';
  for (const child of Array.from(el.childNodes)) {
    inner += serializeInlineNode(child, nextBold, nextItalic);
  }

  if (!inBold && nextBold && !inItalic && nextItalic) return wrapStyledMarkdown(inner, '***');
  if (!inBold && nextBold) return wrapStyledMarkdown(inner, '**');
  if (!inItalic && nextItalic) return wrapStyledMarkdown(inner, '*');
  return inner;
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
