import { expect, test } from '@playwright/test';

for (const source of ['tests/fixtures/images/exif-6.png', 'tests/fixtures/pdf/two-pages.pdf']) {
 for (const width of [320, 390, 1024, 1280, 1440]) {
  test(`compact editor panels ${source} at ${width}px`, async ({ page }) => {
   await page.setViewportSize({ width, height: 900 });
   await page.goto('/');
   await page.locator('input[type=file]').setInputFiles(source);
   await expect(page.getByLabel('Watermark text')).toBeVisible();
   await expect(page.getByLabel('Image preview')).toBeVisible();
   for (const mode of ['Single', 'Tiled', 'Single']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    const preview = (await page.locator('.preview-panel').boundingBox())!;
    const controls = (await page.locator('.editor-layout > fieldset').boundingBox())!;
    const frame = (await page.locator('.preview-frame').boundingBox())!;
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width >= 1024) {
     expect(controls.width).toBeLessThanOrEqual(384);
     expect(preview.width).toBeGreaterThan(controls.width);
     expect(Math.abs(preview.height - controls.height)).toBeLessThanOrEqual(48);
     expect(frame.width).toBeGreaterThan(controls.width);
    } else {
     expect(Math.abs(preview.width - controls.width)).toBeLessThanOrEqual(1);
     expect(controls.y).toBeGreaterThanOrEqual(preview.y + preview.height);
    }
   }
  });
 }
}
