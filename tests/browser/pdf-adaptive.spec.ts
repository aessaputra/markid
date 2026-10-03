import {test,expect} from '@playwright/test';
test('real PDF raster exceeds old caps and follows responsive display without feedback',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {loadPdf}=await import(String('/src/lib/pdf/load.ts'));const {previewPdf}=await import(String('/src/lib/pdf/preview.ts'));
  const pdf=await loadPdf(new File([await (await fetch('/tests/fixtures/pdf/two-pages.pdf')).arrayBuffer()],'x.pdf'));
  const a=await previewPdf(pdf,0,{width:1800,height:2000});const large={...a.size};a.dispose();
  const b=await previewPdf(pdf,1,{width:300,height:500});const small={...b.size};b.dispose();pdf.dispose();return {large,small};
 });
 expect(result.large.width*result.large.height).toBeGreaterThan(2_000_000);expect(Math.max(result.large.width,result.large.height)).toBeGreaterThan(1600);
 expect(Math.max(result.small.width,result.small.height)).toBeLessThanOrEqual(1000);
 await page.setViewportSize({width:1280,height:900});await page.locator('input[type=file]').setInputFiles('tests/fixtures/pdf/two-pages.pdf');
 const canvas=page.getByLabel('Image preview');await expect(canvas).toBeVisible();
 async function fits(){await expect.poll(async()=>canvas.evaluate(n=>{const c=n as HTMLCanvasElement,r=c.getBoundingClientRect();const w=Number(c.dataset.imageWidth),h=Number(c.dataset.imageHeight);return Math.abs(Math.min(r.width/w,r.height/h)-.5);})).toBeLessThan(.002);}
 await fits();const before=await canvas.getAttribute('data-image-width');
 await page.setViewportSize({width:390,height:844});await fits();expect(await canvas.getAttribute('data-image-width')).not.toBe(before);
 await page.getByRole('button',{name:'Next page'}).click();await expect(page.getByText('Page 2 of 2')).toBeVisible();await fits();
 await page.locator('input[type=file]').setInputFiles('tests/fixtures/pdf/scan.pdf');await fits();await expect(page.getByText('Page 2 of 2')).toHaveCount(0);
});
