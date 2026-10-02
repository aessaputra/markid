import { containTransform } from './geometry';
import { composeWatermark } from './watermark';
import type { LoadedImage, Size, Watermark } from './types';

export type PreviewCache = {
  source: ImageBitmap;
  image: Size;
  viewport: Size;
  dpr: number;
  readonly released: boolean;
  dispose(): void;
};

/** Rebuild only on image/viewport/DPR change, never on pointer/style changes.
 * Does not own LoadedImage. Caller closes this cache after replacement/unmount.
 */
export async function createPreviewCache(image: LoadedImage, viewport: Size, dpr = 1): Promise<PreviewCache> {
  const t = containTransform(image.size, viewport);
  if (!Number.isFinite(dpr) || dpr <= 0) throw new RangeError('DPR must be positive and finite.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(image.size.width * t.scale * dpr));
  canvas.height = Math.max(1, Math.ceil(image.size.height * t.scale * dpr));
  let source: ImageBitmap;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas renderer is unavailable.');
    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    source = await createImageBitmap(canvas);
  } finally { canvas.width = canvas.height = 0; }
  let released = false;
  return {
    source, image: { ...image.size }, viewport: { ...viewport }, dpr,
    get released() { return released; },
    dispose() { if (!released) { released = true; source.close(); } },
  };
}

/** ctx canvas backing must be viewport * dpr. Uses only the reduced cached source. */
export function drawPreview(ctx: CanvasRenderingContext2D, cache: PreviewCache, bitmap: ImageBitmap, mark: Watermark): void {
  if (cache.released) throw new Error('Preview cache has been released.');
  const { image, viewport, dpr } = cache;
  const t = containTransform(image, viewport);
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
    ctx.scale(dpr, dpr);
    ctx.drawImage(cache.source, t.x, t.y, image.width * t.scale, image.height * t.scale);
    ctx.beginPath();ctx.rect(t.x, t.y, image.width * t.scale, image.height * t.scale);ctx.clip();
    ctx.translate(t.x, t.y);ctx.scale(t.scale, t.scale);
    composeWatermark(ctx, bitmap, mark, image);
  } finally { ctx.restore(); }
}
