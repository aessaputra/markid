import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
for(const name of ['encoded.heic','portrait.heif','lossy.webp','lossless.webp','alpha.webp','still.avif']) {
 test(`opens and exports genuine ${name}`,async({page})=>{
  const requests:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))requests.push(r.url());if(r.method()!=='GET')requests.push(r.method());});
  await page.goto('/');await page.getByLabel('Choose file').setInputFiles(`tests/fixtures/codecs/${name}`);
  await page.getByLabel('Watermark text').fill('For verification only');
  await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled({timeout:30000});
  const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
  const download=await wait;const data=await readFile((await download.path())!);expect([...data.subarray(0,3)]).toEqual([255,216,255]);expect(data.length).toBeLessThanOrEqual(1048576);expect(requests).toEqual([]);
 });
}
test('malformed genuine codec retains previous source and style',async({page})=>{await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/codecs/lossy.webp');await page.getByLabel('Watermark text').fill('retain malformed');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();await page.getByLabel('Choose file').setInputFiles({name:'truncated.webp',mimeType:'image/webp',buffer:(await readFile('tests/fixtures/codecs/lossy.webp')).subarray(0,35)});await expect(page.getByText('Could not open this file. Try a JPG or PNG.')).toBeVisible();await expect(page.getByLabel('Watermark text')).toHaveValue('retain malformed');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();});
test('unsupported collection retains existing editor',async({page})=>{await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/codecs/lossless.webp');await page.getByLabel('Watermark text').fill('retain');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();for(const file of ['animated.webp','collection.heif']){await page.getByLabel('Choose file').setInputFiles(`tests/fixtures/codecs/${file}`);await expect(page.getByText('Could not open this file. Try a JPG or PNG.')).toBeVisible();await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();}});
