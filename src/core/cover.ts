import { resolveEffectiveFontCss } from './fonts';
import { ensureAuthorIdentity } from './identity';
import { getProjectWordCount, newId } from './manuscript';
import type {
  BookCoverConfig,
  BookProject,
  CoverFaceId,
  CoverGraphicLayer,
  CoverTemplateId,
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
  if (!rawSvg || rawSvg.length > 2 * 1024 * 1024) {
    throw new Error('SVG file exceeds 2 MB limit.');
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
  };
}

export function defaultBookCover(project?: BookProject): BookCoverConfig {
  const firstSynopsis = project?.parts[0]?.chapters[0]?.scenes[0]?.synopsis ?? '';
  const authorName = project?.authorIdentity?.penName || project?.author || 'Author';
  return {
    template: 'obsidian-foil',
    backgroundColor: '#0d0f14',
    backBackgroundColor: '#0d0f14',
    spineBackgroundColor: '#0d0f14',
    accentColor: '#c7a97b',
    textColor: '#f2ede2',
    backgroundImageDataUrl: '',
    imageOverlayOpacity: 0.45,
    backHeadline: project?.title || 'About the Book',
    backBlurb:
      firstSynopsis ||
      'A standalone literary work written and typeset with Bookvibe.',
    authorBio: `${authorName} writes long-form fiction and literary works.`,
    spineTitle: '',
    showBarcodeBox: true,
    frontFlapText: 'A crisp jacket summary for print cloth and hardcover editions.',
    backFlapText: `${authorName} notes, colophon, and imprint credit.`,
    graphicLayers: [],
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
  if (file.size > 12 * 1024 * 1024) {
    return Promise.reject(new Error('Image exceeds 12 MB limit.'));
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

async function drawGraphicLayersOnRect(
  ctx: CanvasRenderingContext2D,
  layers: CoverGraphicLayer[],
  ox: number,
  oy: number,
  boxW: number,
  boxH: number,
): Promise<void> {
  for (const layer of layers) {
    const img = await loadImage(layer.dataUrl);
    if (!img) continue;
    const targetW = (Math.max(5, Math.min(100, layer.widthPct)) / 100) * boxW;
    const aspect = img.height / Math.max(1, img.width);
    const targetH = targetW * aspect;
    const cx = ox + (layer.xPct / 100) * boxW;
    const cy = oy + (layer.yPct / 100) * boxH;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, layer.opacity));
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotationDeg * Math.PI) / 180);
    ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
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

  ctx.fillStyle = cover.backgroundColor;
  ctx.fillRect(ox, oy, widthPx, heightPx);

  if (cover.backgroundImageDataUrl) {
    const art = await loadImage(cover.backgroundImageDataUrl);
    if (art) {
      const scale = Math.max(widthPx / art.width, heightPx / art.height);
      const dw = art.width * scale;
      const dh = art.height * scale;
      ctx.drawImage(art, ox + (widthPx - dw) / 2, oy + (heightPx - dh) / 2, dw, dh);
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

  await drawGraphicLayersOnRect(
    ctx,
    (cover.graphicLayers ?? []).filter((l) => l.face === 'front'),
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
    const content = options.uppercase ? text.toUpperCase() : text;
    const pxSize = Math.round(placement.fontSize * scaleFactor);
    ctx.fillStyle = options.color ?? cover.textColor;
    ctx.font = `${options.italic ? 'italic ' : ''}${options.weight ?? '500'} ${pxSize}px ${fontStack}`;
    ctx.textAlign = placement.align;
    ctx.textBaseline = 'middle';
    const x = ox + (placement.xPct / 100) * widthPx;
    let y = oy + (placement.yPct / 100) * heightPx;
    const maxW = widthPx - pad * 2.2;
    const lines = wrapCanvasLines(ctx, content, maxW);
    const lineStep = pxSize * 1.18;
    const totalH = (lines.length - 1) * lineStep;
    y -= totalH / 2;
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += lineStep;
    }
  };

  drawTextElement(cover.editionLabel, cover.elements.edition, {
    uppercase: true,
    weight: '600',
    color: cover.accentColor,
  });
  drawTextElement(project.title, cover.elements.title, { weight: '600' });
  drawTextElement(project.subtitle, cover.elements.subtitle, { italic: true });
  drawTextElement(penName, cover.elements.author, { uppercase: true, weight: '600' });

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

export async function renderCoverToPngDataUrl(
  project: BookProject,
  widthPx = 1200,
  heightPx = 1920,
): Promise<string> {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  await paintFrontFaceOnContext(ctx, project, 0, 0, widthPx, heightPx);
  return canvas.toDataURL('image/png');
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
  await drawGraphicLayersOnRect(
    ctx,
    (cover.graphicLayers ?? []).filter((l) => l.face === 'back'),
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
    ctx.fillText(project.publishing?.isbn || 'BOOKVIBE PRESS', faceW - pad - 224, faceH - pad - 24);
  }

  // Spine face
  ctx.fillStyle = cover.spineBackgroundColor || cover.backgroundColor;
  ctx.fillRect(faceW, 0, spineW, faceH);
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
