import type { Point, Size } from './types';

export function containTransform(image: Size, viewport: Size) {
  for (const value of [image.width, image.height, viewport.width, viewport.height]) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError('Dimensions must be positive and finite.');
  }
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { scale, x: (viewport.width - image.width * scale) / 2, y: (viewport.height - image.height * scale) / 2 };
}

/** Clamp the center anchor, not the rotated ink bounds.
 * Drag uses this so half the watermark may hang past the edge (BentoPDF parity). */
export function clampImagePoint(point: Point, image: Size): Point {
  return { x: Math.max(0, Math.min(image.width, point.x)), y: Math.max(0, Math.min(image.height, point.y)) };
}

/** Half extents of a box rotated clockwise by angleDeg. */
export function rotatedHalfExtents(box: Size, angleDeg: number): Size {
  if (!Number.isFinite(angleDeg)) return { width: box.width / 2, height: box.height / 2 };
  const theta = ((angleDeg % 360) * Math.PI) / 180;
  const c = Math.abs(Math.cos(theta)), s = Math.abs(Math.sin(theta));
  return { width: (box.width * c + box.height * s) / 2, height: (box.width * s + box.height * c) / 2 };
}

/** Inset a nominal preset so the full rotated watermark stays visible.
 * Presets use this so a tap never clips text; drag keeps clampImagePoint
 * and may still hang half out. Oversized watermarks fall back to center. */
export function clampPresetToVisible(nominal: Point, image: Size, watermark: Size, angleDeg = 0): Point {
  for (const value of [image.width, image.height, watermark.width, watermark.height]) {
    if (!Number.isFinite(value) || value <= 0) return { ...nominal };
  }
  const half = rotatedHalfExtents(watermark, angleDeg);
  const cx = nominal.x * image.width, cy = nominal.y * image.height;
  const minX = half.width, maxX = image.width - half.width;
  const minY = half.height, maxY = image.height - half.height;
  return {
    x: (minX <= maxX ? Math.max(minX, Math.min(maxX, cx)) : image.width / 2) / image.width,
    y: (minY <= maxY ? Math.max(minY, Math.min(maxY, cy)) : image.height / 2) / image.height,
  };
}

export function toImagePoint(point: Point, image: Size, viewport: Size): Point {
  const t = containTransform(image, viewport);
  return { x: (point.x - t.x) / t.scale, y: (point.y - t.y) / t.scale };
}
