import {test,expect} from '@playwright/test';
test.skip(({baseURL})=>!baseURL?.endsWith(':5174'),'Production header server only');
test('PDF production CSP: local worker, final pixels and no active content',async({page})=>{
 const requests:string[]=[],errors:string[]=[];
 page.on('request',r=>{requests.push(r.url());expect(r.method()).toBe('GET');});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{(window as any).violations=[];document.addEventListener('securitypolicyviolation',e=>(window as any).violations.push(e.violatedDirective));});
 await page.goto('/');expect(requests.some(u=>/pdf[-.]/.test(u))).toBe(false);
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');await expect(page.getByText('Page 1 of 2')).toBeVisible();
 await page.getByLabel('Watermark text').fill('PRIVATE-PDF-MARK');await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).violations)).toEqual([]);expect(errors).toEqual([]);expect(requests.every(u=>u.startsWith('http://127.0.0.1:5174/')||u.startsWith('blob:')||u.startsWith('data:'))).toBe(true);expect(requests.join(' ')).not.toContain('PRIVATE-PDF-MARK');expect(requests.some(u=>/pdf.worker.*mjs/.test(u))).toBe(true);
});
