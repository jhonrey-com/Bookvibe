import { newId } from './manuscript';
import type { SceneImageItem, SceneImageWrapMode } from './types';

export const WRAP_MODE_LABELS: Record<SceneImageWrapMode, string> = {
  'square-left': 'Wrap Left',
  'square-right': 'Wrap Right',
  'top-bottom': 'Top & Bottom',
  inline: 'Inline Center',
  'behind-text': 'Behind Text',
};

export interface SnapResult {
  offsetX: number;
  offsetY: number;
  guideX: number | null;
  guideY: number | null;
}

export function computeSnappedImagePosition(
  target: { offsetX: number; offsetY: number; widthPx: number; heightPx: number },
  others: Array<{ offsetX: number; offsetY: number; widthPx: number; heightPx: number }>,
  containerWidth: number,
  options: { snapGrid: boolean; gridPx?: number; magnetPx?: number },
): SnapResult {
  const grid = options.gridPx ?? 12;
  const magnet = options.magnetPx ?? 8;
  let x = target.offsetX;
  let y = target.offsetY;
  let guideX: number | null = null;
  let guideY: number | null = null;

  if (options.snapGrid) {
    x = Math.round(x / grid) * grid;
    y = Math.round(y / grid) * grid;
  }

  // Snap horizontally to paper margins, paper center, and other images' edges/centers
  const xCandidates: Array<{ targetX: number; guide: number }> = [
    { targetX: 0, guide: 0 },
    { targetX: Math.round((containerWidth - target.widthPx) / 2), guide: Math.round(containerWidth / 2) },
    { targetX: Math.max(0, Math.round(containerWidth - target.widthPx)), guide: Math.round(containerWidth) },
  ];
  for (const other of others) {
    xCandidates.push(
      { targetX: other.offsetX, guide: other.offsetX },
      { targetX: other.offsetX + other.widthPx - target.widthPx, guide: other.offsetX + other.widthPx },
      {
        targetX: Math.round(other.offsetX + (other.widthPx - target.widthPx) / 2),
        guide: Math.round(other.offsetX + other.widthPx / 2),
      },
    );
  }
  for (const cand of xCandidates) {
    if (Math.abs(x - cand.targetX) <= magnet) {
      x = cand.targetX;
      guideX = cand.guide;
      break;
    }
  }

  // Snap vertically to other images' top/bottom/center lines
  const yCandidates: Array<{ targetY: number; guide: number }> = [{ targetY: 0, guide: 0 }];
  for (const other of others) {
    yCandidates.push(
      { targetY: other.offsetY, guide: other.offsetY },
      { targetY: other.offsetY + other.heightPx, guide: other.offsetY + other.heightPx },
      {
        targetY: Math.round(other.offsetY + (other.heightPx - target.heightPx) / 2),
        guide: Math.round(other.offsetY + other.heightPx / 2),
      },
    );
  }
  for (const cand of yCandidates) {
    if (Math.abs(y - cand.targetY) <= magnet) {
      y = cand.targetY;
      guideY = cand.guide;
      break;
    }
  }

  return {
    offsetX: Math.max(0, Math.min(Math.max(0, containerWidth - target.widthPx), Math.round(x))),
    offsetY: Math.max(0, Math.round(y)),
    guideX,
    guideY,
  };
}

export async function readImageFileToSceneImage(
  file: File,
  anchorParagraph = 0,
): Promise<SceneImageItem> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid PNG, JPEG, WebP, or GIF image.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });

  const dims = await new Promise<{ w: number; h: number; scaledUrl: string }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth || 480;
      const natH = img.naturalHeight || 320;
      const maxEdge = 1280;
      const ratio = Math.min(1, maxEdge / Math.max(natW, natH));
      const outW = Math.max(1, Math.round(natW * ratio));
      const outH = Math.max(1, Math.round(natH * ratio));
      if (ratio < 1 && typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, outW, outH);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve({ w: outW, h: outH, scaledUrl: canvas.toDataURL(mime, 0.9) });
          return;
        }
      }
      resolve({ w: natW, h: natH, scaledUrl: rawDataUrl });
    };
    img.onerror = () => reject(new Error('Image file could not be decoded.'));
    img.src = rawDataUrl;
  });

  const displayW = Math.min(320, Math.max(140, dims.w));
  const displayH = Math.max(90, Math.round((displayW / Math.max(1, dims.w)) * dims.h));

  return {
    id: newId('img'),
    dataUrl: dims.scaledUrl,
    originalDataUrl: dims.scaledUrl,
    alt: file.name.replace(/\.[^.]+$/, '') || 'Book illustration',
    caption: '',
    widthPx: displayW,
    heightPx: displayH,
    offsetX: 0,
    offsetY: 0,
    wrapMode: 'square-left',
    anchorParagraph: Math.max(0, anchorParagraph),
    bgRemoved: false,
    bgTolerance: 44,
  };
}
