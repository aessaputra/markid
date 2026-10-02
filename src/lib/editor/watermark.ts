import type { Size, Watermark } from './types';

/** Compose in image-space units. Caller supplies preview scale/offset/DPR transform.
 * Reuse the same bitmap/layout for preview and export; neither function mutates it.
 */
export function composeWatermark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap, mark: Watermark, area: Size,
): void {
  ctx.save();
  try {
    ctx.translate(mark.x * area.width, mark.y * area.height);
    ctx.rotate(mark.angle * Math.PI / 180);
    ctx.globalAlpha = mark.opacity;
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  } finally { ctx.restore(); }
}

function canvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const result = document.createElement('canvas');
  result.width = width; result.height = height;
  return result;
}

/** Require registered, loaded faces: fonts.check alone accepts missing families. Workers must register faces first. */
export async function requireFont(family: string, size: number, text: string): Promise<void> {
  const fonts = typeof document === 'undefined'
    ? (globalThis as unknown as { fonts: FontFaceSet }).fonts : document.fonts;
  if (!fonts || !family || /["\\\n\r]/.test(family)) throw new Error('Watermark font could not be loaded.');
  try {
    const faces = await fonts.load(`${size}px "${family}"`, text);
    if (!faces.length || faces.some(face => face.status !== 'loaded' || face.family.replaceAll('"', '').replaceAll("'", '') !== family)) {
      throw new Error('Font is not registered.');
    }
  } catch (cause) {
    throw new Error('Watermark font could not be loaded.', { cause });
  }
}

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
  await requireFont(mark.fontFamily, size, mark.text);
  const surface = canvas(1, 1);
  const ctx = surface.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas renderer is unavailable.');
  const font = `${size}px "${mark.fontFamily}"`;
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
