import { expect, test } from '@playwright/test';

const classic = process.env.MARKID_CLASSIC_SCROLLBARS === '1';
test.use({ launchOptions: {
 executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
 ...(classic ? { ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--disable-features=OverlayScrollbar'] } : {}),
} });
test.describe(classic ? 'classic scrollbar' : 'hidden scrollbar', () => {
  for (const [width, height] of [[320, 568], [390, 844], [1280, 800]]) {
   for (const file of ['images/exif-6.png', 'pdf/two-pages.pdf']) {
    test(`initial phases ${file} ${width}x${height}`, async ({ page }) => {
     await page.setViewportSize({ width, height });
     await page.addInitScript(() => {
      const bitmap = createImageBitmap.bind(window);
      window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
       const result = await bitmap(...args);
       if (args[0] instanceof Blob) await new Promise(resolve => setTimeout(resolve, 300));
       return result;
      }) as typeof createImageBitmap;
      // Delay real measurements, not pixels, to expose placeholder-cache readiness deterministically.
      const Observer = ResizeObserver;
      window.ResizeObserver = class extends Observer {
       constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => { setTimeout(() => callback(entries, observer), 150); });
       }
      };
     });
     await page.goto('/');
     await page.getByRole('button', { name: 'Choose file', exact: true }).focus();
     const before = await page.locator('header').boundingBox();
     const initialHeight = (await page.getByRole('region', { name: 'File selection' }).boundingBox())!.height;
     await page.evaluate(() => {
      const samples: { x: number; overflow: number; initialHeight: number | null; accepted: boolean; loading: boolean; full: boolean; pixels: boolean; scrollY: number }[] = [];
      let stopped = false;
      Object.assign(window, { transitionSamples: samples, stopTransition: () => { stopped = true; } });
      function sample() {
       const canvas = document.querySelector<HTMLCanvasElement>('.editor-canvas');
       const bounds = canvas?.getBoundingClientRect();
       const pixels = !!canvas?.width && !!canvas.height && canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
       samples.push({ x: document.querySelector('header')!.getBoundingClientRect().x,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        initialHeight: document.querySelector('[aria-label="File selection"]')?.getBoundingClientRect().height ?? null,
        accepted: !!document.querySelector('[aria-label="Current file"]'),
        loading: document.querySelector('[role=status]')?.textContent === 'Loading…', pixels,
        full: !!canvas && !!bounds && canvas.width === Math.ceil(bounds.width * devicePixelRatio) && canvas.height === Math.ceil(bounds.height * devicePixelRatio), scrollY });
       if (!stopped) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
     });
     await page.locator('input[type=file]').setInputFiles('tests/fixtures/' + file);
     await expect(page.getByLabel('Current file')).toHaveText(file.split('/').pop()!);
     await expect(page.getByRole('status')).toHaveCount(0);
     await page.waitForTimeout(250);
     const samples = await page.evaluate(() => {
      const state = window as unknown as { transitionSamples: { x: number; overflow: number; initialHeight: number | null; accepted: boolean; loading: boolean; full: boolean; pixels: boolean; scrollY: number }[]; stopTransition: () => void };
      state.stopTransition(); return state.transitionSamples;
     });
     expect(samples.length).toBeGreaterThan(5);
     expect.soft(samples.every(sample => Math.abs(sample.x - before!.x) < .5), 'header never shifts').toBe(true);
     expect.soft(samples.every(sample => sample.overflow <= 0), 'no horizontal overflow').toBe(true);
     const pending = samples.filter(sample => sample.initialHeight !== null && sample.loading);
     expect(pending.length).toBeGreaterThan(0);
     expect.soft(pending.every(sample => sample.initialHeight === initialHeight), 'initial status has no layout cost').toBe(true);
     const accepted = samples.filter(sample => sample.accepted);
     expect(accepted.length).toBeGreaterThan(0);
     expect.soft(accepted.every(sample => sample.loading || (sample.full && sample.pixels)), 'ready requires full-size painted backing').toBe(true);
     expect.soft(accepted.every(sample => !sample.pixels || sample.full), 'never paint placeholder backing').toBe(true);
     expect.soft(samples.every(sample => sample.scrollY === 0), 'handoff does not scroll').toBe(true);
     await expect.soft(page.getByRole('button', { name: 'Change file' })).toBeFocused();
    });
   }
  }
 });

test('initial upload does not steal focus moved during decoding or on drop', async ({ page }) => {
 await page.addInitScript(() => {
  const original = createImageBitmap.bind(window);
  window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
   const bitmap = await original(...args);
   await new Promise(resolve => setTimeout(resolve, 300)); return bitmap;
  }) as typeof createImageBitmap;
 });
 for (const drop of [false, true]) {
  await page.goto('/');
  await page.evaluate(() => {
   const input = document.createElement('input'); input.id = 'other-focus'; document.body.append(input);
  });
  await page.getByRole('button', { name: 'Choose file', exact: true }).focus();
  if (drop) {
   await page.evaluate(async () => {
    const bytes = await (await fetch('/tests/fixtures/images/exif-6.png')).arrayBuffer();
    const data = new DataTransfer(); data.items.add(new File([bytes], 'drop.png', { type: 'image/png' }));
    document.querySelector('.file-drop-zone')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data }));
   });
  } else await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  await page.locator('#other-focus').focus();
  await expect(page.getByLabel('Current file')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('#other-focus')).toBeFocused();
 }
});
