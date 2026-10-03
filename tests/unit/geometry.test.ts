import { expect, test } from 'vitest';
import { clampImagePoint, clampPresetToVisible, containTransform, rotatedHalfExtents, toImagePoint } from '../../src/lib/editor/geometry';

test('letterboxed coordinates round trip', () => {
  const image = { width: 2400, height: 3200 };
  const viewport = { width: 800, height: 550 };
  const p = { x: 1200, y: 1600 };
  const q = toImagePoint({ x: 400, y: 275 }, image, viewport);
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
      const projected = { x: p.x * t.scale + t.x, y: p.y * t.scale + t.y };
      const q = toImagePoint(projected, image, viewport);
      expect(Math.abs(q.x - p.x) * t.scale).toBeLessThanOrEqual(1);
      expect(Math.abs(q.y - p.y) * t.scale).toBeLessThanOrEqual(1);
    }
  });
}

test('zero and non-finite dimensions fail explicitly', () => {
  for (const width of [0, -1, Infinity, NaN]) expect(() => containTransform({ width, height: 100 }, { width: 100, height: 100 })).toThrow(RangeError);
});

test('drag keeps center clamp so half may hang out (BentoPDF parity)', () => {
  expect(clampImagePoint({ x: -40, y: 3201 }, { width: 2400, height: 3200 })).toEqual({ x: 0, y: 3200 });
});

test('corner presets inset the full rotated watermark into view', () => {
  const image = { width: 1200, height: 800 };
  const watermark = { width: 640, height: 64 };
  for (const nominal of [{ x: .15, y: .15 }, { x: .85, y: .15 }, { x: .15, y: .85 }, { x: .85, y: .85 }]) {
    const p = clampPresetToVisible(nominal, image, watermark, 0);
    const half = rotatedHalfExtents(watermark, 0);
    expect(p.x * image.width - half.width).toBeGreaterThanOrEqual(0);
    expect(p.x * image.width + half.width).toBeLessThanOrEqual(image.width);
    expect(p.y * image.height - half.height).toBeGreaterThanOrEqual(0);
    expect(p.y * image.height + half.height).toBeLessThanOrEqual(image.height);
  }
  const tipped = clampPresetToVisible({ x: .15, y: .85 }, image, watermark, 35);
  const half = rotatedHalfExtents(watermark, 35);
  expect(tipped.x * image.width - half.width).toBeGreaterThanOrEqual(0);
  expect(tipped.x * image.width + half.width).toBeLessThanOrEqual(image.width);
  expect(tipped.y * image.height - half.height).toBeGreaterThanOrEqual(0);
  expect(tipped.y * image.height + half.height).toBeLessThanOrEqual(image.height);
  expect(clampPresetToVisible({ x: .15, y: .85 }, { width: 100, height: 100 }, { width: 400, height: 200 })).toEqual({ x: .5, y: .5 });
});
