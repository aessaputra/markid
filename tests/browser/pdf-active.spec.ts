import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
test('PDF JavaScript and URI actions are never executed by Canvas preview',async({page})=>{
 const doc=await PDFDocument.create();doc.addPage();doc.addJavaScript('sentinel',"fetch('https://example.invalid/PRIVATE-PDF');app.alert('executed')");
 const bytes=await doc.save();let dialogs=0;const external:string[]=[];
 page.on('dialog',async d=>{dialogs++;await d.dismiss();});page.on('request',r=>{if(r.url().startsWith('https://'))external.push(r.url());});
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles({name:'active.pdf',mimeType:'application/pdf',buffer:Buffer.from(bytes)});await expect(page.getByText('Page 1 of 1')).toBeVisible();
 await page.getByLabel('Watermark text').fill('Safe canvas');await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();expect(dialogs).toBe(0);expect(external).toEqual([]);
});
