import {test,expect} from '@playwright/test';
test.skip(({baseURL})=>!baseURL?.endsWith(':5174'),'Production header server only');
test('production CSP loads lazy HEVC assets with no eval or external requests',async({page})=>{
 const requests:string[]=[];const errors:string[]=[];
 page.on('request',r=>{requests.push(r.url());expect(r.method()).toBe('GET');});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{(window as unknown as {violations:string[]}).violations=[];document.addEventListener('securitypolicyviolation',e=>(window as unknown as {violations:string[]}).violations.push(e.violatedDirective));});
 const response=await page.goto('/');const csp=response?.headers()['content-security-policy'];expect(csp).toBeTruthy();expect(csp).not.toContain('unsafe-eval');
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/codecs/encoded.heic');await page.getByLabel('Watermark text').fill('PRIVATE-CSP-MARK');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>(window as unknown as {violations:string[]}).violations)).toEqual([]);expect(errors).toEqual([]);expect(requests.every(u=>u.startsWith('http://127.0.0.1:5174/')||u.startsWith('blob:')||u.startsWith('data:'))).toBe(true);expect(requests.join(' ')).not.toContain('PRIVATE-CSP-MARK');expect(requests.some(u=>/heic-to.*\.js/.test(u))).toBe(true);
});
