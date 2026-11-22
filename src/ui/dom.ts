export type IconName =
  | 'book'
  | 'edit'
  | 'corkboard'
  | 'outline'
  | 'bible'
  | 'graph'
  | 'typeset'
  | 'library'
  | 'collab'
  | 'folder'
  | 'save'
  | 'plus'
  | 'trash'
  | 'camera'
  | 'split'
  | 'clock'
  | 'zen'
  | 'file'
  | 'check'
  | 'chevron-right'
  | 'chevron-down'
  | 'printer'
  | 'download'
  | 'image'
  | 'key'
  | 'wifi'
  | 'bluetooth';

type ChildInput = Node | string | number | null | undefined | false;

export interface ElementOptions {
  className?: string;
  id?: string;
  text?: string;
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

const ICON_PATHS: Record<IconName, string[]> = {
  book: [
    'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20',
  ],
  edit: [
    'M12 20h9',
    'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
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
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
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
  library: [
    'M4 19.5V4.5A1.5 1.5 0 0 1 5.5 3h2A1.5 1.5 0 0 1 9 4.5v15',
    'M9 19.5V6.5A1.5 1.5 0 0 1 10.5 5h2A1.5 1.5 0 0 1 14 6.5v13',
    'M14 19.5l4.2-13.6a1.4 1.4 0 0 1 1.7-.9l1.4.4a1.4 1.4 0 0 1 .9 1.7L18 20.5',
    'M3 20h18',
  ],
  collab: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  folder: [
    'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  ],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  camera: [
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
  ],
  split: [
    'M12 3v18',
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
  ],
  clock: [
    'M12 6v6l4 2',
  ],
  zen: [
    'M15 3h6v6',
    'M9 21H3v-6',
    'M21 3l-7 7',
    'M3 21l7-7',
  ],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
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
  bluetooth: [
    'M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11',
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

  if (name === 'bible' || name === 'collab') {
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

  if (name === 'clock') {
    svg.append(
      svgEl('circle', { cx: 12, cy: 12, r: 9 }),
      svgEl('path', { d: 'M12 7v5l3.5 2' }),
    );
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
