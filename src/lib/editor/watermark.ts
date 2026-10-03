import type { Point, Size, Watermark } from './types';

export function tiledCenters(area: Size, tile: Size, angleDeg: number): Point[] {
  for (const v of [area.width, area.height, tile.width, tile.height]) {
    if (!Number.isFinite(v) || v <= 0) throw new RangeError('Tiled layout dimensions must be positive and finite.');
  }
  const angle = Number.isFinite(angleDeg) ? angleDeg : 0;
  const stepX = tile.width * 2;
  const stepY = tile.height * 2;
  const cx = area.width / 2, cy = area.height / 2;
  const radius = Math.hypot(area.width, area.height) / 2;
  const theta = (angle % 360) * Math.PI / 180;
  const cos = Math.cos(-theta), sin = Math.sin(-theta);
  const points: Point[] = [];
  let row = 0;
  for (let y = -radius; y <= radius; y += stepY, row++) {
    const offset = row % 2 === 1 ? stepX / 2 : 0;
    for (let x = -radius + offset; x <= radius; x += stepX) {
      const dx = x, dy = y;
      const px = cx + dx * cos - dy * sin;
      const py = cy + dx * sin + dy * cos;
      if (px < -tile.width || px > area.width + tile.width || py < -tile.height || py > area.height + tile.height) continue;
      points.push({ x: px, y: py });
      if (points.length >= 500) return points;
    }
  }
  return points;
}

export function composeTiledWatermark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap, mark: Watermark, area: Size,
): void {
  const centers = tiledCenters(area, { width: bitmap.width, height: bitmap.height }, mark.angle);
  const theta = (mark.angle * Math.PI) / 180;
  ctx.save();
  try {
    ctx.globalAlpha = mark.opacity;
    for (const c of centers) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(theta);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      ctx.restore();
    }
  } finally { ctx.restore(); }
}

/** Compose in image-space units. Caller supplies preview scale/offset/DPR transform.
 * Reuse the same bitmap/layout for preview and export; neither function mutates it.
 */
export function composeWatermark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap, mark: Watermark, area: Size,
): void {
  if (mark.mode === 'tiled') { composeTiledWatermark(ctx, bitmap, mark, area); return; }
  ctx.save();
  try {
    ctx.translate(mark.x * area.width, mark.y * area.height);
    ctx.rotate(mark.angle * Math.PI / 180);
    ctx.globalAlpha = mark.opacity;
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  } finally { ctx.restore(); }
}

function canvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const surface = new OffscreenCanvas(width, height);
      if (surface.getContext('2d')) return surface;
      surface.width = surface.height = 0;
    } catch { /* Use the explicit document Canvas fallback when available. */ }
  }
  if (typeof document === 'undefined') throw new Error('Canvas renderer is unavailable.');
  const result = document.createElement('canvas');
  result.width = width; result.height = height;
  return result;
}

/** System sans stack. Main thread, image worker and PDF export share this,
 * so preview and export resolve the same platform font. No webfont fetch. */
export const SYSTEM_FONT = 'system-ui, sans-serif';

/** Font size is relative to the shorter side. Returns unrotated, full-alpha ink with 2px padding.
 * Caller owns bitmap.close(); opacity and clockwise angle belong only to composition.
 */
export async function renderWatermark(mark: Watermark, area: Size): Promise<ImageBitmap> {
  const size = Math.min(area.width, area.height) * mark.sizeRatio;
  if (!Number.isFinite(size) || size <= 0) throw new RangeError('Watermark size must be positive and finite.');
  if (!mark.text.trim()) {
    const empty = canvas(1, 1);
    empty.getContext('2d'); // Chromium needs an initialized OffscreenCanvas backing store.
    return createImageBitmap(empty);
  }
  const surface = canvas(1, 1);
  const ctx = surface.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas renderer is unavailable.');
  const font = `${size}px ${SYSTEM_FONT}`;
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = mark.text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const metrics = lines.map(line => ctx.measureText(line));
  const inkHeight = Math.max(...metrics.map(m => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
  const advance = Math.max(size * 1.25, inkHeight + size * .2);
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  metrics.forEach((m, index) => {
    if (!lines[index].trim()) return;
    left = Math.min(left, -m.actualBoundingBoxLeft);
    right = Math.max(right, m.actualBoundingBoxRight);
    top = Math.min(top, index * advance - m.actualBoundingBoxAscent);
    bottom = Math.max(bottom, index * advance + m.actualBoundingBoxDescent);
  });
  const padding = 2;
  surface.width = Math.ceil(right - left) + padding * 2;
  surface.height = Math.ceil(bottom - top) + padding * 2;
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = mark.color;
  lines.forEach((line, index) => ctx.fillText(line, padding - left, padding - top + index * advance));
  return createImageBitmap(surface);
}
