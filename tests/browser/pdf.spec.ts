import {test,expect} from '@playwright/test';
test('PDF encrypted rejection and atomic failed replacement',async({page})=>{
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');
 await expect(page.getByText('Page 1 of 2')).toBeVisible();
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/locked.pdf');
 await expect(page.getByText('PDF is locked. Unlock it and try again.')).toBeVisible();
 await expect(page.getByText('Page 1 of 2')).toBeVisible();
});
test('exports real PDF and navigates final pages',async({page})=>{
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');
 await expect(page.getByText('Page 1 of 2')).toBeVisible();
 await page.getByLabel('Watermark text').fill('For verification only\nSecond line');
 await page.getByRole('button',{name:'Next page',exact:true}).click();
 await expect(page.getByText('Page 2 of 2')).toBeVisible();
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 expect((await pending).suggestedFilename()).toBe('markid.pdf');
 await expect(page.getByLabel('Final PDF preview')).toBeVisible();
 await page.getByRole('button',{name:'Back to edit'}).click();
 await expect(page.getByLabel('Watermark text')).toHaveValue('For verification only\nSecond line');
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/scan.pdf');
 await expect(page.getByText('Page 1 of 1')).toBeVisible();
});
