import { expect, test } from '@playwright/test';
for (const width of [320, 390, 1280]) for (const source of ['tests/fixtures/images/exif-6.png', 'tests/fixtures/pdf/two-pages.pdf']) {
 test(`mode toggle keeps preview stable at ${width}px for ${source}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(source);
  await expect(page.locator('.watermark-selection')).toBeVisible();
  const dimensions = () => page.evaluate(() => ['.preview-panel', '.preview-frame', '[aria-label="Watermark settings"]'].map(selector => {
   const bounds = document.querySelector(selector)!.getBoundingClientRect();
   return { width: bounds.width, height: bounds.height };
  }));
  const before = await dimensions();
  for (const mode of ['Tiled', 'Single', 'Tiled', 'Single']) {
   await page.getByRole('button', { name: mode, exact: true }).click();
   await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true');
   // Sample across paints so a transient resize cannot pass an immediate poll.
   for (let frame = 0; frame < 6; frame++) {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    const after = await dimensions();
    for (let i = 0; i < before.length; i++) {
     expect(Math.abs(after[i].height - before[i].height)).toBeLessThanOrEqual(2);
     expect(Math.abs(after[i].width - before[i].width)).toBeLessThanOrEqual(2);
    }
   }
  }
 });
}
