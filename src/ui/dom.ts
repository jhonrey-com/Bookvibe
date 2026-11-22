import { attachTooltip, type TooltipSpec } from './tooltip';

export type IconName =
  | 'book'
  | 'quill'
  | 'draft-sheet'
  | 'proofread'
  | 'split'
  | 'diff'
  | 'corkboard'
  | 'outline'
  | 'bible'
  | 'graph'
  | 'typeset'
  | 'page-margins'
  | 'cover'
  | 'seal'
  | 'library'
  | 'collab'
  | 'badge-id'
  | 'folder'
  | 'save'
  | 'extensions'
  | 'layers'
  | 'shield'
  | 'file-code'
  | 'settings'
  | 'help'
  | 'panel-left'
  | 'panel-right'
  | 'typewriter'
  | 'split-scene'
  | 'zen'
  | 'camera'
  | 'clock'
  | 'plus'
  | 'trash'
  | 'check'
  | 'chevron-right'
  | 'chevron-down'
  | 'printer'
  | 'download'
  | 'image'
  | 'key'
  | 'wifi'
  | 'bluetooth'
  | 'file';

type ChildInput = Node | string | number | null | undefined | false;

export interface ElementOptions {
  className?: string;
  id?: string;
  text?: string;
  tooltip?: TooltipSpec;
  attrs?: Record<string, string | number | boolean | undefined>;
  dataset?: Record<string, string | undefined>;
  style?: Partial<CSSStyleDeclaration>;
  on?: Partial<{
    [K in keyof HTMLElementEventMap]: (ev: HTMLElementEventMap[K]) => void;
  }>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  ...children: ChildInput[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.id) node.id = options.id;
  if (options.text !== undefined) node.textContent = options.text;

  if (options.attrs) {
    for (const [key, val] of Object.entries(options.attrs)) {
      if (val === undefined || val === false) continue;
      if (val === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(val));
    }
  }

  if (options.dataset) {
    for (const [key, val] of Object.entries(options.dataset)) {
      if (val !== undefined) node.dataset[key] = val;
    }
  }

  if (options.style) {
    Object.assign(node.style, options.style);
  }

  if (options.on) {
    for (const [evName, handler] of Object.entries(options.on)) {
      if (handler) {
        node.addEventListener(evName, handler as EventListener);
      }
    }
  }

  if (options.tooltip) {
    attachTooltip(node, options.tooltip);
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }

  return node;
}

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, val] of Object.entries(attrs)) {
    const attrName = key === 'className' ? 'class' : key;
    node.setAttribute(attrName, String(val));
  }
  for (const child of children) {
    node.appendChild(child);
  }
  return node;
}

export function clearNode(node: Element): void {
  node.replaceChildren();
}

/**
 * Transparent sculpted Bookvibe layered open-folio + page-wing emblem matching assets/bookvibe-logo.svg.
 */
export function bookvibeLogo(size = 24): SVGSVGElement {
  const svg = svgEl('svg', {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none',
    'aria-hidden': 'true',
  });
  svg.append(
    svgEl('path', {
      d: 'M11 27C11 24.4 13.1 22.8 15.6 23.4L32 27.6L48.4 23.4C50.9 22.8 53 24.4 53 27V43.2C53 45.8 51.1 47.9 48.5 48.6L34.6 52.3C32.9 52.8 31.1 52.8 29.4 52.3L15.5 48.6C12.9 47.9 11 45.8 11 43.2V27Z',
      fill: '#7e6644',
    }),
    svgEl('path', {
      d: 'M33.2 31.4C33 21.6 38.1 13.8 47.6 12.2C48.4 21.8 43.2 28.8 33.2 31.4Z',
      fill: '#d9b478',
    }),
    svgEl('path', {
      d: 'M13.5 23.4C13.5 19.7 16.1 17.7 19.8 18.1C25.8 18.7 30.2 22.8 30.2 29.2V49.1C30.2 50.7 28.6 51.3 27.2 50.1C23.6 47 19.9 45.6 17.1 45.2C14.7 44.8 13.5 43.1 13.5 40.3V23.4Z',
      fill: '#f5f2eb',
    }),
    svgEl('path', {
      d: 'M33.8 35.4C33.8 29.8 38.1 26.2 44.2 26H45.8C48.8 26 50.8 28 50.8 31V40.6C50.8 43.2 49.4 44.8 46.8 45.2C43.9 45.6 40.3 47 36.7 50.1C35.3 51.3 33.8 50.7 33.8 49.1V35.4Z',
      fill: '#dfd9cd',
    }),
  );
  return svg;
}

const ICON_PATHS: Record<IconName, string[]> = {
  book: [
    'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20',
  ],
  quill: [
    'M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z',
    'M16 8L2 22',
    'M17.5 15H9',
  ],
  'draft-sheet': [
    'M12 20h9',
    'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  ],
  proofread: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M8 13h8',
    'M9 17.5l2 2 4-4',
  ],
  split: [
    'M12 3v18',
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
  ],
  diff: [
    'M4 5h6',
    'M7 2v6',
    'M14 5h6',
    'M4 13h7v6H4z',
    'M13 13h7v6h-7z',
  ],
  corkboard: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M14 14h7v7h-7z',
    'M3 14h7v7H3z',
  ],
  outline: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3 6h.01',
    'M3 12h.01',
    'M3 18h.01',
  ],
  bible: [
    'M2 5.5A2.5 2.5 0 0 1 4.5 3H12v17H4.5A2.5 2.5 0 0 1 2 17.5v-12z',
    'M22 5.5A2.5 2.5 0 0 0 19.5 3H12v17h7.5a2.5 2.5 0 0 0 2.5-2.5v-12z',
    'M15.5 3v6l1.75-1.4L19 9V3',
    'M5.5 8.5H9',
    'M5.5 12H9',
  ],
  graph: [
    'M8 6l8 6',
    'M16 12l-8 6',
  ],
  typeset: [
    'M4 7V4h16v3',
    'M9 20h6',
    'M12 4v16',
  ],
  'page-margins': [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M8 7h8v10H8z',
  ],
  cover: [
    'M4 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4V4z',
    'M8 4v16',
    'M11.5 9h5',
    'M11.5 13h3.5',
  ],
  seal: [
    'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  ],
  library: [
    'M4 19.5V4.5A1.5 1.5 0 0 1 5.5 3h2A1.5 1.5 0 0 1 9 4.5v15',
    'M9 19.5V6.5A1.5 1.5 0 0 1 10.5 5h2A1.5 1.5 0 0 1 14 6.5v13',
    'M14 19.5l4.2-13.6a1.4 1.4 0 0 1 1.7-.9l1.4.4a1.4 1.4 0 0 1 .9 1.7L18 20.5',
    'M3 20h18',
  ],
  collab: [],
  'badge-id': [
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
    'M7 9h10',
    'M7 13h6',
    'M7 17h4',
  ],
  folder: [
    'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  ],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  extensions: [
    'M19 10h-2V7a2 2 0 0 0-2-2h-2.17a2.5 2.5 0 1 0-4.66 0H5a2 2 0 0 0-2 2v3h2.17a2.5 2.5 0 1 1 0 5H3v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3h2a2.5 2.5 0 0 0 0-5z',
  ],
  layers: [
    'M12 2L2 7l10 5 10-5-10-5z',
    'M2 12l10 5 10-5',
    'M2 17l10 5 10-5',
  ],
  shield: [
    'M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z',
    'M9.5 12.2l1.8 1.8 3.5-3.6',
  ],
  'file-code': [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M10 13l-2 2 2 2',
    'M14 13l2 2-2 2',
  ],
  settings: [
    'M4 6h16',
    'M4 12h16',
    'M4 18h16',
  ],
  help: [
    'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
    'M12 17h.01',
  ],
  'panel-left': [
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
    'M9 3v18',
  ],
  'panel-right': [
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
    'M15 3v18',
  ],
  typewriter: [
    'M4 12h16',
    'M7 6h10',
    'M7 18h10',
    'M12 3v3',
    'M12 18v3',
  ],
  'split-scene': [
    'M3 12h18',
    'M6 6h12',
    'M6 18h12',
  ],
  zen: [
    'M15 3h6v6',
    'M9 21H3v-6',
    'M21 3l-7 7',
    'M3 21l7-7',
  ],
  camera: [
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
  ],
  clock: ['M12 6v6l4 2'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  check: ['M20 6L9 17l-5-5'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  printer: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z',
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
  ],
  image: [
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
    'M21 15l-5-5L5 21',
  ],
  key: [
    'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  ],
  wifi: [
    'M5 12.55a11 11 0 0 1 14.08 0',
    'M8.53 16.11a6 6 0 0 1 6.95 0',
    'M12 20h.01',
  ],
  bluetooth: ['M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11'],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
  ],
};

export function icon(name: IconName, size = 15): SVGSVGElement {
  const svg = svgEl('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });

  if (name === 'collab') {
    svg.append(
      svgEl('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
      svgEl('circle', { cx: 9, cy: 7, r: 4 }),
      svgEl('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }),
      svgEl('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }),
    );
    return svg;
  }

  if (name === 'graph') {
    svg.append(
      svgEl('circle', { cx: 6, cy: 6, r: 2.5 }),
      svgEl('circle', { cx: 18, cy: 12, r: 2.5 }),
      svgEl('circle', { cx: 6, cy: 18, r: 2.5 }),
      svgEl('path', { d: 'M8.2 7.1l7.4 3.8' }),
      svgEl('path', { d: 'M15.6 13.1l-7.4 3.8' }),
    );
    return svg;
  }

  if (name === 'settings') {
    svg.append(
      svgEl('path', { d: 'M4 6h16' }),
      svgEl('path', { d: 'M4 12h16' }),
      svgEl('path', { d: 'M4 18h16' }),
      svgEl('circle', { cx: 8, cy: 6, r: 2, fill: '#0b0c10' }),
      svgEl('circle', { cx: 16, cy: 12, r: 2, fill: '#0b0c10' }),
      svgEl('circle', { cx: 10, cy: 18, r: 2, fill: '#0b0c10' }),
    );
    return svg;
  }

  if (name === 'clock' || name === 'help') {
    svg.append(svgEl('circle', { cx: 12, cy: 12, r: 9 }));
    for (const d of ICON_PATHS[name]) {
      svg.appendChild(svgEl('path', { d }));
    }
    return svg;
  }

  if (name === 'camera') {
    svg.append(
      svgEl('path', {
        d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
      }),
      svgEl('circle', { cx: 12, cy: 13, r: 4 }),
    );
    return svg;
  }

  if (name === 'image') {
    svg.append(
      svgEl('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
      svgEl('circle', { cx: 8.5, cy: 8.5, r: 1.5 }),
      svgEl('path', { d: 'M21 15l-5-5L5 21' }),
    );
    return svg;
  }

  for (const d of ICON_PATHS[name]) {
    svg.appendChild(svgEl('path', { d }));
  }
  return svg;
}
