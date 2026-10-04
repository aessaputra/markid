import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.skip(({baseURL})=>!baseURL?.endsWith(':5174'),'Production header server only');
test('production CSP loads pinned CDN HEVC decoder without eval or user data egress',async({page})=>{
 const requests:string[]=[];const errors:string[]=[];
 page.on('request',r=>{requests.push(r.url());expect(r.method()).toBe('GET');});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{(window as unknown as {violations:string[]}).violations=[];document.addEventListener('securitypolicyviolation',e=>(window as unknown as {violations:string[]}).violations.push(e.violatedDirective));});
 const decoderResponse=page.waitForResponse('https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js');
 const response=await page.goto('/');const csp=response?.headers()['content-security-policy'];expect(csp).toBeTruthy();expect(csp).not.toContain('unsafe-eval');
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/codecs/encoded.heic');await page.getByLabel('Watermark text').fill('PRIVATE-CSP-MARK');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>(window as unknown as {violations:string[]}).violations)).toEqual([]);expect(errors).toEqual([]);expect(requests.every(u=>u==='https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js'||u.startsWith('http://127.0.0.1:5174/')||u.startsWith('blob:')||u.startsWith('data:'))).toBe(true);expect(requests.join(' ')).not.toContain('PRIVATE-CSP-MARK');expect(requests).toContain('https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js');
 expect((await decoderResponse).status()).toBe(200);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 const data=await readFile((await (await pending).path())!);expect([...data.subarray(0,3)]).toEqual([255,216,255]);
 const size=await page.evaluate(async bytes=>{const b=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/jpeg'}));const size=[b.width,b.height];b.close();return size;},[...data]);expect(size).toEqual([320,240]);
});

test('native images bypass CDN; failed CDN replacement keeps prior source and settings',async({page,context})=>{
 const requests:string[]=[];context.on('request',r=>requests.push(r.url()));
 await page.goto('/');
 for(const name of ['exif-6.jpg','exif-6.png']){await page.getByLabel('Choose file').setInputFiles(`tests/fixtures/images/${name}`);await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();}
 expect(requests).not.toContain('https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js');
 await page.getByLabel('Watermark text').fill('Retain source');
 const preview=page.getByLabel('Image preview',{exact:true});const width=await preview.getAttribute('data-image-width'),height=await preview.getAttribute('data-image-height');
 await context.route('https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js',route=>route.abort('failed'));
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/codecs/encoded.heic');
 await expect(page.getByText('Could not open this file. Try a JPG or PNG.')).toBeVisible();
 expect(requests).toContain('https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/csp/heic-to.js');
 await expect(page.getByLabel('Watermark text')).toHaveValue('Retain source');
 await expect(preview).toHaveAttribute('data-image-width',width!);await expect(preview).toHaveAttribute('data-image-height',height!);
 await expect(page.getByText('exif-6.png',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();
});
