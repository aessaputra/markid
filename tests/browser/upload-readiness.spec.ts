import { expect, test, type Page } from '@playwright/test';

async function delayRendering(page: Page) {
 await page.addInitScript(() => {
  const original = createImageBitmap.bind(window);
  window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
   const bitmap = await original(...args);
   await new Promise(resolve => setTimeout(resolve, args[0] instanceof Blob ? 300 : 180));
   return bitmap;
  }) as typeof createImageBitmap;
 });
 await page.goto('/');
 await page.evaluate(async () => {
  const { openPdf, states } = await import(String('/src/lib/pdf/load.ts')) as typeof import('../../src/lib/pdf/load');
  const pdf = await openPdf(new Uint8Array(await (await fetch('/tests/fixtures/pdf/two-pages.pdf')).arrayBuffer()));
  const page = await states.get(pdf)!.doc.getPage(1);
  const prototype = Object.getPrototypeOf(page) as typeof page;
  const original = prototype.render;
  prototype.render = function (...args: Parameters<typeof original>) {
   const task = original.apply(this, args);
   const promise = task.promise.then(() => new Promise<void>(resolve => setTimeout(resolve, 350)));
   return new Proxy(task, { get(target, key) { return key === 'promise' ? promise : Reflect.get(target, key); } });
  };
  pdf.dispose();
 });
}

async function pixels(page: Page) {
 return page.locator('.editor-canvas').evaluate((node: HTMLCanvasElement) => {
  if (!node.width || !node.height) return 0;
  const data = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data;
  let count = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]) count++;
  return count;
 }).catch(() => 0);
}
async function bounds(page: Page) {
 return page.evaluate(() => ['.preview-panel', '.pdf-viewport, .preview-frame', '[aria-label="Watermark settings"]'].map(selector => {
  const box = document.querySelector(selector)!.getBoundingClientRect();
  return [box.y, box.height];
 }));
}

for (const width of [320, 390, 1280]) {
 test(`every accepted source has Loading until real pixels at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await delayRendering(page);
  for (const file of ['images/exif-6.png', 'images/exif-1.png', 'pdf/two-pages.pdf', 'pdf/scan.pdf', 'images/exif-6.png']) {
   const name = file.split('/').pop()!;
   await page.evaluate(name => {
    const state = window as unknown as { readiness: { accepted: boolean; pixels: boolean; loading: boolean }[]; stopSampling: boolean };
    state.readiness = []; state.stopSampling = false;
    function sample() {
     const canvas = document.querySelector('.editor-canvas') as HTMLCanvasElement | null;
     const pixels = !!canvas?.width && !!canvas.height && canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
     state.readiness.push({ accepted: document.querySelector('[aria-label="Current file"]')?.textContent === name, pixels, loading: document.querySelector('[role=status]')?.textContent === 'Loading…' });
     if (!state.stopSampling) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
   }, name);
   await page.locator('input[type=file]').setInputFiles('tests/fixtures/' + file);
   await expect(page.getByLabel('Current file')).toHaveText(name);
   await expect.poll(() => pixels(page)).toBeGreaterThan(0);
   await expect(page.getByRole('status')).toHaveCount(0);
   const samples = await page.evaluate(() => {
    const state = window as unknown as { readiness: { accepted: boolean; pixels: boolean; loading: boolean }[]; stopSampling: boolean };
    state.stopSampling = true; return state.readiness;
   });
   const blank = samples.filter(sample => sample.accepted && !sample.pixels);
   expect(blank.length).toBeGreaterThan(0);
   expect(blank.every(sample => sample.loading)).toBe(true);
  }
  const before = await bounds(page);
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Current file')).toHaveText('exif-6.png');
  expect(await pixels(page)).toBeGreaterThan(0);
  expect(await bounds(page)).toEqual(before);
 });
 test(`delayed image backing preserves native frame at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  await expect.poll(() => pixels(page)).toBeGreaterThan(0);
  const native = await bounds(page);
  if (width < 1024) expect(native[1][1]).toBe((await page.locator('main').boundingBox())!.width - 66);
  await delayRendering(page);
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  await expect(page.getByLabel('Current file')).toHaveText('exif-6.png');
  await expect.poll(() => pixels(page)).toBeGreaterThan(0);
  expect(await bounds(page)).toEqual(native);
 });

 for (const kind of ['image', 'pdf']) {
  test(`replacement status leaves ${kind} geometry stable at ${width}`, async ({ page }) => {
   await page.setViewportSize({ width, height: 800 });
   await delayRendering(page);
   const file = kind === 'image' ? 'images/exif-6.png' : 'pdf/two-pages.pdf';
   await page.locator('input[type=file]').setInputFiles('tests/fixtures/' + file);
   await expect.poll(() => pixels(page)).toBeGreaterThan(0);
   await expect(page.getByRole('status')).toHaveCount(0);
   const before = await bounds(page);
   await page.locator('input[type=file]').setInputFiles('tests/fixtures/' + file);
   await expect(page.getByRole('status')).toHaveText('Loading…');
   expect(await bounds(page)).toEqual(before);
   // The previous valid preview remains during decoding, without triggering a viewport rerender.
   expect(await pixels(page)).toBeGreaterThan(0);
   await expect(page.getByRole('status')).toHaveCount(0);
   expect(await bounds(page)).toEqual(before);
  });
 }
}
