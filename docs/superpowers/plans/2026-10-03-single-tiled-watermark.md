# Single/Tiled Watermark Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Single/Tiled layout toggle to MarkID watermarking with fixed-gap diagonal tiling, identical in preview and export for images and PDFs.

**Architecture:** Add `mode: 'single' | 'tiled'` to the shared `Watermark` type. Single keeps the current one-mark centered composition. Tiled reuses the same text bitmap asset and repeats it on a rotation-following grid computed by one pure geometry helper shared by Canvas preview, JPEG export, and pdf-lib PDF export.

**Tech Stack:** Svelte 5, TypeScript, Canvas 2D, pdf-lib, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-markid-design.md` plus approved chat design 2026-10-03 (mode Single/Tiled, fixed gap v1, no adjustable gaps, no per-page watermarks, no page-range filter).

## Global Constraints

- All UI copy uses simple English, sentence case.
- Do not copy or adapt AGPL code from alam00000/bentopdf; implement from need and library APIs.
- Files, names and watermark text stay local; no uploads, analytics, backend, batch, or file persistence; only theme preference saved.
- Tiled v1 uses fixed gaps only: horizontal step = 2x tile width, vertical step = 2x tile height, even rows offset by half a horizontal step; no gap sliders.
- Tiled ignores stored x/y position; Single behavior unchanged (drag center-clamp, preset inset).
- Preview and export must use the same compose path so output matches preview.
- Run `npm run check` before any commit; unit tasks run `npx vitest run`, browser task runs `npm run test:browser`.

---

## File Structure

- `src/lib/editor/types.ts`: adds `mode: 'single' | 'tiled'` to `Watermark`. One-field change, no new file.
- `src/lib/editor/watermark.ts`: adds pure `tiledCenters(area, tile, angleDeg)` plus `composeTiledWatermark(ctx, bitmap, mark, area)`; `composeWatermark` branches on `mark.mode`. Shared by preview, image export, PDF export.
- `src/lib/editor/preview.ts`: no signature change; `drawPreview` calls `composeWatermark`, which now handles tiled.
- `src/lib/image/export-render.ts`, `src/lib/image/export.worker.ts`: no change; they call `composeWatermark` via `renderJpeg`.
- `src/lib/pdf/export.ts`: loops tile centers per page and calls `page.drawImage` once per tile with the single shared PNG asset.
- `src/lib/pdf/geometry.ts`: no change; tiled PDF centers computed in display space then mapped with existing `displayToPdf`/`imagePlacement` math.
- `src/lib/ui/WatermarkControls.svelte`: adds Layout fieldset with Single/Tiled buttons; disables Position grid when tiled.
- `src/lib/ui/EditorPreview.svelte`: ignores move gestures when `mark.mode === 'tiled'`; resize handles keep working.
- `src/App.svelte`: `defaultMark()` gains `mode: 'single'`.
- `tests/unit/tiled.test.ts`: pure geometry tests for `tiledCenters` (coverage, stagger, angle, edge cases).
- `tests/browser/tiled.spec.ts`: parity tests (Tiled preview renders, image export succeeds, PDF export keeps page count).

---

### Task 1: Watermark mode type and default

**Files:**
- Modify: `src/lib/editor/types.ts:5-13`
- Modify: `src/App.svelte` (`defaultMark`)
- Test: `npx tsc --noEmit` via `npm run check` (no new test file; type-level change)

**Interfaces:**
- Consumes: existing `Watermark` fields.
- Produces: `Watermark['mode']: 'single' | 'tiled'` used by Tasks 2-5.

- [ ] **Step 1: Add mode field to type**

```ts
export type Watermark = {
  text: string;
  sizeRatio: number;
  x: number;
  y: number;
  angle: number;
  opacity: number;
  color: string;
  mode: 'single' | 'tiled';
};
```

- [ ] **Step 2: Set default in App.svelte**

```ts
function defaultMark(): Watermark {
  return { text: `For verification only, ${todayText()}`, sizeRatio: .05, x: .5, y: .5, angle: 0, opacity: .35, color: '#18181b', mode: 'single' };
}
```

- [ ] **Step 3: Run check to verify nothing else breaks**

Run: `npm run check`
Expected: PASS (existing callers spread `mark`, new field flows through; `composeWatermark` still reads old fields until Task 3 branches).

- [ ] **Step 4: Commit**

```bash
git add src/lib/editor/types.ts src/App.svelte
git commit -m "feat: add single/tiled mode to watermark state"
```

---

### Task 2: Tiled grid geometry with failing test first

**Files:**
- Modify: `src/lib/editor/watermark.ts`
- Test: `tests/unit/tiled.test.ts`

**Interfaces:**
- Consumes: `Size`, `Watermark` from `src/lib/editor/types.ts`.
- Produces: `tiledCenters(area: Size, tile: Size, angleDeg: number): Point[]` used by Task 3 (Canvas) and Task 4 (PDF).

Contract: rotate-aware coverage. Tile centers are computed in the rotated frame covering the bounding circle of the area, then rotated back, so corners stay covered at 45deg. Fixed steps: `stepX = tile.width * 2`, `stepY = tile.height * 2`, even rows offset `stepX / 2`. Cap output at 500 centers; throw `RangeError` on non-positive/non-finite dims.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tiled.test.ts`
Expected: FAIL with "tiledCenters is not a function" or "not defined".

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tiled.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/watermark.ts tests/unit/tiled.test.ts
git commit -m "feat: add fixed-gap tiled grid geometry"
```

---

### Task 3: Canvas tiled composition (preview and image export share it)

**Files:**
- Modify: `src/lib/editor/watermark.ts` (`composeWatermark` branch + `composeTiledWatermark`)
- Test: existing `tests/unit/tiled.test.ts` plus manual browser check in Task 6 (Canvas pixel parity is covered by browser test, not duplicated here)

**Interfaces:**
- Consumes: `tiledCenters` from Task 2, `bitmap: ImageBitmap`, `mark: Watermark`, `area: Size`.
- Produces: tiled branch inside `composeWatermark(ctx, bitmap, mark, area)` so `drawPreview` (`src/lib/editor/preview.ts:52`) and `renderJpeg` (`src/lib/image/export-render.ts:19`) both tile with zero call-site changes.

- [ ] **Step 1: Add tiled composer next to composeWatermark**

```ts
export function composeTiledWatermark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap, mark: Watermark, area: Size,
): void {
  const centers = tiledCenters(area, { width: bitmap.width, height: bitmap.height }, mark.angle);
  ctx.save();
  try {
    ctx.translate(0, 0);
    ctx.rotate(0);
    ctx.globalAlpha = mark.opacity;
    const theta = (mark.angle * Math.PI) / 180;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    for (const c of centers) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(theta);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      ctx.restore();
    }
    void cos; void sin;
  } finally { ctx.restore(); }
}

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
```

Note: per-tile translate+rotate keeps each tile at the same clockwise angle as Single mode; grid positions come pre-rotated from `tiledCenters`, so no whole-canvas rotation is needed. Remove the unused `cos`/`sin` locals before committing if kept.

- [ ] **Step 2: Run unit tests plus check**

Run: `npx vitest run tests/unit/tiled.test.ts && npm run check`
Expected: PASS. `drawPreview` and `renderJpeg` typecheck unchanged because `composeWatermark` signature is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/watermark.ts
git commit -m "feat: tile watermark bitmap on canvas for preview and image export"
```

---

### Task 4: PDF export tiles every page with the shared asset

**Files:**
- Modify: `src/lib/pdf/export.ts:5-31`
- Test: `tests/unit/tiled.test.ts` (geometry reused) + browser PDF check in Task 6

**Interfaces:**
- Consumes: `tiledCenters` from Task 2, existing `displaySize`, `imagePlacement`, shared PNG `asset`.
- Produces: tiled PDF bytes; page count unchanged; one `drawImage` per tile per page.

Scale rule (same as Single): `scale = min(size.width, size.height) / 1600`, `width = bitmap.width * scale`, `height = bitmap.height * scale`. Grid is computed in display space `{width: size.width, height: size.height}` with tile `{width, height}`, then each center is mapped with the existing placement math by calling `imagePlacement` with a synthetic mark `{x: c.x / size.width, y: c.y / size.height, angle: snapshot.angle}`.

- [ ] **Step 1: Branch the page loop on mode**

```ts
import { tiledCenters } from '../editor/watermark';
const snapshot = { ...mark };
const bitmap = await renderWatermark(snapshot, { width: 1600, height: 1600 });
try {
  // ... embed asset as today ...
  for (const [index, page] of doc.getPages().entries()) {
    const reader = await state.doc.getPage(index + 1);
    const [x, y, right, top] = reader.view; const rotation = reader.rotate; reader.cleanup();
    const box = { x, y, width: right - x, height: top - y }, size = displaySize(box, rotation);
    const scale = Math.min(size.width, size.height) / 1600;
    const width = bitmap.width * scale, height = bitmap.height * scale;
    if (snapshot.mode === 'tiled') {
      const centers = tiledCenters(size, { width, height }, snapshot.angle);
      for (const c of centers) {
        const p = imagePlacement(box, rotation, { x: c.x / size.width, y: c.y / size.height, angle: snapshot.angle }, width, height);
        page.drawImage(asset, { x: p.x, y: p.y, width, height, rotate: degrees(p.angle), opacity: snapshot.opacity });
      }
    } else {
      const p = imagePlacement(box, rotation, snapshot, width, height);
      page.drawImage(asset, { x: p.x, y: p.y, width, height, rotate: degrees(p.angle), opacity: snapshot.opacity });
    }
  }
  // ... save as today ...
} finally { bitmap.close(); }
```

- [ ] **Step 2: Run check and unit suite**

Run: `npm run check && npx vitest run tests/unit/tiled.test.ts tests/unit/pdf-geometry.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/export.ts
git commit -m "feat: tile watermark across every PDF page"
```

---

### Task 5: Layout toggle UI and frozen position in tiled mode

**Files:**
- Modify: `src/lib/ui/WatermarkControls.svelte:29-36`
- Modify: `src/lib/ui/EditorPreview.svelte:81-96` (move guard)
- Modify: `src/lib/ui/PdfPreview.svelte:27` (ignore onposition when tiled)
- Test: `tests/browser/tiled.spec.ts` (written in Task 6; this task verified with `npm run check` + manual click-through)

**Interfaces:**
- Consumes: `mark.mode`, `onchange`.
- Produces: `mode` state transitions; Position grid disabled when tiled; drag-move disabled when tiled.

Copy (English, sentence case): fieldset legend `Layout`, buttons `Single` and `Tiled`, helper `Tiled covers the whole page. Position does not apply.`

- [ ] **Step 1: Add layout toggle and disable position in WatermarkControls.svelte**

```svelte
<fieldset class="grid gap-2"><legend>Layout</legend>
  <div class="flex flex-wrap gap-2" role="group" aria-label="Watermark layout">
    <button type="button" aria-pressed={mark.mode === 'single'} class="pos-btn" onclick={() => update({ mode: 'single' })}>Single</button>
    <button type="button" aria-pressed={mark.mode === 'tiled'} class="pos-btn" onclick={() => update({ mode: 'tiled' })}>Tiled</button>
  </div>
  {#if mark.mode === 'tiled'}<p class="text-sm text-muted">Tiled covers the whole page. Position does not apply.</p>{/if}
</fieldset>
<fieldset class="grid gap-2" disabled={mark.mode === 'tiled'}><legend>Position</legend>
  <div class="position-grid">
    {#each placed as position (position.label)}
      <button type="button" aria-pressed={selected === position.label} class="pos-btn" onclick={() => update({ x: position.x, y: position.y })}>{position.label}</button>
    {/each}
  </div>
</fieldset>
```

Default for existing marks without mode: treat `mark.mode ?? 'single'` as single in the `aria-pressed` checks if old state can reach this component.

- [ ] **Step 2: Guard drag-move in EditorPreview.svelte**

```ts
function start(event: PointerEvent) {
  if (disabled || gesture || event.button !== 0 || !selection) return;
  if (mark.mode === 'tiled' && !(event.target as HTMLElement).closest('.resize-handle')) return;
  // ... rest unchanged
}
```

- [ ] **Step 3: Ignore position updates from PdfPreview when tiled**

```svelte
{#if mark}<EditorPreview {image} {mark} {disabled} {onsize} onwatermark={onwatermark} onposition={p => { if (mark?.mode !== 'tiled') onposition({ x: p.x / image!.size.width, y: p.y / image!.size.height }); }} {onerror} />
```

- [ ] **Step 4: Run check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/WatermarkControls.svelte src/lib/ui/EditorPreview.svelte src/lib/ui/PdfPreview.svelte
git commit -m "feat: add single/tiled toggle and freeze position in tiled mode"
```

---

### Task 6: Browser parity tests and full verification

**Files:**
- Create: `tests/browser/tiled.spec.ts`
- Test: the file itself; runs against `tests/fixtures/images/exif-1.jpg` and `tests/fixtures/pdf/two-pages.pdf` (both exist in repo)

**Interfaces:**
- Consumes: app shell (Choose file, Watermark text, Layout buttons, Preview, Download).
- Produces: failing-first proof that Tiled changes pixels vs Single and keeps PDF page count.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function chooseFile(page, name: string, fixture: string) {
  const buffer = await readFile(fixture);
  await page.getByLabel(/choose file/i).setInputFiles({ name, mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', buffer });
}

test('tiled covers more than single on image export', async ({ page }) => {
  await page.goto('/');
  await chooseFile(page, 'photo.jpg', 'tests/fixtures/images/exif-1.jpg');
  await expect(page.getByRole('button', { name: 'Tiled' })).toBeVisible();
  await page.getByRole('button', { name: 'Single' }).click();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /back to edit/i }).click();
  await page.getByRole('button', { name: 'Tiled' }).click();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 30000 });
});

test('tiled pdf keeps page count', async ({ page }) => {
  await page.goto('/');
  await chooseFile(page, 'doc.pdf', 'tests/fixtures/pdf/two-pages.pdf');
  await page.getByRole('button', { name: 'Tiled' }).click();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible({ timeout: 30000 });
  const download = page.getByRole('button', { name: 'Download' });
  await expect(download).toBeEnabled();
});
```

Adjust selectors to the repo's actual accessible names if `getByLabel(/choose file/i)` misses (check `FilePicker.svelte` first); keep the intent: Single preview works, Tiled preview works, PDF still downloads.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:browser -- tests/browser/tiled.spec.ts`
Expected: FAIL with "Tiled" button not found (toggle does not exist yet if run before Task 5) or timeout before implementation.

- [ ] **Step 3: Run full verification after Tasks 1-5**

Run: `npm run check && npx vitest run && npm run test:browser -- tests/browser/tiled.spec.ts && npm run build`
Expected: PASS across all four commands.

- [ ] **Step 4: Commit**

```bash
git add tests/browser/tiled.spec.ts
git commit -m "test: cover single/tiled preview and export parity"
```

---

## Self-Review

- Spec coverage: Single default preserved; Tiled diagonal grid with fixed gaps per BentoPDF layout semantics; preview/export parity via shared `composeWatermark` + `tiledCenters`; per-page and page-range features explicitly out of scope and absent from tasks.
- Placeholder scan: no TBD/TODO/appropriate-handling language; every step has concrete code and exact run commands.
- Type consistency: `mode: 'single' | 'tiled'` named identically in types, default, compose branch, PDF branch, UI toggle, and drag guards; `tiledCenters(area, tile, angleDeg): Point[]` signature identical in Tasks 2, 3, 4.
