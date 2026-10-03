# Tiled Gap Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan Horizontal gap dan Vertical gap khusus Tiled, konsisten antara kontrol, preview, JPEG worker/fallback, dan PDF.

**Architecture:** Simpan gap sebagai angka persen di Watermark; ubah menjadi rasio hanya di shared tiledCenters. Canvas dan PDF meneruskan nilai snapshot yang sama ke helper tersebut. Gunakan RangeField yang sudah ada, tanpa dependency atau renderer baru.

**Tech Stack:** Svelte 5, TypeScript, Canvas/OffscreenCanvas, PDF.js, pdf-lib, Vitest, Playwright.

**Spec:** Desain bounded dalam percakapan disetujui pengguna: dua gap khusus Tiled setelah Opacity/Angle, 0–200%, default horizontal 25% / vertical 75%, slider step 5%, input angka presisi integer; mode mempertahankan nilai dan Reset mengembalikan default. Kontrak lengkap disalin di bawah agar executor tidak bergantung pada riwayat chat. Dokumen desain MarkID lama bukan otoritas bagi batas byte/font/gap yang sudah diganti.

## Global Constraints / Approved Contract

- UI English sentence case: `Horizontal gap`, `Vertical gap`; percakapan Indonesia.
- Horizontal gap adalah persen lebar tile, mengikuti arah teks; Vertical gap adalah persen tinggi tile, tegak lurus arah teks. Bukan jarak sumbu layar.
- Nilai state `gapX`/`gapY` dalam persen integer 0–200; default 25/75. Slider step 5; input angka step 1, commit saat blur/Enter dengan clamp yang sudah ada.
- Kontrol hanya muncul saat Tiled, setelah Opacity/Angle. Dua kolom mengikuti kelas responsive existing, satu kolom di layar sempit.
- Single tidak berubah; Tiled tetap tanpa selection/resize handles/drag helper/Position. Single/Tiled tetap dua tombol full-width di atas Watermark text. Tidak menambah helper copy.
- Pertahankan nilai gap pada Single ↔ Tiled, Back to edit, dan penggantian sumber sukses; Reset memakai defaultMark sehingga kembali Single dan gap 25/75.
- Semua edit memakai App.edit: invalidate hasil lama, processing lock tetap. Tidak ada persistence/upload/resource eksternal/dependency baru.
- Default gap baru harus menghasilkan layout identik dengan committed fixed-gap 25/75.
- Pertahankan grid terpusat, rotasi positif searah glyph, tanpa stagger, rotated intersection culling, dan complete symmetric density adaptation dengan candidate budget 4096. Gap 0 berarti tile bersebelahan, bukan step nol. Pengaman kepadatan dapat memperbesar spacing pada input ekstrem; jangan klaim gap selalu persis untuk kasus adaptif.
- Pertahankan common 1600-reference Tiled asset, Single asset behavior, original-resolution JPEG quality .92, serta original vector PDF pages.
- BentoPDF AGPL adalah behavior reference saja; jangan menyalin/adaptasi source. Referensi dibaca: `references/bentopdf/src/pages/add-watermark.html:498–533`, `src/js/logic/add-watermark-page.ts:740–766`, `src/js/utils/pdf-operations.ts:185–259`.
- Kerja di `/home/aessaputra/Projects/MarkID`, feature branch existing; user menolak worktree. Recheck git status/branch sebelum eksekusi. Baseline saat rencana ditulis: clean `feat/markid`, HEAD `9e3f370`.
- Tidak commit/push otomatis; langkah checkpoint di bawah berhenti pada diff review kecuali pengguna memberi izin commit baru. Tidak checkout revision di working tree untuk red test; gunakan tests/mutation temporer terisolasi bila perlu.

## File map / Interfaces

| File | Tanggung jawab |
|---|---|
| `src/lib/editor/types.ts` | Tambah optional `gapX?: number; gapY?: number` pada Watermark; hanya dua field. |
| `src/App.svelte` | Default explicit gapX:25/gapY:75; existing spread dan reset mempertahankan alur. |
| `src/lib/editor/watermark.ts` | `tiledCenters(area:Size,tile:Size,angleDeg:number,gapX=25,gapY=75):Point[]`; validate persen dan pakai steps w*(1+gapX/100), h*(1+gapY/100). Canvas teruskan gap snapshot. |
| `src/lib/pdf/export.ts` | Teruskan gap snapshot pada tiledCenters; embedding/placement tetap. |
| `src/lib/ui/RangeField.svelte` | Optional sliderStep:number default 1, hanya range memakai step ini; angka tetap integer step 1. |
| `src/lib/ui/WatermarkControls.svelte` | Dua RangeField conditional Tiled, display fallback 25/75 untuk callers lama. |
| `tests/unit/tiled.test.ts` | Extend helper tests: default identity, custom axes, batas, invalid gap, density. |
| `tests/browser/tiled.spec.ts` | Existing responsive/selection/pixel/PDF oracle diperluas dengan custom gap, worker/main. |

Optional fields adalah compatibility untuk hand-built test marks yang sudah ada, bukan storage migration. UI/App selalu mengisi angka nyata; helper default hanya untuk omitted/undefined. Explicit NaN/Infinity/out-of-range gagal, bukan fallback diam-diam.

---

### Task 1: Shared gap contract and composition

**Files:** Modify `src/lib/editor/types.ts:5–14`, `src/App.svelte:12–14`, `src/lib/editor/watermark.ts:3–42`, `src/lib/pdf/export.ts:25–30`; tests `tests/unit/tiled.test.ts` dan existing `tests/browser/tiled.spec.ts`.

**Interfaces:** Produces `Watermark.gapX?:number`, `.gapY?:number`, and `tiledCenters(area,tile,angle,gapX=25,gapY=75):Point[]`. Percent values validated in helper. Consumers Canvas/PDF pass optional fields directly (undefined invokes default).

- [ ] Read target files and every tiledCenters caller with search_files, including tests. Run existing tiled unit and browser suites as baseline; record command outputs.
- [ ] Add failing unit tests before production changes:

```ts
for (const [gapX,gapY] of [[0,0],[25,75],[60,15],[200,200]]) {
  test(`custom percent spacing ${gapX}/${gapY}`,()=>{
    const a={width:1200,height:800},t={width:100,height:20};
    const centers=tiledCenters(a,t,45,gapX,gapY);
    const c=Math.SQRT1_2,s=c,sx=100*(1+gapX/100),sy=20*(1+gapY/100);
    expect(centers).toContainEqual({x:600,y:400});
    for(const p of centers){
      const x=(p.x-600)*c+(p.y-400)*s;
      const y=-(p.x-600)*s+(p.y-400)*c;
      expect(x/sx).toBeCloseTo(Math.round(x/sx),8);
      expect(y/sy).toBeCloseTo(Math.round(y/sy),8);
    }
    expect(centers.some(p=>Math.abs(p.x-(600+sx*c))<1e-8 && Math.abs(p.y-(400+sx*s))<1e-8)).toBe(true);
  });
}
test('omitted gaps preserve 25/75 layout',()=>{
  expect(tiledCenters(area,tile,45)).toEqual(tiledCenters(area,tile,45,25,75));
});
for(const v of [-1,201,NaN,Infinity,-Infinity]) test(`reject invalid gap ${v}`,()=>{
  expect(()=>tiledCenters(area,tile,0,v,75)).toThrow(RangeError);
  expect(()=>tiledCenters(area,tile,0,25,v)).toThrow(RangeError);
});
test('zero-gap dense pattern remains bounded and symmetric',()=>{
  const ps=tiledCenters(area,{width:.01,height:.01},45,0,0);
  expect(ps.length).toBeLessThanOrEqual(4096);
  expect(Math.min(...ps.map(p=>p.y))).toBeLessThan(30);
  expect(Math.max(...ps.map(p=>p.y))).toBeGreaterThan(770);
  for(const p of ps) expect(ps.some(q=>Math.abs(p.x+q.x-1200)<1e-7 && Math.abs(p.y+q.y-800)<1e-7)).toBe(true);
});
```

- [ ] Run `npm run test:unit -- tests/unit/tiled.test.ts`. Custom/invalid cases must fail for actual unsupported spacing, not tool failure. Default identity may already pass; it is regression protection.
- [ ] Add two optional fields to Watermark, explicit 25/75 to App.defaultMark, extend helper signature/steps and forward both fields in Canvas/PDF:

```ts
// Within tiledCenters, after the existing dimension validation:
for(const gap of [gapX,gapY]) {
  if(!Number.isFinite(gap) || gap<0 || gap>200)
    throw new RangeError('Tile gaps must be between 0 and 200 percent.');
}
let stepX=tile.width*(1+gapX/100),stepY=tile.height*(1+gapY/100);
// composeTiledWatermark:
const centers=tiledCenters(area,{width,height},mark.angle,mark.gapX,mark.gapY);
// exportPdf tiled branch:
const centers=tiledCenters(size,{width,height},snapshot.angle,snapshot.gapX,snapshot.gapY);
```

Do not move validation into every caller; preserve default parameter behavior and density loop.
- [ ] Run `npm run check && npm run test:unit && npm run test:browser -- tests/browser/tiled.spec.ts --workers=2`. Existing default-pixel oracle must still pass.
- [ ] Review task diff; retain uncommitted checkpoint. If explicitly authorized later: commit `feat: parameterize tiled watermark gaps` with only this task's files.

### Task 2: Gap sliders and numeric controls

**Files:** Modify `src/lib/ui/RangeField.svelte:3,12`, `src/lib/ui/WatermarkControls.svelte:29–41`; test `tests/browser/tiled.spec.ts`.

**Interfaces:** Consumes Task 1 percent fields. Produces optional RangeField prop `sliderStep?:number` default 1, range `step={sliderStep}`; numeric input explicit `step="1"`, existing commitText unchanged. No gap-specific component.

- [ ] Add UI regression test first:

```ts
test('gap controls retain values across modes and reset defaults',async({page})=>{
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  const x=page.getByRole('slider',{name:'Horizontal gap',exact:true});
  const y=page.getByRole('slider',{name:'Vertical gap',exact:true});
  await expect(x).toHaveCount(0);await expect(y).toHaveCount(0);
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  for(const [slider,value] of [[x,'25'],[y,'75']] as const){
    await expect(slider).toHaveValue(value);
    await expect(slider).toHaveAttribute('min','0');
    await expect(slider).toHaveAttribute('max','200');
    await expect(slider).toHaveAttribute('step','5');
  }
  const xn=page.getByRole('spinbutton',{name:'Horizontal gap value',exact:true});
  const yn=page.getByRole('spinbutton',{name:'Vertical gap value',exact:true});
  await xn.fill('37');await xn.press('Enter');await yn.fill('123');await yn.press('Enter');
  await expect(x).toHaveValue('37');await expect(y).toHaveValue('123');
  await page.getByRole('button',{name:'Single',exact:true}).click();await expect(x).toHaveCount(0);
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  await expect(xn).toHaveValue('37');await expect(yn).toHaveValue('123');
  await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(x).toHaveCount(0);
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  await expect(x).toHaveValue('25');await expect(y).toHaveValue('75');
  await expect(page.locator('.watermark-selection')).toHaveCount(0);
});
```

- [ ] Run the new test alone; expect missing sliders failure. Do not weaken to count-only checks after implementation.
- [ ] Add sliderStep to RangeField props/destructuring and native range step; preserve default 1 for Size/Opacity/Angle and numeric integer commit. HTML range sanitizes off-step values, so add `step="1"` to number input. Browser-test whether setting exact typed 37/123 is retained by range.value with step 5; if native range sanitizes the controlled value, use the exact percent number as state authority and test numeric value + resulting geometry, while displaying nearest slider tick only (round(value/sliderStep)*sliderStep for the range value). Never silently quantize stored gap or custom numeric export. Document that ruling in report and adjust slider-value assertions for typed off-tick values to nearest tick. Prefer actual native behavior evidence before adding this projection.
- [ ] Render gap controls with existing responsive classes in the Tiled alternative of Position:

```svelte
{#if mark.mode === 'tiled'}
 <div class="grid min-w-0 grid-cols-1 gap-4 min-[420px]:grid-cols-2">
  <RangeField id="gap-x" label="Horizontal gap" value={mark.gapX ?? 25} min={0} max={200} sliderStep={5} onchange={gapX=>update({gapX})} />
  <RangeField id="gap-y" label="Vertical gap" value={mark.gapY ?? 75} min={0} max={200} sliderStep={5} onchange={gapY=>update({gapY})} />
 </div>
{:else}
 <!-- Retain the current Position fieldset and all its button logic verbatim. -->
{/if}
```

The comment above documents preservation, not replacement markup to commit; reuse the existing fieldset without changes. No visible legend/helper for gaps.
- [ ] Extend existing responsive test at 320/390/1280: gap rows stack below 420 and align side-by-side at 1280; number wrappers stay 44px tall and no horizontal overflow. Test slider ArrowRight advances by 5, number accepts integer 37, 0/200/clamps, and Size/Opacity/Angle slider step remains 1.
- [ ] Run `npm run check`, `npm run test:browser -- tests/browser/tiled.spec.ts tests/browser/editor.spec.ts tests/browser/selection.spec.ts tests/browser/accessibility.spec.ts --workers=2`, `npx @sveltejs/mcp svelte-autofixer ./src/lib/ui/RangeField.svelte`, same autofixer for WatermarkControls, `npm run build && git diff --check`.
- [ ] Review and retain uncommitted checkpoint; optional authorized commit message `feat: add tiled gap sliders and precise numeric inputs`.

### Task 3: Real export parity, lifecycle, and final gates

**Files:** Modify existing `tests/browser/tiled.spec.ts:69–124`, extend `tests/unit/export-controller.test.ts:15–18`. No production edits unless these tests reproduce a specific gap bug.

**Interfaces:** Consumes `mark.gapX/gapY` percentages, `exportImage(image,mark,{forceMain?:boolean})`, existing actual Canvas/JPEG and PDF oracles.

- [ ] Extend independent image oracle to custom gaps without importing production tiledCenters. Keep text/angle matrix; use gap pairs [0,0], [25,75], [37,123], [200,200] and steps w*(1+gapX/100), h*(1+gapY/100). Increase finite oracle integer reach enough for gap zero (existing -80..80 covers selected image sizes/text, prove coverage from tile measurements; do not hide density-adaptation cases inside this nonadaptive oracle). Mark includes both fields. For every case compare actual compose pixels, drawPreview pixels, real worker JPEG and forceMain JPEG against separately encoded oracle; retain max Canvas error <=1, JPEG <=2.

```ts
const gapPairs=[[0,0],[25,75],[37,123],[200,200]];
const mark={text,mode:'tiled',sizeRatio:.05,x:.17,y:.83,angle,opacity:.7,color:'#ff0000',gapX,gapY};
const sx=w*(1+gapX/100),sy=h*(1+gapY/100);
// Independent loops: x=i*sx, y=j*sy, centered and rotated exactly as the current test oracle.
const worker=await exportImage(image,mark);
const main=await exportImage(image,mark,{forceMain:true});
```

Use existing decode helper for each Blob. Dispose both results and bitmap; preserve transparent/white composition and encoding quality.
- [ ] Extend existing cropped/rotated PDF raster test with [0,0], [25,75], [200,200] and one off-tick [37,123] representative. Maintain shared-source overlay oracle vs rendered saved PDF, angle 0/45/-45/90 and short/long/multiline cases. Keep stated interpolation tolerance mean error <7/255 and overlap >.85; do not relax to hide placement failures. If zero-gap cases have greater interpolation error, report actual values and inspect real raster before any tolerance ruling. Assert original page count/text survives with existing PDF.js APIs used by neighboring pdf-adapter tests.
- [ ] Extend export-controller snapshot test: give snapshot gapX:37/gapY:123, mutate to 200/0 after prepare and assert codec received 37/123. Existing text snapshot/inflight lock assertions remain.
- [ ] UI lifecycle test: set custom gaps, Preview→Download→Back to edit values retained; edit a gap and Preview again yields new pixels/bytes, old result does not accumulate. Change source successfully and assert gap values retained; processing locks both sliders and numeric inputs. Reuse production-worker instrumentation in existing export-capability/lifecycle tests when proving worker success; fallback passing does not by itself prove real Worker execution.
- [ ] Run final gates on exact reviewed code:

```sh
npm run check
npm run test:unit
npm run test:browser -- tests/browser/tiled.spec.ts tests/browser/editor.spec.ts tests/browser/selection.spec.ts tests/browser/export.spec.ts tests/browser/export-capability.spec.ts tests/browser/export-lifecycle.spec.ts tests/browser/pdf-adapter.spec.ts tests/browser/accessibility.spec.ts --workers=2
npm run build
git diff --check
```

If bundled Chromium is missing, verify an installed executable and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only in the command environment; never hardcode host path into config. Record skipped production-CSP cases separately from pass. No Firefox/WebKit/physical-device support claims.
- [ ] Capture actual Tiled custom-gap editor screenshot in scratch at mobile/desktop, inspect it; do not add debug screenshots to repo.
- [ ] Independent spec/quality review and self-review: field names/percent conversion match everywhere, defaults unchanged, both composition callers forward gaps, UI hidden in Single, numeric off-tick precision retained, no Tiled selection restored. Keep findings and exact command output in plan-specific ignored ledger/report. Optional authorized final test commit `test: verify adjustable tiled gap parity and lifecycle`.

## Self-review of this plan

- Coverage: shared computation/defaults (Task 1), visible controls/keyboard/reset/responsive layout (Task 2), actual worker/main/PDF pixels and snapshot/lifecycle (Task 3).
- No new renderers, persistence, dependencies, worktrees, per-page settings, page-range controls, or reference-source copying.
- Compatibility: optional percent fields preserve existing hand-built marks; App supplies explicit defaults. No need to touch every browser mark literal just for new optional fields.
- Numeric consistency risk called out: native range step 5 may sanitize off-tick values; integer typed state must remain authoritative and export exact, verified in browser before choosing slider tick projection.
- Existing dense safety budget remains; no early tile cutoff or gap-zero division by zero.
- Implementation has not started. Plan changes only; commands above are expected verification, not claimed executions.
