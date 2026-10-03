import {test,expect} from '@playwright/test';
for(const resource of ['standard_fonts','cmaps','worker','corrupt-font'])test(`required ${resource} failure preserves previous editor`,async({page})=>{
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/scan.pdf');await expect(page.getByLabel('Image preview')).toBeVisible();
 await page.route(resource==='worker'?'**/*pdf.worker*.mjs*':`**/pdf-assets/${resource==='corrupt-font'?'standard_fonts':resource}/**`,route=>resource==='corrupt-font'?route.fulfill({status:200,body:'not a font'}):route.abort());
 // Worker is already live for the old document; a new document must still fail fonts/CMaps.
 await page.getByLabel('Choose file').setInputFiles(resource==='cmaps'?'tests/fixtures/pdf/cmap.pdf':'tests/fixtures/pdf/two-pages.pdf');
 await expect(page.getByText('Could not open this PDF. Try another.')).toBeVisible();await expect(page.getByLabel('Image preview')).toBeVisible();
});
test('cold required worker failure is explicit',async({page})=>{
 await page.route('**/*pdf.worker*.mjs*',route=>route.abort());await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');await expect(page.getByText('Could not open this PDF. Try another.')).toBeVisible();await expect(page.getByText('Page 1 of 2')).not.toBeVisible();
});
for(const resource of ['standard_fonts','cmaps'])test(`failed final required ${resource} preview never enables Download`,async({page})=>{
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles(resource==='cmaps'?'tests/fixtures/pdf/cmap.pdf':'tests/fixtures/pdf/two-pages.pdf');await expect(page.getByLabel('Image preview')).toBeVisible();
 await page.getByLabel('Watermark text').fill('Fidelity');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();
 await page.route(`**/pdf-assets/${resource}/**`,route=>route.abort());await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download',exact:true})).toBeDisabled();await expect(page.getByLabel('Result preview').getByText('Could not process this file. Try a smaller one.')).toBeVisible();
});
