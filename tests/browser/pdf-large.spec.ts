import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
test('PDF output above 1MiB remains valid without JPEG cap',async({page})=>{
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/large-scan.pdf');await expect(page.getByLabel('Image preview')).toBeVisible();
 await page.getByLabel('Watermark text').fill('Large scan');await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();const download=await pending;const bytes=await readFile((await download.path())!);expect(bytes.length).toBeGreaterThan(1048576);expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
});
