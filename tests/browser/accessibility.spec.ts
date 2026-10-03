import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const theme of ['light','dark']) for(const width of [320,1280]) test(`axe WCAG2 AA ${theme} ${width}: editor and final image/PDF, keyboard`,async({page},info)=>{
 await page.setViewportSize({width,height:800});
 await page.goto('/');await page.getByLabel('Theme').selectOption(theme);
 const scan=async(stage:string)=>{
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  await info.attach(`${stage}-axe`,{body:JSON.stringify(results),contentType:'application/json'});
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 };
 await scan('empty');
 const button=page.getByRole('button',{name:'Choose file'});await button.focus();
 const chooser=page.waitForEvent('filechooser');await page.keyboard.press('Enter');
 await (await chooser).setFiles('tests/fixtures/images/exif-6.png');
 await page.getByLabel('Watermark text').focus();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.type('Keyboard watermark');
 await page.keyboard.press('Tab');await expect(page.getByLabel('Size',{exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Right',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Right',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('Angle',{exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByLabel('Angle',{exact:true})).toHaveValue('1');
 await scan('image-editor');
 await page.getByRole('button',{name:'Preview',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();await scan('image-result');
 await page.getByRole('button',{name:'Back to edit'}).click();
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');
 await expect(page.getByText('Page 1 of 2')).toBeVisible();await scan('pdf-editor');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();await scan('pdf-result');
});
