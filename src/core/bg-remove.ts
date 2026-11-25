/**
 * Offline client-side Canvas background remover using edge-connected flood fill
 * with smooth alpha feathering so writers can cleanly isolate illustrations and photos.
 */
export async function removeImageBackgroundClient(
  sourceDataUrl: string,
  tolerance = 44,
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Background removal requires a browser canvas.');
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode image for background removal.'));
    el.src = sourceDataUrl;
  });

  const maxDim = 1200;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample border corners & edge midpoints to determine dominant background color
  const sampleCoords: Array<[number, number]> = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0],
    [Math.floor(w / 2), h - 1],
    [0, Math.floor(h / 2)],
    [w - 1, Math.floor(h / 2)],
  ];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (const [sx, sy] of sampleCoords) {
    const idx = (sy * w + sx) * 4;
    if (data[idx + 3] > 20) {
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
      count++;
    }
  }
  const bgR = count > 0 ? sumR / count : 255;
  const bgG = count > 0 ? sumG / count : 255;
  const bgB = count > 0 ? sumB / count : 255;

  const tol = Math.max(10, Math.min(130, tolerance));
  const hardDistSq = tol * tol * 3;
  const featherOuter = (tol + 24) * (tol + 24) * 3;

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const colorDistSq = (pixelIdx: number): number => {
    const i = pixelIdx * 4;
    const dr = data[i] - bgR;
    const dg = data[i + 1] - bgG;
    const db = data[i + 2] - bgB;
    return dr * dr + dg * dg + db * db;
  };

  const trySeed = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p]) return;
    if (data[p * 4 + 3] < 20 || colorDistSq(p) <= hardDistSq * 1.15) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  // BFS flood-fill from image border so interior colors matching the background stay intact
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const i = cur * 4;
    data[i + 3] = 0;

    const neighbors: Array<[number, number]> = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (visited[np]) continue;
      const dSq = colorDistSq(np);
      if (dSq <= hardDistSq || data[np * 4 + 3] < 16) {
        visited[np] = 1;
        queue[tail++] = np;
      } else if (dSq <= featherOuter) {
        // Soft edge anti-alias feathering on boundary pixels
        const factor = (dSq - hardDistSq) / Math.max(1, featherOuter - hardDistSq);
        data[np * 4 + 3] = Math.round(data[np * 4 + 3] * Math.max(0, Math.min(1, factor)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}
