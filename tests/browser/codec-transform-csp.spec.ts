import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.skip(({baseURL})=>!baseURL?.endsWith(':5174'),'Production header server only');
for(const ext of ['webp','avif','heif']) for(const transform of ['rotate','mirror']) for(const fallback of [false,true]) test(`production ${transform}.${ext} ${fallback?'forced fallback':'primary'} JPEG transform`,async({page})=>{
 if(fallback)await page.addInitScript(()=>{const original=createImageBitmap;window.createImageBitmap=((source:ImageBitmapSource,...args:unknown[])=>source instanceof Blob&&['image/webp','image/avif','image/heif'].includes(source.type)?Promise.reject(new Error('forced native failure')):original(source,...args as [])) as typeof createImageBitmap;});
 const violations:string[]=[];page.on('pageerror',e=>violations.push(e.message));
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles(`tests/fixtures/codecs/${transform}.${ext}`);await page.getByLabel('Watermark text').fill('Parity');
 await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled({timeout:30000});
 const preview=page.getByLabel('Image preview',{exact:true});await expect(preview).toHaveAttribute('data-image-width',transform==='rotate'?'240':'320');await expect(preview).toHaveAttribute('data-image-height',transform==='rotate'?'320':'240');
 await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();const data=await readFile((await (await wait).path())!);
 const actual=await page.evaluate(async(bytes)=>{const b=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/jpeg'}));const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const ctx=c.getContext('2d')!;ctx.drawImage(b,0,0);const pixels=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>[...ctx.getImageData(Math.floor(x*c.width),Math.floor(y*c.height),1,1).data]);b.close();return {size:[c.width,c.height],pixels};},[...data]);
 expect(actual.size).toEqual(transform==='rotate'?[240,320]:[320,240]);expect(actual.pixels.map(p=>p[0]>180?(p[1]>180?'Y':'R'):p[1]>90?'G':'B')).toEqual(transform==='rotate'?['B','R','Y','G']:['G','R','Y','B']);expect(violations).toEqual([]);
});
