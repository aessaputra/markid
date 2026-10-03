import { expect, test } from 'vitest';
import { tiledCenters } from '../../src/lib/editor/watermark';

test('tiled grid covers area at 0 and 45 degrees with stagger', () => {
  const area = { width: 1200, height: 800 };
  const tile = { width: 200, height: 40 };
  for (const angle of [0, 45]) {
    const centers = tiledCenters(area, tile, angle);
    expect(centers.length).toBeGreaterThan(1);
    expect(centers.length).toBeLessThanOrEqual(500);
    const rows = new Map<number, number[]>();
    for (const c of centers) {
      const key = Math.round(c.y / 80);
      rows.set(key, [...(rows.get(key) ?? []), c.x]);
    }
    expect(rows.size).toBeGreaterThanOrEqual(5);
  }
  const flat = tiledCenters(area, tile, 0);
  const ys = [...new Set(flat.map((c) => Math.round(c.y)))].sort((a, b) => a - b).slice(0, 2);
  const row0 = flat.filter((c) => Math.round(c.y) === ys[0]).map((c) => c.x).sort((a, b) => a - b);
  const row1 = flat.filter((c) => Math.round(c.y) === ys[1]).map((c) => c.x).sort((a, b) => a - b);
  expect(Math.abs(row0[0] - row1[0])).toBeCloseTo(200, 0);
});

test('tiled rejects bad dimensions', () => {
  expect(() => tiledCenters({ width: 0, height: 800 }, { width: 200, height: 40 }, 0)).toThrow(RangeError);
  expect(() => tiledCenters({ width: 1200, height: 800 }, { width: -5, height: 40 }, 0)).toThrow(RangeError);
});
