import { FONT_STACKS } from './export';
import { ensureAuthorIdentity } from './identity';
import { getProjectWordCount } from './manuscript';
import type { BookCoverConfig, BookProject, CoverTemplateId } from './types';

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

export function defaultBookCover(project?: BookProject): BookCoverConfig {
  const firstSynopsis = project?.parts[0]?.chapters[0]?.scenes[0]?.synopsis ?? '';
  return {
    template: 'obsidian-foil',
    backgroundColor: '#0d0f14',
    accentColor: '#c7a97b',
    textColor: '#f2ede2',
    backgroundImageDataUrl: '',
    imageOverlayOpacity: 0.45,
    backBlurb:
      firstSynopsis ||
      'A standalone literary work written and typeset with Bookvibe.',
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
  // Standard cream trade paper (~0.0025" per page)
  return Number((estPages * 0.0025).toFixed(2));
}

export function downscaleImageFileToDataUrl(
  file: File,
  maxDimension = 1400,
): Promise<string> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return Promise.reject(new Error('Only PNG, JPEG, or WebP images are supported.'));
  }
  if (file.size > 12 * 1024 * 1024) {
    return Promise.reject(new Error('Image exceeds 12 MB limit.'));
  }

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
        resolve(canvas.toDataURL('image/jpeg', 0.88));
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

/**
 * Renders the Front Cover at print/eBook PNG resolution (`1200×1920`) for PNG export and EPUB 3 embedding.
 */
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

  const cover = project.cover ?? defaultBookCover(project);
  const identity = ensureAuthorIdentity(project);
  const penName = identity.penName || project.author || 'Author';
  const fontStack = FONT_STACKS[project.typography.fontFamily].css;

  // Base background
  ctx.fillStyle = cover.backgroundColor;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Optional artwork image with dark/tinted overlay
  if (cover.backgroundImageDataUrl) {
    const art = await loadImage(cover.backgroundImageDataUrl);
    if (art) {
      const scale = Math.max(widthPx / art.width, heightPx / art.height);
      const dw = art.width * scale;
      const dh = art.height * scale;
      ctx.drawImage(art, (widthPx - dw) / 2, (heightPx - dh) / 2, dw, dh);
      ctx.fillStyle = cover.backgroundColor;
      ctx.globalAlpha = Math.max(0, Math.min(0.9, cover.imageOverlayOpacity));
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.globalAlpha = 1;
    }
  }

  // Template structural geometry
  const pad = Math.round(widthPx * 0.075);
  ctx.strokeStyle = cover.accentColor;
  ctx.lineWidth = Math.max(2, Math.round(widthPx * 0.003));
  if (cover.template === 'obsidian-foil' || cover.template === 'ivory-classic') {
    ctx.strokeRect(pad, pad, widthPx - pad * 2, heightPx - pad * 2);
  } else if (cover.template === 'editorial-band') {
    ctx.fillStyle = cover.accentColor;
    ctx.fillRect(0, Math.round(heightPx * 0.62), widthPx, Math.round(heightPx * 0.014));
  } else if (cover.template === 'minimal-spine') {
    ctx.fillStyle = cover.accentColor;
    ctx.fillRect(pad, pad, Math.round(widthPx * 0.012), heightPx - pad * 2);
  }

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
    const x = (placement.xPct / 100) * widthPx;
    let y = (placement.yPct / 100) * heightPx;
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
        const sx = (cover.elements.signature.xPct / 100) * widthPx - sigW / 2;
        const sy = (cover.elements.signature.yPct / 100) * heightPx - sigH / 2;
        ctx.drawImage(sigImg, sx, sy, sigW, sigH);
      }
    } else if (identity.signatureText) {
      drawTextElement(identity.signatureText, cover.elements.signature, {
        italic: true,
        color: cover.accentColor,
      });
    }
  }

  return canvas.toDataURL('image/png');
}
