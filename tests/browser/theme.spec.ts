import { expect, test } from '@playwright/test';
test('system theme follows OS, explicit preference persists only theme', async ({page}) => {
 await page.emulateMedia({colorScheme:'dark'}); await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.getByLabel('Theme',{exact:true})).toHaveValue('system');
 await page.getByLabel('Theme',{exact:true}).selectOption('light');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 expect(await page.evaluate(() => ({...localStorage}))).toEqual({'markid-theme':'light'});
 await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByLabel('Theme',{exact:true}).selectOption('system');
 await page.emulateMedia({colorScheme:'light'}); await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('storage errors and invalid preference do not prevent editing', async ({page}) => {
 await page.addInitScript(() => { Object.defineProperty(Storage.prototype,'getItem',{value:() => {throw new Error('blocked');}}); Object.defineProperty(Storage.prototype,'setItem',{value:() => {throw new Error('blocked');}}); });
 await page.goto('/'); await page.getByLabel('Theme',{exact:true}).selectOption('dark');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/images/exif-6.png');
 await page.getByLabel('Watermark text').fill('Still editable');
 await expect(page.getByLabel('Watermark text')).toHaveValue('Still editable');
});
test('stored theme applied before editor becomes visible', async ({page}) => {
 await page.addInitScript(() => {localStorage.setItem('markid-theme','dark'); (window as unknown as {paintThemes:string[]}).paintThemes=[]; new MutationObserver(() => {if(document.querySelector('main')) (window as unknown as {paintThemes:string[]}).paintThemes.push(document.documentElement.dataset.theme ?? 'missing');}).observe(document,{subtree:true,childList:true});});
 await page.goto('/');await expect(page.getByLabel('Theme',{exact:true})).toHaveValue('dark');
 expect(await page.evaluate(() => (window as unknown as {paintThemes:string[]}).paintThemes)).not.toContain('missing');
 expect(await page.evaluate(() => (window as unknown as {paintThemes:string[]}).paintThemes)).not.toContain('light');
});
for(const theme of ['light','dark']) test(`control boundaries and CTA contrast ${theme}`,async ({page}) => {
 await page.goto('/');await page.getByLabel('Theme',{exact:true}).selectOption(theme);
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/images/exif-6.png');
 await expect(page.getByLabel('Watermark text')).toBeVisible();
 const ratios=await page.evaluate(() => {
 const luminance=(color:string) => {const rgb=color.match(/\d+/g)!.slice(0,3).map(Number).map(n => {const c=n/255;return c<=.04045 ? c/12.92:((c+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
 const ratio=(a:string,b:string)=> {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const input=getComputedStyle(document.querySelector('textarea')!),button=getComputedStyle(document.querySelector('.primary-button')!);
 return {border:ratio(input.borderTopColor,input.backgroundColor),text:ratio(input.color,input.backgroundColor),button:ratio(button.color,button.backgroundColor)};
 });
 expect(ratios.border).toBeGreaterThanOrEqual(3);expect(ratios.text).toBeGreaterThanOrEqual(4.5);expect(ratios.button).toBeGreaterThanOrEqual(4.5);
});
