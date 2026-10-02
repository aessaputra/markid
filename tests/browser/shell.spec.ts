import { test, expect } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`shell fits 320px in ${colorScheme} mode with local resources`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ colorScheme });
    const externalRequests: string[] = [];
    const errors: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const button = page.getByRole('button', { name: 'Choose file' });
    await expect(button).toBeVisible();
    await button.focus();
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(async () => {
      const faces = await document.fonts.load('16px Geist', 'Choose file');
      return faces.length > 0 && faces.every(face => face.family.replaceAll('"', '') === 'Geist' && face.status === 'loaded');
    })).toBe(true);
    await page.screenshot({ path: `test-results/shell-320-${colorScheme}.png` });
    expect(externalRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('local editor shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Choose file' })).toBeVisible();
  await expect(page.getByText('Files stay on your device')).toBeVisible();
});

test('Choose file opens a single-file picker from the keyboard', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Choose file' });
  await button.focus();
  const chooserEvent = page.waitForEvent('filechooser', { timeout: 3000 });
  await page.keyboard.press('Enter');
  const chooser = await chooserEvent;
  expect(chooser.isMultiple()).toBe(false);
  expect(await chooser.element().getAttribute('aria-label')).toBe('Choose file');
  expect(await chooser.element().getAttribute('aria-describedby')).toBe('file-helper');
});
