import { expect, test } from '@playwright/test';
for (const width of [390, 1280]) for (const source of ['tests/fixtures/images/exif-6.png', 'tests/fixtures/pdf/two-pages.pdf']) test(`upload settles at ${width} for ${source}`, async ({page}) => {
 await page.setViewportSize({width,height:800});
 await page.goto('/');
 await page.evaluate(() => {
  const samples: number[][]=[];
  (window as unknown as {uploadSamples:number[][]}).uploadSamples=samples;
  function sample() {
   const panel=document.querySelector('.preview-panel');
   if(panel) samples.push(['.preview-panel',document.querySelector('.pdf-viewport') ? '.pdf-viewport' : '.preview-frame','[aria-label="Watermark settings"]'].map(s=>document.querySelector(s)?.getBoundingClientRect().height ?? 0));
   if(samples.length<30) requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
 });
 await page.locator('input[type=file]').setInputFiles(source);
 await expect(page.locator('.watermark-selection')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {uploadSamples:number[][]}).uploadSamples.length)).toBe(30);
 const samples=await page.evaluate(()=>(window as unknown as {uploadSamples:number[][]}).uploadSamples);
 for (const sample of samples) expect(sample).toEqual(samples[0]);
});
