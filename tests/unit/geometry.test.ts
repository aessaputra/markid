import { expect, test } from 'vitest';
import { clampImagePoint, containTransform, toImagePoint, toViewportPoint } from '../../src/lib/editor/geometry';

test('letterboxed coordinates round trip', () => {
  const image = { width: 2400, height: 3200 };
  const viewport = { width: 800, height: 550 };
  const p = { x: 1200, y: 1600 };
  expect(toViewportPoint(p, image, viewport)).toEqual({ x: 400, y: 275 });
  const q = toImagePoint(toViewportPoint(p, image, viewport), image, viewport);
  expect(q.x).toBeCloseTo(p.x, 8);
  expect(q.y).toBeCloseTo(p.y, 8);
});

test('drag clamps in image space after removing letterbox offsets', () => {
  const image = { width: 2400, height: 3200 };
  expect(clampImagePoint(toImagePoint({ x: 0, y: 700 }, image, { width: 800, height: 550 }), image)).toEqual({ x: 0, y: 3200 });
});

for (const image of [{ width: 3200, height: 1800 }, { width: 1000, height: 1000 }, { width: 800, height: 2400 }]) {
  test(`exact contain edges and inverse for ${image.width}x${image.height}`, () => {
    const viewport = { width: 317, height: 431 };
    const t = containTransform(image, viewport);
    for (const p of [{ x: 0, y: 0 }, { x: image.width, y: image.height }, { x: image.width * .231, y: image.height * .867 }]) {
      const q = toImagePoint(toViewportPoint(p, image, viewport), image, viewport);
      expect(Math.abs(q.x - p.x) * t.scale).toBeLessThanOrEqual(1);
      expect(Math.abs(q.y - p.y) * t.scale).toBeLessThanOrEqual(1);
    }
  });
}

test('zero and non-finite dimensions fail explicitly', () => {
  for (const width of [0, -1, Infinity, NaN]) expect(() => containTransform({ width, height: 100 }, { width: 100, height: 100 })).toThrow(RangeError);
});
