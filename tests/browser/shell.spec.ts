import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('initial drop zone opens a real JPEG larger than 10 MB', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Watermark your file'})).toBeVisible();
  await expect(page.getByText('Add a text watermark to an image or PDF before sharing.')).toBeVisible();
  const picker = page.getByRole('button', {name:'Choose file',exact:true});
  await expect(picker).toContainText('Choose a file');
  await expect(picker).toContainText('or drag and drop');
  await expect(page.getByText('Your files never leave your device.')).toBeVisible();
  const jpeg = readFileSync('tests/fixtures/images/exif-1.jpg');
  // Valid JPEG comment segments enlarge the bitstream without changing its pixels.
  const comment = Buffer.alloc(65537, 65);
  comment.set([255,254,255,255]);
  const buffer = Buffer.concat([jpeg.subarray(0,2), ...Array(160).fill(comment), jpeg.subarray(2)]);
  expect(buffer.length).toBeGreaterThan(10_000_000);
  // DataTransfer must stay in the page context for a native drop event.
  const transfer = await page.evaluateHandle(bytes => {
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(bytes), character => character.charCodeAt(0))], 'large.jpg', {type:'image/jpeg'}));
    return data;
  }, buffer.toString('base64'));
  await picker.dispatchEvent('drop', {dataTransfer:transfer});
  await transfer.dispose();
  await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','120');
  await expect(page.getByLabel('Watermark text')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const file of ['tests/fixtures/images/exif-6.png', 'tests/fixtures/pdf/two-pages.pdf']) {
  test(`editor appears only after successfully opening ${file}`, async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Choose file', { exact: true }).setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad')});
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Watermark text')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Choose file' })).toBeEnabled();
    await page.getByLabel('Choose file', { exact: true }).setInputFiles(file);
    await expect(page.getByLabel('Watermark text')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    const change = page.getByRole('button', {name:'Change file',exact:true});
    await expect(change).toBeVisible();
    await expect(page.getByLabel('Current file')).toHaveText(file.split('/').pop()!);
    await expect(page.getByText('Your files never leave your device.')).toHaveCount(0);
    await expect(page.getByText('JPG, PNG, HEIC, HEIF, WebP, AVIF or PDF.')).toHaveCount(0);
    await expect(page.getByText('Ready', {exact:true})).toHaveCount(0);
    await change.focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooser).setFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad')});
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Current file')).toHaveText(file.split('/').pop()!);
    await expect(page.locator('canvas').first()).toBeVisible();
  });
}

test('first decode stays on the picker until the source is ready', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = window.createImageBitmap.bind(window);
    (window as unknown as { finishDecode: () => void }).finishDecode = () => {};
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
      if (args[0] instanceof Blob) return new Promise<ImageBitmap>((resolve, reject) => {
        (window as unknown as { finishDecode: () => void }).finishDecode = () => { void decode(...args).then(resolve, reject); };
      });
      return decode(...args);
    }) as typeof createImageBitmap;
  });
  await page.goto('/');
  await page.getByLabel('Choose file', { exact: true }).setInputFiles('tests/fixtures/images/exif-6.png');
  await expect(page.getByRole('status')).toContainText('Loading');
  await expect(page.getByLabel('Watermark text')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { finishDecode: () => void }).finishDecode());
  await expect(page.getByLabel('Watermark text')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeEnabled();
});

for (const width of [320, 1280]) test(`long file identity stays compact at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:800});
  await page.goto('/');
  const name = 'identity-document-'.repeat(20) + '.png';
  await page.getByLabel('Choose file', {exact:true}).setInputFiles({name,mimeType:'image/png',buffer:readFileSync('tests/fixtures/images/exif-6.png')});
  const identity = page.getByLabel('Current file');
  await expect(identity).toHaveText(name);
  expect(await identity.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const change = (await page.getByRole('button',{name:'Change file'}).boundingBox())!;
  const preview = (await page.getByRole('region',{name:'Source image'}).boundingBox())!;
  expect(change.y + change.height).toBeLessThanOrEqual(preview.y);
});

for (const width of [320, 390, 768, 1280]) for (const colorScheme of ['light', 'dark'] as const) {
 test(`picker aligns with the header at ${width}px in ${colorScheme}`, async ({ page }) => {
   await page.setViewportSize({width,height:800});
   await page.emulateMedia({colorScheme});
   await page.goto('/');
    const header = (await page.locator('header').boundingBox())!;
    const panel = (await page.getByRole('region', {name:'File selection'}).boundingBox())!;
    expect(panel.x).toBeCloseTo(header.x, 1);
    expect(panel.width).toBeCloseTo(header.width, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`shell fits 320px in ${colorScheme} mode with local resources`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ colorScheme });
    const externalRequests: string[] = [];
    const errors: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).origin !== 'http://127.0.0.1:5173') externalRequests.push(request.url());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const button = page.getByRole('button', { name: 'Choose file' });
    await expect(button).toBeVisible();
    await expect(page.getByLabel('Watermark text')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(button).toHaveAccessibleDescription('JPG, PNG, HEIC, HEIF, WebP, AVIF or PDF. Your files never leave your device.');
    await expect(page.getByText('Your files never leave your device')).toBeVisible();
    await button.focus();
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('system-ui');
    await page.screenshot({ path: `test-results/shell-320-${colorScheme}.png` });
    expect(externalRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

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
