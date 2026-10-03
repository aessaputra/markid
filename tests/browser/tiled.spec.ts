import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function chooseFile(page: Page, name: string, fixture: string) {
  const buffer = await readFile(fixture);
  await page.getByLabel('Choose file', { exact: true }).setInputFiles({ name, mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', buffer });
}

test('tiled covers more than single on image export', async ({ page }) => {
  await page.goto('/');
  await chooseFile(page, 'photo.jpg', 'tests/fixtures/images/exif-1.jpg');
  await expect(page.getByRole('button', { name: 'Tiled', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Single', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Back to edit' }).click();
  await page.getByRole('button', { name: 'Tiled', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeEnabled({ timeout: 30000 });
});

test('tiled pdf keeps page count', async ({ page }) => {
  await page.goto('/');
  await chooseFile(page, 'doc.pdf', 'tests/fixtures/pdf/two-pages.pdf');
  await page.getByRole('button', { name: 'Tiled', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const download = page.getByRole('button', { name: 'Download', exact: true });
  await expect(download).toBeEnabled({ timeout: 30000 });
  await expect(page.getByText('2 pages')).toBeVisible();
});
