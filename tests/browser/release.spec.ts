import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
test.skip(({baseURL})=>!baseURL?.endsWith(':5174'),'Production HTTP headers only');
test('actual HTTP security headers, immutable hashed assets and HTML conditional revalidation',async({request})=>{
 const html=await request.get('/');expect(html.status()).toBe(200);
 const headers=html.headers();
 expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
 expect(headers['content-security-policy']).toContain("form-action 'none'");
 expect(headers['content-security-policy']).not.toContain('unsafe-eval');
 expect(headers['x-content-type-options']).toBe('nosniff');
 expect(headers['cache-control']).toBe('no-cache');
 expect(headers.etag).toMatch(/^"[a-f0-9]+"$/);
 const revalidated=await request.get('/',{headers:{'If-None-Match':headers.etag}});
 expect(revalidated.status()).toBe(304);expect(await revalidated.body()).toHaveLength(0);
 expect(revalidated.headers()['cache-control']).toBe('no-cache');
 const script=(await html.text()).match(/src="([^"]+\.js)"/)![1];
 const asset=await request.get(script);expect(asset.status()).toBe(200);
 expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
 expect(asset.headers()['content-type']).toBe('text/javascript');
 const cached=await request.get(script,{headers:{'If-None-Match':asset.headers().etag}});
 expect(cached.status()).toBe(304);
});
test('production main Canvas fallback exports under real CSP',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'OffscreenCanvas',{value:undefined});});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{(window as any).violations=[];document.addEventListener('securitypolicyviolation',e=>(window as any).violations.push(e.violatedDirective));});
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/images/exif-6.png');
 await page.getByLabel('Watermark text').fill('Canvas fallback');await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 expect(await (await event).failure()).toBeNull();
 expect(errors).toEqual([]);expect(await page.evaluate(()=>(window as any).violations)).toEqual([]);
});
test('downloaded synthetic small text JPEG and final PDF zoom artifact',async({page},info)=>{
 await page.goto('/');
 const png=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1600;c.height=1000;
  const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,1600,1000);
  ctx.fillStyle='#111';ctx.font='32px Geist';ctx.fillText('SYNTHETIC TEST CARD — NOT A REAL ID',80,90);
  for(const [i,size] of [12,16,20,24,32].entries()) {ctx.font=`${size}px Geist`;ctx.fillText(`Sample ${size}px: ABCDEFGH 0123456789 / Local readability check`,80,180+i*120);}
  return c.toDataURL('image/png').split(',')[1];
 });
 const source=Buffer.from(png,'base64');await import('node:fs/promises').then(fs=>fs.writeFile(info.outputPath('small-text-source.png'),source));
 await page.getByLabel('Choose file').setInputFiles({name:'synthetic-small-text.png',mimeType:'image/png',buffer:source});
 await page.getByLabel('Watermark text').fill('For local testing only\n2026-10-02');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 const file=info.outputPath('small-text-final.jpg');await (await event).saveAs(file);
 expect((await readFile(file)).length).toBeLessThanOrEqual(1048576);
 await page.getByRole('button',{name:'Back to edit'}).click();
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 await (await pdfEvent).saveAs(info.outputPath('watermark-final.pdf'));
 // Independent Poppler renders actual downloaded bytes at 216dpi (3x 72dpi).
 execFileSync('pdftoppm',['-f','1','-singlefile','-r','216','-png',info.outputPath('watermark-final.pdf'),info.outputPath('pdf-watermark-3x')]);
});
