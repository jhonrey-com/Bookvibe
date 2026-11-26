import { resolveEffectiveFontCss } from './fonts';
import { ensureAuthorIdentity } from './identity';
import { getProjectWordCount, newId } from './manuscript';
import type {
  BookCoverConfig,
  BookProject,
  CoverBlendMode,
  CoverFaceId,
  CoverGraphicLayer,
  CoverPathLayer,
  CoverPathPoint,
  CoverShapeKind,
  CoverShapeLayer,
  CoverTemplateId,
  CoverTextLayer,
} from './types';

export interface CoverTemplatePreset {
  id: CoverTemplateId;
  label: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
}

export const COVER_TEMPLATES: readonly CoverTemplatePreset[] = [
  {
    id: 'obsidian-foil',
    label: 'Obsidian & Brass Foil',
    backgroundColor: '#0d0f14',
    accentColor: '#c7a97b',
    textColor: '#f2ede2',
  },
  {
    id: 'ivory-classic',
    label: 'Ivory Literary Classic',
    backgroundColor: '#f6f2e9',
    accentColor: '#7a2e2e',
    textColor: '#15161a',
  },
  {
    id: 'editorial-band',
    label: 'Slate Editorial Band',
    backgroundColor: '#161b24',
    accentColor: '#e8e2d5',
    textColor: '#ffffff',
  },
  {
    id: 'full-bleed',
    label: 'Full-Bleed Artwork',
    backgroundColor: '#101218',
    accentColor: '#e5d4b3',
    textColor: '#ffffff',
  },
  {
    id: 'minimal-spine',
    label: 'Minimal Swiss Frame',
    backgroundColor: '#121316',
    accentColor: '#67b08c',
    textColor: '#eceef2',
  },
];

export interface BuiltInOrnament {
  id: string;
  name: string;
  svgMarkup: string;
}

export const BUILT_IN_COVER_ORNAMENTS: readonly BuiltInOrnament[] = [
  {
    id: 'orn-rule',
    name: 'Classic Rule Divider',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 24" width="180" height="24" fill="none"><line x1="8" y1="12" x2="74" y2="12" stroke="#c7a97b" stroke-width="1.6"/><polygon points="90,4 98,12 90,20 82,12" stroke="#c7a97b" stroke-width="1.5" fill="none"/><line x1="106" y1="12" x2="172" y2="12" stroke="#c7a97b" stroke-width="1.6"/></svg>',
  },
  {
    id: 'orn-compass',
    name: 'Editorial Emblem',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80" fill="none"><circle cx="40" cy="40" r="30" stroke="#e8e2d5" stroke-width="1.8"/><polygon points="40,12 46,34 68,40 46,46 40,68 34,46 12,40 34,34" stroke="#c7a97b" stroke-width="1.6" fill="none"/><circle cx="40" cy="40" r="4" fill="#c7a97b"/></svg>',
  },
  {
    id: 'orn-colophon',
    name: 'Press Seal Frame',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none"><rect x="6" y="6" width="52" height="52" rx="10" stroke="#e8e2d5" stroke-width="2"/><path d="M18 22L32 26V44L18 40V22Z" stroke="#c7a97b" stroke-width="2" stroke-linejoin="round"/><path d="M46 22L32 26V44L46 40V22Z" stroke="#c7a97b" stroke-width="2" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'orn-arch',
    name: 'Typographic Arch',
    svgMarkup:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80" fill="none"><path d="M16 70V34A44 44 0 0 1 104 34V70" stroke="#c7a97b" stroke-width="1.8"/><line x1="10" y1="70" x2="110" y2="70" stroke="#c7a97b" stroke-width="1.4"/></svg>',
  },
];

export function encodeSvgStringToDataUrl(svgString: string): string {
  const bytes = new TextEncoder().encode(svgString);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Strips scripts, foreignObject, external <use>, event handlers, and javascript: URIs from SVG files.
 */
export function sanitizeSvgMarkup(rawSvg: string): string {
  if (!rawSvg || !rawSvg.trim()) {
    throw new Error('SVG file is empty.');
  }

  const trimmed = rawSvg.trim();
  if (!trimmed.toLowerCase().includes('<svg')) {
    throw new Error('Selected file does not contain a valid <svg> root element.');
  }

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(trimmed, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
      throw new Error('Malformed SVG XML structure.');
    }

    const blockedTags = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'link', 'meta']);
    const allNodes = Array.from(root.querySelectorAll('*'));
    for (const node of allNodes) {
      if (blockedTags.has(node.tagName.toLowerCase())) {
        node.remove();
        continue;
      }
      for (const attr of Array.from(node.attributes)) {
        const lname = attr.name.toLowerCase();
        const lval = attr.value.trim().toLowerCase();
        if (lname.startsWith('on')) {
          node.removeAttribute(attr.name);
        } else if (
          (lname === 'href' || lname === 'xlink:href') &&
          node.tagName.toLowerCase() === 'use' &&
          !lval.startsWith('#')
        ) {
          node.removeAttribute(attr.name);
        } else if (lval.includes('javascript:') || lval.includes('vbscript:')) {
          node.removeAttribute(attr.name);
        }
      }
    }

    for (const rootAttr of Array.from(root.attributes)) {
      if (rootAttr.name.toLowerCase().startsWith('on')) {
        root.removeAttribute(rootAttr.name);
      }
    }
    return new XMLSerializer().serializeToString(root);
  }

  // Fallback sanitizer in non-DOM runtimes (e.g. unit test node environment)
  return trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(?:iframe|object|embed|link)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export async function sanitizeAndEncodeSvgFile(file: File): Promise<string> {
  const raw = await file.text();
  const clean = sanitizeSvgMarkup(raw);
  return encodeSvgStringToDataUrl(clean);
}

export function createGraphicLayerFromDataUrl(
  face: CoverFaceId,
  name: string,
  dataUrl: string,
  kind: 'svg' | 'image',
): CoverGraphicLayer {
  return {
    id: newId('cgl'),
    face,
    name: name.replace(/\.(svg|png|jpe?g|webp)$/i, '').slice(0, 40) || 'Graphic',
    dataUrl,
    xPct: 50,
    yPct: face === 'spine' ? 50 : 62,
    widthPct: face === 'spine' ? 58 : kind === 'svg' ? 28 : 42,
    rotationDeg: 0,
    opacity: 1,
    kind,
    visible: true,
    locked: false,
    flipX: false,
    flipY: false,
    brightnessPct: 100,
    contrastPct: 100,
    blurPx: 0,
  };
}

export function createShapeLayer(
  face: CoverFaceId,
  shape: CoverShapeKind,
  accentColor = '#c7a97b',
): CoverShapeLayer {
  const names: Record<CoverShapeKind, string> = {
    rect: 'Rectangle',
    'rounded-rect': 'Rounded Box',
    circle: 'Circle / Seal',
    triangle: 'Triangle',
    arrow: 'Arrow',
    star: 'Star',
    polygon: 'Hexagon',
    line: 'Rule Line',
    frame: 'Border Frame',
    badge: 'Edition Pill',
  };
  const isLine = shape === 'line';
  const isCircle = shape === 'circle';
  const isFrame = shape === 'frame';
  const isBadge = shape === 'badge';
  const isArrow = shape === 'arrow';
  const isStarOrPoly = shape === 'star' || shape === 'polygon' || shape === 'triangle';
  return {
    id: newId('csl'),
    face,
    name: names[shape],
    shape,
    xPct: 50,
    yPct: isBadge ? 18 : 52,
    widthPct: isFrame ? 84 : isCircle ? 26 : isLine ? 62 : isBadge ? 38 : isArrow ? 42 : isStarOrPoly ? 24 : 48,
    heightPct: isFrame ? 86 : isCircle ? 18 : isLine ? 1.5 : isBadge ? 7 : isArrow ? 14 : isStarOrPoly ? 16 : 22,
    fillColor: isFrame || isLine ? 'transparent' : accentColor,
    strokeColor: accentColor,
    strokeWidth: isFrame || isLine ? 2 : 0,
    cornerRadius: isCircle ? 999 : isBadge ? 999 : shape === 'rounded-rect' ? 14 : 0,
    rotationDeg: 0,
    opacity: isFrame || isLine ? 0.9 : 0.35,
    visible: true,
    locked: false,
  };
}

export function createTextLayer(
  face: CoverFaceId,
  text = 'Custom Display Copy',
  color = '#f2ede2',
): CoverTextLayer {
  return {
    id: newId('ctl'),
    face,
    name: text.slice(0, 26) || 'Text Layer',
    text,
    xPct: 50,
    yPct: 58,
    fontSize: 16,
    color,
    align: 'center',
    fontWeight: '500',
    italic: false,
    uppercase: false,
    letterSpacingEm: 0.02,
    lineHeight: 1.25,
    strokeColor: '#000000',
    strokeWidth: 0,
    shadowBlur: 0,
    rotationDeg: 0,
    opacity: 1,
    visible: true,
    locked: false,
  };
}

export function createPathLayer(
  face: CoverFaceId,
  points: CoverPathPoint[],
  options: {
    name?: string;
    closed?: boolean;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    opacity?: number;
    blendMode?: CoverBlendMode;
  } = {},
): CoverPathLayer {
  return {
    id: newId('cpl'),
    face,
    name: options.name ?? 'Vector Path',
    points,
    closed: Boolean(options.closed),
    strokeColor: options.strokeColor ?? '#c7a97b',
    strokeWidth: options.strokeWidth ?? 3,
    fillColor: options.fillColor ?? 'transparent',
    opacity: options.opacity ?? 1,
    blendMode: options.blendMode ?? 'normal',
    rotationDeg: 0,
    visible: true,
    locked: false,
  };
}

export function createCoverVariantSnapshot(cover: BookCoverConfig): Omit<BookCoverConfig, 'variants' | 'comments'> {
  const { variants: _v, comments: _c, ...rest } = structuredClone(cover);
  return rest;
}

export function loadImageUrlAsDataUrl(rawUrl: string, maxDimension = 1400): Promise<string> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return Promise.reject(new Error('Enter an HTTPS image URL or data:image URI first.'));
  }
  if (trimmed.startsWith('data:image/')) {
    if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(trimmed)) {
      return Promise.resolve(trimmed);
    }
    return Promise.reject(new Error('Only safe PNG, JPEG, WebP, GIF, or SVG data URIs are allowed.'));
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return Promise.reject(new Error('Invalid URL format. Include https:// at the start.'));
  }
  if (parsed.protocol !== 'https:') {
    return Promise.reject(new Error('Only secure https:// image URLs can be embedded into covers.'));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 600) * scale));
        const h = Math.max(1, Math.round((img.height || 900) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable for encoding pasted image.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        reject(new Error('Remote image server blocks canvas pixel export (missing CORS header). Download the file and upload it directly instead.'));
      }
    };
    img.onerror = () =>
      reject(new Error('Could not load image from that URL. Check the link or download the image to upload directly.'));
    img.src = parsed.toString();
  });
}

export function snapValueToGrid(valuePct: number, gridStepPct = 4, enabled = true): number {
  if (!enabled || gridStepPct <= 0) return Math.round(valuePct * 10) / 10;
  return Math.round(valuePct / gridStepPct) * gridStepPct;
}

export function computeSmartAlignSnap(
  xPct: number,
  yPct: number,
  options: { snapGrid?: boolean; gridStepPct?: number; magneticThreshold?: number } = {},
): { xPct: number; yPct: number; guideX: number | null; guideY: number | null } {
  const threshold = options.magneticThreshold ?? 1.8;
  let outX = options.snapGrid ? snapValueToGrid(xPct, options.gridStepPct ?? 4, true) : Math.round(xPct);
  let outY = options.snapGrid ? snapValueToGrid(yPct, options.gridStepPct ?? 4, true) : Math.round(yPct);
  let guideX: number | null = null;
  let guideY: number | null = null;

  for (const anchor of [50, 25, 75]) {
    if (Math.abs(xPct - anchor) <= threshold) {
      outX = anchor;
      guideX = anchor;
      break;
    }
  }
  for (const anchor of [50, 25, 75]) {
    if (Math.abs(yPct - anchor) <= threshold) {
      outY = anchor;
      guideY = anchor;
      break;
    }
  }
  return { xPct: outX, yPct: outY, guideX, guideY };
}

export function computeCoverBackgroundCss(cover: BookCoverConfig, baseColor: string): string {
  const mode = cover.bgMode ?? 'solid';
  const end = cover.bgGradientEnd || cover.accentColor || '#1e2432';
  const angle = cover.bgGradientAngle ?? 155;
  if (mode === 'linear-gradient') {
    return `linear-gradient(${angle}deg, ${baseColor}, ${end})`;
  }
  if (mode === 'radial-gradient') {
    return `radial-gradient(circle at 50% 35%, ${end}, ${baseColor})`;
  }
  return baseColor;
}

export function defaultBookCover(project?: BookProject): BookCoverConfig {
  const firstSynopsis = project?.parts[0]?.chapters[0]?.scenes[0]?.synopsis ?? '';
  const authorName = project?.authorIdentity?.penName || project?.author || 'Author';
  return {
    template: 'obsidian-foil',
    backgroundColor: '#0d0f14',
    bgMode: 'solid',
    bgGradientEnd: '#1b2230',
    bgGradientAngle: 155,
    bgBrightnessPct: 100,
    bgContrastPct: 100,
    bgBlurPx: 0,
    backBackgroundColor: '#0d0f14',
    spineBackgroundColor: '#0d0f14',
    accentColor: '#c7a97b',
    textColor: '#f2ede2',
    backgroundImageDataUrl: '',
    imageOverlayOpacity: 0.45,
    backHeadline: project?.title || 'About the Book',
    backBlurb:
      firstSynopsis ||
      'A standalone literary work written and typeset with Quillvibe.',
    authorBio: `${authorName} writes long-form fiction and literary works.`,
    spineTitle: '',
    showBarcodeBox: true,
    frontFlapText: 'A crisp jacket summary for print cloth and hardcover editions.',
    backFlapText: `${authorName} notes, colophon, and imprint credit.`,
    snapToGrid: true,
    showGrid: false,
    gridSizePx: 4,
    showGuides: true,
    graphicLayers: [],
    shapeLayers: [],
    textLayers: [],
    pathLayers: [],
    variants: [],
    comments: [],
    editionLabel: 'First Edition',
    elements: {
      edition: { xPct: 50, yPct: 12, fontSize: 12, align: 'center', visible: true },
      title: { xPct: 50, yPct: 30, fontSize: 38, align: 'center', visible: true },
      subtitle: { xPct: 50, yPct: 44, fontSize: 16, align: 'center', visible: true },
      author: { xPct: 50, yPct: 79, fontSize: 18, align: 'center', visible: true },
      signature: { xPct: 50, yPct: 87, fontSize: 20, align: 'center', visible: true },
    },
  };
}

export function estimateSpineInches(project: BookProject): number {
  const words = getProjectWordCount(project);
  const estPages = Math.max(80, Math.ceil(words / 250) + 12);
  return Number((estPages * 0.0025).toFixed(2));
}

export function downscaleImageFileToDataUrl(
  file: File,
  maxDimension = 1400,
): Promise<string> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return sanitizeAndEncodeSvgFile(file);
  }
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return Promise.reject(new Error('Only SVG, PNG, JPEG, or WebP images are supported.'));
  }
  const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed reading image file.'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image data.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(preserveAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvasBlendOp(mode?: CoverBlendMode): GlobalCompositeOperation {
  if (!mode || mode === 'normal') return 'source-over';
  return mode as GlobalCompositeOperation;
}

function drawPathLayersOnRect(
  ctx: CanvasRenderingContext2D,
  paths: CoverPathLayer[],
  ox: number,
  oy: number,
  boxW: number,
  boxH: number,
): void {
  const ordered = [...paths].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const scaleFactor = boxW / 400;
  for (const p of ordered) {
    if (p.visible === false || p.points.length < 2) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0.02, Math.min(1, p.opacity));
    ctx.globalCompositeOperation = canvasBlendOp(p.blendMode);
    ctx.beginPath();
    p.points.forEach((pt, idx) => {
      const x = ox + (pt.xPct / 100) * boxW;
      const y = oy + (pt.yPct / 100) * boxH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (p.closed) ctx.closePath();
    if (p.fillColor && p.fillColor !== 'transparent') {
      ctx.fillStyle = p.fillColor;
      ctx.fill();
    }
    if (p.strokeWidth > 0 && p.strokeColor) {
      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth = Math.max(1, p.strokeWidth * scaleFactor);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }
}

async function drawGraphicLayersOnRect(
  ctx: CanvasRenderingContext2D,
  layers: CoverGraphicLayer[],
  ox: number,
  oy: number,
  boxW: number,
  boxH: number,
): Promise<void> {
  const ordered = [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  for (const layer of ordered) {
    if (layer.visible === false) continue;
    const img = await loadImage(layer.dataUrl);
    if (!img) continue;
    const targetW = (Math.max(5, Math.min(100, layer.widthPct)) / 100) * boxW;
    const aspect = img.height / Math.max(1, img.width);
    const targetH = targetW * aspect;
    const cx = ox + (layer.xPct / 100) * boxW;
    const cy = oy + (layer.yPct / 100) * boxH;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, layer.opacity));
    ctx.globalCompositeOperation = canvasBlendOp(layer.blendMode);
    const b = layer.brightnessPct ?? 100;
    const c = layer.contrastPct ?? 100;
    const sat = layer.saturationPct ?? 100;
    const blur = layer.blurPx ?? 0;
    if ('filter' in ctx && (b !== 100 || c !== 100 || sat !== 100 || blur > 0)) {
      ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${sat}%) blur(${blur}px)`;
    }
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotationDeg * Math.PI) / 180);
    ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    const radiusPct = Math.max(0, Math.min(50, layer.borderRadiusPct ?? 0));
    if (radiusPct > 0) {
      const rPx = (radiusPct / 100) * Math.min(targetW, targetH);
      ctx.beginPath();
      ctx.roundRect(-targetW / 2, -targetH / 2, targetW, targetH, rPx);
      ctx.clip();
    }
    ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();
  }
}

function drawShapeLayersOnRect(
  ctx: CanvasRenderingContext2D,
  shapes: CoverShapeLayer[],
  ox: number,
  oy: number,
  boxW: number,
  boxH: number,
): void {
  const ordered = [...shapes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  for (const s of ordered) {
    if (s.visible === false) continue;
    const w = (s.widthPct / 100) * boxW;
    const h = s.shape === 'line' ? Math.max(2, s.strokeWidth || 2) : (s.heightPct / 100) * boxH;
    const cx = ox + (s.xPct / 100) * boxW;
    const cy = oy + (s.yPct / 100) * boxH;
    ctx.save();
    ctx.globalAlpha = Math.max(0.02, Math.min(1, s.opacity));
    ctx.globalCompositeOperation = canvasBlendOp(s.blendMode);
    ctx.translate(cx, cy);
    ctx.rotate((s.rotationDeg * Math.PI) / 180);

    const hw = w / 2;
    const hh = h / 2;
    ctx.beginPath();
    if (s.shape === 'circle') {
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    } else if (s.shape === 'line') {
      ctx.moveTo(-hw, 0);
      ctx.lineTo(hw, 0);
    } else if (s.shape === 'triangle') {
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw, hh);
      ctx.closePath();
    } else if (s.shape === 'arrow') {
      const shaftH = hh * 0.42;
      const headStart = hw * 0.28;
      ctx.moveTo(-hw, -shaftH);
      ctx.lineTo(headStart, -shaftH);
      ctx.lineTo(headStart, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(headStart, hh);
      ctx.lineTo(headStart, shaftH);
      ctx.lineTo(-hw, shaftH);
      ctx.closePath();
    } else if (s.shape === 'star') {
      const spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i * Math.PI) / spikes - Math.PI / 2;
        const radX = i % 2 === 0 ? hw : hw * 0.42;
        const radY = i % 2 === 0 ? hh : hh * 0.42;
        const px = Math.cos(ang) * radX;
        const py = Math.sin(ang) * radY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (s.shape === 'polygon') {
      const sides = 6;
      for (let i = 0; i < sides; i++) {
        const ang = (i * Math.PI * 2) / sides - Math.PI / 2;
        const px = Math.cos(ang) * hw;
        const py = Math.sin(ang) * hh;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      const r = Math.min(s.cornerRadius || 0, hw, hh);
      ctx.roundRect(-hw, -hh, w, h, r);
    }

    if (s.shape !== 'line' && s.fillColor && s.fillColor !== 'transparent') {
      if (s.gradientEndColor) {
        const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
        grad.addColorStop(0, s.fillColor);
        grad.addColorStop(1, s.gradientEndColor);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = s.fillColor;
      }
      ctx.fill();
    }
    if (s.strokeWidth > 0 && s.strokeColor) {
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = s.strokeWidth * (boxW / 400);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCustomTextLayersOnRect(
  ctx: CanvasRenderingContext2D,
  textLayers: CoverTextLayer[],
  defaultFontStack: string,
  ox: number,
  oy: number,
  boxW: number,
  boxH: number,
): void {
  const scaleFactor = boxW / 400;
  const ordered = [...textLayers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  for (const tl of ordered) {
    if (tl.visible === false || !tl.text.trim()) continue;
    const pxSize = Math.round(tl.fontSize * scaleFactor);
    const fontStack = tl.fontFamily ? resolveEffectiveFontCss('garamond', tl.fontFamily) : defaultFontStack;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, tl.opacity));
    ctx.globalCompositeOperation = canvasBlendOp(tl.blendMode);
    ctx.translate(ox + (tl.xPct / 100) * boxW, oy + (tl.yPct / 100) * boxH);
    ctx.rotate((tl.rotationDeg * Math.PI) / 180);
    ctx.font = `${tl.italic ? 'italic ' : ''}${tl.fontWeight || '500'} ${pxSize}px ${fontStack}`;
    ctx.textAlign = tl.align;
    ctx.textBaseline = 'middle';
    if (tl.shadowBlur && tl.shadowBlur > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = tl.shadowBlur;
    }
    const content = tl.uppercase ? tl.text.toUpperCase() : tl.text;
    const lines = wrapCanvasLines(ctx, content, boxW * 0.85);
    const step = pxSize * (tl.lineHeight || 1.2);
    if (tl.backgroundColor && tl.backgroundColor !== 'transparent') {
      let maxLineW = 0;
      for (const line of lines) {
        maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
      }
      const padX = pxSize * 0.45;
      const padY = pxSize * 0.25;
      const boxBgW = maxLineW + padX * 2;
      const boxBgH = lines.length * step + padY * 2;
      const alignOffsetX =
        tl.align === 'left' ? 0 : tl.align === 'right' ? -boxBgW : -boxBgW / 2;
      ctx.save();
      ctx.fillStyle = tl.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(alignOffsetX, -boxBgH / 2, boxBgW, boxBgH, 6 * scaleFactor);
      ctx.fill();
      ctx.restore();
    }
    let y = -((lines.length - 1) * step) / 2;
    for (const line of lines) {
      if (tl.strokeWidth && tl.strokeWidth > 0 && tl.strokeColor) {
        ctx.strokeStyle = tl.strokeColor;
        ctx.lineWidth = tl.strokeWidth * scaleFactor;
        ctx.strokeText(line, 0, y);
      }
      ctx.fillStyle = tl.color;
      ctx.fillText(line, 0, y);
      if (tl.textDecoration === 'underline' || tl.textDecoration === 'line-through') {
        const lw = ctx.measureText(line).width;
        const startX = tl.align === 'left' ? 0 : tl.align === 'right' ? -lw : -lw / 2;
        const lineY = tl.textDecoration === 'underline' ? y + pxSize * 0.42 : y;
        ctx.save();
        ctx.strokeStyle = tl.color;
        ctx.lineWidth = Math.max(1.5, pxSize * 0.06);
        ctx.beginPath();
        ctx.moveTo(startX, lineY);
        ctx.lineTo(startX + lw, lineY);
        ctx.stroke();
        ctx.restore();
      }
      y += step;
    }
    ctx.restore();
  }
}

async function paintFrontFaceOnContext(
  ctx: CanvasRenderingContext2D,
  project: BookProject,
  ox: number,
  oy: number,
  widthPx: number,
  heightPx: number,
  options: { transparentBackground?: boolean } = {},
): Promise<void> {
  const cover = project.cover ?? defaultBookCover(project);
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author || 'Author';
  const fontStack = resolveEffectiveFontCss(
    project.typography.fontFamily,
    cover.customFontFamily || project.typography.customFontFamily,
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, widthPx, heightPx);
  ctx.clip();

  if (!options.transparentBackground) {
    if (cover.bgMode === 'linear-gradient') {
      const rad = ((cover.bgGradientAngle ?? 155) * Math.PI) / 180;
      const dx = Math.cos(rad) * (widthPx / 2);
      const dy = Math.sin(rad) * (heightPx / 2);
      const grad = ctx.createLinearGradient(
        ox + widthPx / 2 - dx,
        oy + heightPx / 2 - dy,
        ox + widthPx / 2 + dx,
        oy + heightPx / 2 + dy,
      );
      grad.addColorStop(0, cover.backgroundColor);
      grad.addColorStop(1, cover.bgGradientEnd || cover.accentColor);
      ctx.fillStyle = grad;
    } else if (cover.bgMode === 'radial-gradient') {
      const grad = ctx.createRadialGradient(
        ox + widthPx * 0.5,
        oy + heightPx * 0.35,
        widthPx * 0.05,
        ox + widthPx * 0.5,
        oy + heightPx * 0.5,
        Math.max(widthPx, heightPx) * 0.72,
      );
      grad.addColorStop(0, cover.bgGradientEnd || cover.accentColor);
      grad.addColorStop(1, cover.backgroundColor);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = cover.backgroundColor;
    }
    ctx.fillRect(ox, oy, widthPx, heightPx);
  }

  if (cover.backgroundImageDataUrl) {
    const art = await loadImage(cover.backgroundImageDataUrl);
    if (art) {
      const scale = Math.max(widthPx / art.width, heightPx / art.height);
      const dw = art.width * scale;
      const dh = art.height * scale;
      ctx.save();
      if ('filter' in ctx) {
        const b = cover.bgBrightnessPct ?? 100;
        const c = cover.bgContrastPct ?? 100;
        const blur = cover.bgBlurPx ?? 0;
        if (b !== 100 || c !== 100 || blur > 0) {
          ctx.filter = `brightness(${b}%) contrast(${c}%) blur(${blur}px)`;
        }
      }
      ctx.drawImage(art, ox + (widthPx - dw) / 2, oy + (heightPx - dh) / 2, dw, dh);
      ctx.restore();
      ctx.fillStyle = cover.backgroundColor;
      ctx.globalAlpha = Math.max(0, Math.min(0.9, cover.imageOverlayOpacity));
      ctx.fillRect(ox, oy, widthPx, heightPx);
      ctx.globalAlpha = 1;
    }
  }

  const pad = Math.round(widthPx * 0.075);
  ctx.strokeStyle = cover.accentColor;
  ctx.lineWidth = Math.max(2, Math.round(widthPx * 0.003));
  if (cover.template === 'obsidian-foil' || cover.template === 'ivory-classic') {
    ctx.strokeRect(ox + pad, oy + pad, widthPx - pad * 2, heightPx - pad * 2);
  } else if (cover.template === 'editorial-band') {
    ctx.fillStyle = cover.accentColor;
    ctx.fillRect(ox, oy + Math.round(heightPx * 0.62), widthPx, Math.round(heightPx * 0.014));
  } else if (cover.template === 'minimal-spine') {
    ctx.fillStyle = cover.accentColor;
    ctx.fillRect(ox + pad, oy + pad, Math.round(widthPx * 0.012), heightPx - pad * 2);
  }

  drawShapeLayersOnRect(
    ctx,
    (cover.shapeLayers ?? []).filter((l) => l.face === 'front'),
    ox,
    oy,
    widthPx,
    heightPx,
  );

  await drawGraphicLayersOnRect(
    ctx,
    (cover.graphicLayers ?? []).filter((l) => l.face === 'front'),
    ox,
    oy,
    widthPx,
    heightPx,
  );

  drawPathLayersOnRect(
    ctx,
    (cover.pathLayers ?? []).filter((l) => l.face === 'front'),
    ox,
    oy,
    widthPx,
    heightPx,
  );

  const scaleFactor = widthPx / 400;
  const drawTextElement = (
    text: string,
    placement: BookCoverConfig['elements']['title'],
    options: { italic?: boolean; uppercase?: boolean; weight?: string; color?: string },
  ) => {
    if (!placement.visible || !text.trim()) return;
    const content = (placement.uppercase ?? options.uppercase) ? text.toUpperCase() : text;
    const pxSize = Math.round(placement.fontSize * scaleFactor);
    ctx.save();
    ctx.globalAlpha = placement.opacity ?? 1;
    ctx.fillStyle = placement.color ?? options.color ?? cover.textColor;
    ctx.font = `${(placement.italic ?? options.italic) ? 'italic ' : ''}${placement.fontWeight ?? options.weight ?? '500'} ${pxSize}px ${fontStack}`;
    ctx.textAlign = placement.align;
    ctx.textBaseline = 'middle';
    if (placement.shadowBlur && placement.shadowBlur > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = placement.shadowBlur;
    }
    const x = ox + (placement.xPct / 100) * widthPx;
    let y = oy + (placement.yPct / 100) * heightPx;
    const maxW = widthPx - pad * 2.2;
    const lines = wrapCanvasLines(ctx, content, maxW);
    const lineStep = pxSize * (placement.lineHeight ?? 1.18);
    const totalH = (lines.length - 1) * lineStep;
    y -= totalH / 2;
    for (const line of lines) {
      if (placement.strokeWidth && placement.strokeWidth > 0 && placement.strokeColor) {
        ctx.strokeStyle = placement.strokeColor;
        ctx.lineWidth = placement.strokeWidth * scaleFactor;
        ctx.strokeText(line, x, y);
      }
      ctx.fillText(line, x, y);
      y += lineStep;
    }
    ctx.restore();
  };

  drawTextElement(cover.editionLabel, cover.elements.edition, {
    uppercase: true,
    weight: '600',
    color: cover.accentColor,
  });
  drawTextElement(project.title, cover.elements.title, { weight: '600' });
  drawTextElement(project.subtitle, cover.elements.subtitle, { italic: true });
  drawTextElement(penName, cover.elements.author, { uppercase: true, weight: '600' });

  drawCustomTextLayersOnRect(
    ctx,
    (cover.textLayers ?? []).filter((l) => l.face === 'front'),
    fontStack,
    ox,
    oy,
    widthPx,
    heightPx,
  );

  if (cover.elements.signature.visible) {
    if (identity.signatureSvgDataUrl) {
      const sigImg = await loadImage(identity.signatureSvgDataUrl);
      if (sigImg) {
        const sigW = Math.round(widthPx * 0.34);
        const sigH = Math.round(sigW * (sigImg.height / Math.max(1, sigImg.width)));
        const sx = ox + (cover.elements.signature.xPct / 100) * widthPx - sigW / 2;
        const sy = oy + (cover.elements.signature.yPct / 100) * heightPx - sigH / 2;
        ctx.drawImage(sigImg, sx, sy, sigW, sigH);
      }
    } else if (identity.signatureText) {
      drawTextElement(identity.signatureText, cover.elements.signature, {
        italic: true,
        color: cover.accentColor,
      });
    }
  }
  ctx.restore();
}

export async function renderCoverToDataUrl(
  project: BookProject,
  widthPx = 1200,
  heightPx = 1920,
  options: { format?: 'image/png' | 'image/jpeg'; quality?: number; transparentBackground?: boolean } = {},
): Promise<string> {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const fmt = options.format ?? 'image/png';
  await paintFrontFaceOnContext(ctx, project, 0, 0, widthPx, heightPx, {
    transparentBackground: fmt === 'image/png' && Boolean(options.transparentBackground),
  });
  return canvas.toDataURL(fmt, options.quality ?? 0.92);
}

export async function renderCoverToPngDataUrl(
  project: BookProject,
  widthPx = 1200,
  heightPx = 1920,
  transparentBackground = false,
): Promise<string> {
  return renderCoverToDataUrl(project, widthPx, heightPx, {
    format: 'image/png',
    transparentBackground,
  });
}

export async function renderCoverToJpegDataUrl(
  project: BookProject,
  widthPx = 1200,
  heightPx = 1920,
  quality = 0.92,
): Promise<string> {
  return renderCoverToDataUrl(project, widthPx, heightPx, {
    format: 'image/jpeg',
    quality,
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgShapeMarkup(s: CoverShapeLayer, boxW: number, boxH: number): string {
  if (s.visible === false) return '';
  const cx = (s.xPct / 100) * boxW;
  const cy = (s.yPct / 100) * boxH;
  const w = (s.widthPct / 100) * boxW;
  const h = s.shape === 'line' ? Math.max(2, s.strokeWidth || 2) : (s.heightPct / 100) * boxH;
  const hw = w / 2;
  const hh = h / 2;
  const fill = s.shape === 'line' || !s.fillColor || s.fillColor === 'transparent' ? 'none' : escapeXml(s.fillColor);
  const stroke = s.strokeWidth > 0 && s.strokeColor ? escapeXml(s.strokeColor) : 'none';
  const sw = s.strokeWidth > 0 ? s.strokeWidth * (boxW / 400) : 0;
  const op = Math.max(0.02, Math.min(1, s.opacity));
  const tf = `translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${s.rotationDeg})`;

  if (s.shape === 'circle') {
    return `<ellipse transform="${tf}" cx="0" cy="0" rx="${hw.toFixed(1)}" ry="${hh.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}" />`;
  }
  if (s.shape === 'line') {
    return `<line transform="${tf}" x1="${(-hw).toFixed(1)}" y1="0" x2="${hw.toFixed(1)}" y2="0" stroke="${stroke !== 'none' ? stroke : fill}" stroke-width="${Math.max(1.5, sw)}" opacity="${op}" />`;
  }
  if (s.shape === 'triangle') {
    return `<polygon transform="${tf}" points="0,${(-hh).toFixed(1)} ${hw.toFixed(1)},${hh.toFixed(1)} ${(-hw).toFixed(1)},${hh.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}" />`;
  }
  if (s.shape === 'arrow') {
    const sh = (hh * 0.42).toFixed(1);
    const hs = (hw * 0.28).toFixed(1);
    const pts = `${(-hw).toFixed(1)},-${sh} ${hs},-${sh} ${hs},${(-hh).toFixed(1)} ${hw.toFixed(1)},0 ${hs},${hh.toFixed(1)} ${hs},${sh} ${(-hw).toFixed(1)},${sh}`;
    return `<polygon transform="${tf}" points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}" />`;
  }
  if (s.shape === 'star' || s.shape === 'polygon') {
    const pts: string[] = [];
    const total = s.shape === 'star' ? 10 : 6;
    for (let i = 0; i < total; i++) {
      const ang = (i * Math.PI * 2) / total - Math.PI / 2;
      const rx = s.shape === 'star' && i % 2 === 1 ? hw * 0.42 : hw;
      const ry = s.shape === 'star' && i % 2 === 1 ? hh * 0.42 : hh;
      pts.push(`${(Math.cos(ang) * rx).toFixed(1)},${(Math.sin(ang) * ry).toFixed(1)}`);
    }
    return `<polygon transform="${tf}" points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}" />`;
  }
  const rx = Math.min(s.cornerRadius || 0, hw, hh);
  return `<rect transform="${tf}" x="${(-hw).toFixed(1)}" y="${(-hh).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${op}" />`;
}

export function renderCoverToVectorSvg(
  project: BookProject,
  widthPx = 1200,
  heightPx = 1920,
): string {
  const cover = project.cover ?? defaultBookCover(project);
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author || 'Author';
  const fontStack = resolveEffectiveFontCss(
    project.typography.fontFamily,
    cover.customFontFamily || project.typography.customFontFamily,
  );
  const scaleFactor = widthPx / 400;
  const pad = Math.round(widthPx * 0.075);

  const defs: string[] = [];
  let bgFill = escapeXml(cover.backgroundColor);
  if (cover.bgMode === 'linear-gradient') {
    defs.push(
      `<linearGradient id="qvBgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${escapeXml(cover.backgroundColor)}" /><stop offset="100%" stop-color="${escapeXml(cover.bgGradientEnd || cover.accentColor)}" /></linearGradient>`,
    );
    bgFill = 'url(#qvBgGrad)';
  } else if (cover.bgMode === 'radial-gradient') {
    defs.push(
      `<radialGradient id="qvBgGrad" cx="50%" cy="35%" r="72%"><stop offset="0%" stop-color="${escapeXml(cover.bgGradientEnd || cover.accentColor)}" /><stop offset="100%" stop-color="${escapeXml(cover.backgroundColor)}" /></radialGradient>`,
    );
    bgFill = 'url(#qvBgGrad)';
  }

  const shapesMarkup = [...(cover.shapeLayers ?? [])]
    .filter((s) => s.face === 'front')
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((s) => svgShapeMarkup(s, widthPx, heightPx))
    .join('\n  ');

  const graphicsMarkup = [...(cover.graphicLayers ?? [])]
    .filter((g) => g.face === 'front' && g.visible !== false)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((g) => {
      const w = (Math.max(5, Math.min(100, g.widthPct)) / 100) * widthPx;
      const cx = (g.xPct / 100) * widthPx;
      const cy = (g.yPct / 100) * heightPx;
      const sx = g.flipX ? -1 : 1;
      const sy = g.flipY ? -1 : 1;
      return `<g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${g.rotationDeg}) scale(${sx}, ${sy})" opacity="${g.opacity}"><image href="${escapeXml(g.dataUrl)}" x="${(-w / 2).toFixed(1)}" y="${(-w / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${w.toFixed(1)}" preserveAspectRatio="xMidYMid meet" /></g>`;
    })
    .join('\n  ');

  const renderCoreText = (
    text: string,
    placement: BookCoverConfig['elements']['title'],
    fallbackColor: string,
    fallbackWeight = '500',
    uppercase = false,
  ) => {
    if (!placement.visible || !text.trim()) return '';
    const content = (placement.uppercase ?? uppercase) ? text.toUpperCase() : text;
    const x = (placement.xPct / 100) * widthPx;
    const y = (placement.yPct / 100) * heightPx;
    const anchor = placement.align === 'left' ? 'start' : placement.align === 'right' ? 'end' : 'middle';
    const pxSize = Math.round(placement.fontSize * scaleFactor);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${escapeXml(placement.color ?? fallbackColor)}" font-family="${escapeXml(fontStack)}" font-size="${pxSize}" font-weight="${placement.fontWeight ?? fallbackWeight}" text-anchor="${anchor}" dominant-baseline="central">${escapeXml(content)}</text>`;
  };

  const customTextsMarkup = [...(cover.textLayers ?? [])]
    .filter((t) => t.face === 'front' && t.visible !== false && t.text.trim())
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((tl) => {
      const x = (tl.xPct / 100) * widthPx;
      const y = (tl.yPct / 100) * heightPx;
      const anchor = tl.align === 'left' ? 'start' : tl.align === 'right' ? 'end' : 'middle';
      const pxSize = Math.round(tl.fontSize * scaleFactor);
      const tf = `translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${tl.rotationDeg})`;
      const content = tl.uppercase ? tl.text.toUpperCase() : tl.text;
      return `<text transform="${tf}" x="0" y="0" fill="${escapeXml(tl.color)}" opacity="${tl.opacity}" font-family="${escapeXml(fontStack)}" font-size="${pxSize}" font-weight="${tl.fontWeight}" font-style="${tl.italic ? 'italic' : 'normal'}" text-anchor="${anchor}" dominant-baseline="central">${escapeXml(content)}</text>`;
    })
    .join('\n  ');

  const pathsMarkup = [...(cover.pathLayers ?? [])]
    .filter((p) => p.face === 'front' && p.visible !== false && p.points.length >= 2)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((p) => {
      const cmds = p.points
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${((pt.xPct / 100) * widthPx).toFixed(1)} ${((pt.yPct / 100) * heightPx).toFixed(1)}`)
        .join(' ');
      const d = p.closed ? `${cmds} Z` : cmds;
      const fill = p.fillColor && p.fillColor !== 'transparent' ? escapeXml(p.fillColor) : 'none';
      const stroke = p.strokeWidth > 0 && p.strokeColor ? escapeXml(p.strokeColor) : 'none';
      const sw = p.strokeWidth > 0 ? (p.strokeWidth * scaleFactor).toFixed(1) : '0';
      const blendStyle = p.blendMode && p.blendMode !== 'normal' ? ` style="mix-blend-mode:${p.blendMode}"` : '';
      return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${p.opacity}"${blendStyle} />`;
    })
    .join('\n  ');

  const frameBorder =
    cover.template === 'obsidian-foil' || cover.template === 'ivory-classic'
      ? `<rect x="${pad}" y="${pad}" width="${widthPx - pad * 2}" height="${heightPx - pad * 2}" fill="none" stroke="${escapeXml(cover.accentColor)}" stroke-width="${Math.max(2, Math.round(widthPx * 0.003))}" />`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
  ${defs.length ? `<defs>${defs.join('')}</defs>` : ''}
  <rect width="${widthPx}" height="${heightPx}" fill="${bgFill}" />
  ${frameBorder}
  ${shapesMarkup}
  ${graphicsMarkup}
  ${pathsMarkup}
  ${renderCoreText(cover.editionLabel, cover.elements.edition, cover.accentColor, '600', true)}
  ${renderCoreText(project.title, cover.elements.title, cover.textColor, '600')}
  ${renderCoreText(project.subtitle, cover.elements.subtitle, cover.textColor, '400')}
  ${renderCoreText(penName, cover.elements.author, cover.textColor, '600', true)}
  ${customTextsMarkup}
</svg>`;
}

export async function renderFullWrapToPngDataUrl(
  project: BookProject,
  faceW = 1000,
  faceH = 1500,
): Promise<string> {
  if (typeof document === 'undefined') return '';
  const cover = project.cover ?? defaultBookCover(project);
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author || 'Author';
  const spineIn = estimateSpineInches(project);
  const spineW = Math.max(90, Math.round((spineIn / 6) * faceW));
  const totalW = faceW * 2 + spineW;

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = faceH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const fontStack = resolveEffectiveFontCss(
    project.typography.fontFamily,
    cover.customFontFamily || project.typography.customFontFamily,
  );

  // Back face
  ctx.fillStyle = cover.backBackgroundColor || cover.backgroundColor;
  ctx.fillRect(0, 0, faceW, faceH);
  drawShapeLayersOnRect(
    ctx,
    (cover.shapeLayers ?? []).filter((l) => l.face === 'back'),
    0,
    0,
    faceW,
    faceH,
  );
  await drawGraphicLayersOnRect(
    ctx,
    (cover.graphicLayers ?? []).filter((l) => l.face === 'back'),
    0,
    0,
    faceW,
    faceH,
  );
  drawCustomTextLayersOnRect(
    ctx,
    (cover.textLayers ?? []).filter((l) => l.face === 'back'),
    fontStack,
    0,
    0,
    faceW,
    faceH,
  );
  const pad = Math.round(faceW * 0.1);
  ctx.fillStyle = cover.accentColor;
  ctx.font = `600 ${Math.round(faceW * 0.042)}px ${fontStack}`;
  ctx.textAlign = 'left';
  ctx.fillText(cover.backHeadline || project.title, pad, pad + 36);

  ctx.fillStyle = cover.textColor;
  ctx.font = `400 ${Math.round(faceW * 0.032)}px ${fontStack}`;
  let by = pad + 92;
  for (const line of wrapCanvasLines(ctx, cover.backBlurb, faceW - pad * 2)) {
    ctx.fillText(line, pad, by);
    by += Math.round(faceW * 0.046);
  }
  if (cover.authorBio) {
    by += 28;
    ctx.globalAlpha = 0.78;
    for (const line of wrapCanvasLines(ctx, cover.authorBio, faceW - pad * 2)) {
      ctx.fillText(line, pad, by);
      by += Math.round(faceW * 0.04);
    }
    ctx.globalAlpha = 1;
  }
  if (cover.showBarcodeBox !== false) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(faceW - pad - 240, faceH - pad - 140, 240, 140);
    ctx.fillStyle = '#111111';
    ctx.font = '18px monospace';
    ctx.fillText(project.publishing?.isbn || 'QUILLVIBE PRESS', faceW - pad - 224, faceH - pad - 24);
  }

  // Spine face
  ctx.fillStyle = cover.spineBackgroundColor || cover.backgroundColor;
  ctx.fillRect(faceW, 0, spineW, faceH);
  drawShapeLayersOnRect(
    ctx,
    (cover.shapeLayers ?? []).filter((l) => l.face === 'spine'),
    faceW,
    0,
    spineW,
    faceH,
  );
  await drawGraphicLayersOnRect(
    ctx,
    (cover.graphicLayers ?? []).filter((l) => l.face === 'spine'),
    faceW,
    0,
    spineW,
    faceH,
  );
  ctx.save();
  ctx.translate(faceW + spineW / 2, faceH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = cover.accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(spineW * 0.34)}px ${fontStack}`;
  ctx.fillText(`${cover.spineTitle || project.title}  ·  ${penName}`, 0, 0);
  ctx.restore();

  // Front face
  await paintFrontFaceOnContext(ctx, project, faceW + spineW, 0, faceW, faceH);

  // Trim seam hairlines
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(faceW, 0);
  ctx.lineTo(faceW, faceH);
  ctx.moveTo(faceW + spineW, 0);
  ctx.lineTo(faceW + spineW, faceH);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}
