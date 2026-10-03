import {test,expect} from '@playwright/test';
for (const width of [390,1280]) test(`PDF preview uses available space at ${width}px`, async ({page}) => {
 await page.setViewportSize({width,height:800});await page.goto('/');
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');
 const canvas=page.getByLabel('Image preview');await expect(canvas).toBeVisible();
 const panel=(await page.getByRole('region',{name:'Source image'}).boundingBox())!;
 const controls=(await page.getByRole('region',{name:'Watermark settings'}).boundingBox())!;
 const box=(await canvas.boundingBox())!;
 if(width>=1024) {expect(panel.height).toBeCloseTo(controls.height,0);expect(box.height).toBeGreaterThan(800*.45);}
 else expect(box.height).toBeCloseTo(800*.55,0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Next page',exact:true}).click();
 await expect(page.getByText('Page 2 of 2')).toBeVisible();
 await expect(canvas).toBeVisible();
 const selection=page.locator('.watermark-selection');await expect(selection).toBeVisible();await page.locator('.preview-frame').scrollIntoViewIfNeeded();
 const bounds=(await selection.boundingBox())!;
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2+30);await page.mouse.up();
 await expect(page.getByRole('button',{name:'Center',exact:true})).toHaveAttribute('aria-pressed','false');
});
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
 await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();
 await expect(page.getByRole('navigation',{name:'PDF pages'})).toHaveCount(0);
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 await expect(page.getByRole('navigation',{name:'PDF pages'})).toHaveCount(0);
});
