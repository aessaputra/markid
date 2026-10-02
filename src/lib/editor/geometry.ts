import type { Point, Size } from './types';

export function containTransform(image: Size, viewport: Size) {
  for (const value of [image.width, image.height, viewport.width, viewport.height]) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError('Dimensions must be positive and finite.');
  }
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { scale, x: (viewport.width - image.width * scale) / 2, y: (viewport.height - image.height * scale) / 2 };
}

/** Clamp the center anchor, not the rotated ink bounds. */
export function clampImagePoint(point: Point, image: Size): Point {
  return { x: Math.max(0, Math.min(image.width, point.x)), y: Math.max(0, Math.min(image.height, point.y)) };
}

export function toImagePoint(point: Point, image: Size, viewport: Size): Point {
  const t = containTransform(image, viewport);
  return { x: (point.x - t.x) / t.scale, y: (point.y - t.y) / t.scale };
}

export function toViewportPoint(point: Point, image: Size, viewport: Size): Point {
  const t = containTransform(image, viewport);
  return { x: point.x * t.scale + t.x, y: point.y * t.scale + t.y };
}
