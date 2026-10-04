import { expect, test } from '@playwright/test';
const portrait = 'tests/fixtures/images/exif-6.png';
for (const state of ['initial', 'Reset']) test(`${state} watermark defaults keep the approved style and placement`, async ({page}) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(portrait);
  if (state === 'Reset') {
    await page.getByLabel('Watermark text').fill('For verification only\n2026-10-02');
    await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();
    for (const [name, value] of [['Size','12'],['Opacity','80'],['Angle','45']]) {
      await page.getByLabel(name,{exact:true}).fill(value);
      await page.getByLabel(name,{exact:true}).press('Enter');
    }
    await page.getByLabel('Color',{exact:true}).fill('#008844');
    await page.getByRole('button',{name:'Top left',exact:true}).click();
    await page.getByRole('button',{name:'Tiled',exact:true}).click();
    for (const name of ['Horizontal gap value','Vertical gap value']) {
      await page.getByRole('spinbutton',{name,exact:true}).fill('100');
      await page.getByRole('spinbutton',{name,exact:true}).press('Enter');
    }
    await page.getByRole('button',{name:'Reset',exact:true}).click();
  }
  const stamp = await page.evaluate(() => {const today=new Date();return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;});
  await expect(page.getByLabel('Watermark text')).toHaveValue(`For verification only, ${stamp}`);
  await expect(page.getByLabel('Size',{exact:true})).toHaveValue('5');
  await expect(page.getByLabel('Opacity',{exact:true})).toHaveValue('30');
  await expect(page.getByLabel('Color',{exact:true})).toHaveValue('#888888');
  await expect(page.getByLabel('Angle',{exact:true})).toHaveValue('-45');
  await expect(page.getByRole('button',{name:'Single',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Center',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('Font',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','80');
  await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-height','120');
  await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Horizontal gap value',exact:true})).toHaveValue('25');
  await expect(page.getByRole('spinbutton',{name:'Vertical gap value',exact:true})).toHaveValue('75');
});
test('replacement and failed preparation preserve direct text edits', async ({page}) => {
 await page.goto('/'); await page.locator('input[type=file]').setInputFiles(portrait);
 await page.getByLabel('Watermark text').fill('For account check only · 2026-10-02');
 await expect(page.getByLabel('Watermark text')).toHaveValue('For account check only · 2026-10-02');
 await page.getByLabel('Opacity',{exact:true}).fill('0');
 await page.getByRole('button',{name:'Left',exact:true}).click(); await page.getByLabel('Angle',{exact:true}).fill('45');
 await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-1.png');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','120');
 await expect(page.getByRole('button',{name:'Center',exact:true})).toHaveAttribute('aria-pressed','true'); await expect(page.getByLabel('Opacity',{exact:true})).toHaveValue('0');
 await expect(page.getByLabel('Angle',{exact:true})).toHaveValue('45');
 await page.locator('input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad')});
 await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('Watermark text')).toHaveValue('For account check only · 2026-10-02');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','120');
 // Inject an actual worker export failure rather than the removed Task 4 placeholder.
 await page.route('**/export.worker.ts*',route=>route.abort());
 await page.getByRole('button',{name:'Preview',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('Export failed. Try again.');
 await expect(page.getByRole('button',{name:'Download',exact:true})).toHaveCount(0);
 await page.getByLabel('Watermark text').fill('   ');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeDisabled();
});
for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]) for(const theme of ['light','dark'] as const) {
 test(`layout ${width}x${height} ${theme}, keyboard and touch targets`,async ({page}) => {
 await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await page.goto('/');
 await page.locator('input[type=file]').setInputFiles(portrait);
 await expect(page.getByLabel('Watermark text')).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 if(width>=1024) {
  const panel=await page.locator('.preview-panel').boundingBox(),controls=await page.locator('.editor-layout > fieldset').boundingBox();
  expect(Math.abs(panel!.height-controls!.height)).toBeLessThanOrEqual(48);
  const frame=await page.locator('.preview-frame').boundingBox();
  expect(frame!.height).toBeGreaterThanOrEqual(Math.min(500,panel!.height-120));
 }
 const targets=await page.locator('button,input:not([type=file]),select,textarea').evaluateAll(nodes => nodes.map(n => (n.closest('.range-number') ?? n).getBoundingClientRect().height));
 expect(targets.every(h => h >= 44)).toBe(true);
 await page.getByLabel('Watermark text').fill('Keyboard only');await page.getByLabel('Watermark text').focus();await page.keyboard.press('Tab');
 await expect(page.getByLabel('Size',{exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Right',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Right',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('Angle',{exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByLabel('Angle',{exact:true})).toHaveValue('-44');
 expect(await page.getByLabel('Angle',{exact:true}).evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid');
 const position=await page.locator('.preview-panel').evaluate(n => getComputedStyle(n).position);
 expect(position).toBe(width >=1024 && height>=760 ? 'sticky':'relative');
 const allTouch=await page.locator('main *').evaluateAll(nodes => nodes.filter(n => getComputedStyle(n).touchAction==='none').map(n => n.tagName));
 expect(allTouch).toEqual(['DIV','SPAN','SPAN','SPAN','SPAN']);
 });
}
test('all nine position presets place the watermark inside the source',async ({page}) => {
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);
 await page.getByLabel('Watermark text').fill('Positions');
 const names = ['Top left','Top','Top right','Left','Center','Right','Bottom left','Bottom','Bottom right'];
 for (const name of names) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
 }
});
test('long corner text stays fully visible instead of clipping',async ({page}) => {
 await page.setViewportSize({width:1280,height:800});await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);
 await page.getByLabel('Watermark text').fill('For verification only, 2026-10-03');
 await page.getByLabel('Size',{exact:true}).fill('5');await page.getByLabel('Size',{exact:true}).press('Enter');
 for (const name of ['Bottom left','Top right']) {
  await page.getByRole('button',{name,exact:true}).click();
  await page.locator('.preview-frame').scrollIntoViewIfNeeded();
  const selection=await page.locator('.watermark-selection').boundingBox(),frame=await page.locator('.preview-frame').boundingBox(),canvas=await page.locator('.editor-canvas').boundingBox();
  const dims=await page.locator('.editor-canvas').evaluate(n => ({w:Number((n as HTMLElement).dataset.imageWidth),h:Number((n as HTMLElement).dataset.imageHeight)}));
  const scale=Math.min(canvas!.width/dims.w,canvas!.height/dims.h);
  const imageBox={x:canvas!.x+(canvas!.width-dims.w*scale)/2,y:canvas!.y+(canvas!.height-dims.h*scale)/2,width:dims.w*scale,height:dims.h*scale};
  expect(selection!.x).toBeGreaterThanOrEqual(imageBox.x-1);
  expect(selection!.y).toBeGreaterThanOrEqual(imageBox.y-1);
  expect(selection!.x+selection!.width).toBeLessThanOrEqual(imageBox.x+imageBox.width+1);
  expect(selection!.y+selection!.height).toBeLessThanOrEqual(imageBox.y+imageBox.height+1);
  expect(selection!.x).toBeGreaterThanOrEqual(frame!.x-1);
 }
});
test('drag uses image space and ends on cancellation or lost capture',async ({page}) => {
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);
 await page.getByLabel('Watermark text').fill('Drag');
 const selection=page.locator('.watermark-selection'),frame=page.locator('.preview-frame');await expect(selection).toBeVisible();
 for(const event of ['pointercancel','lostpointercapture']) {
  await page.getByRole('button',{name:'Center',exact:true}).click();
  const box=(await selection.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  expect(await frame.evaluate(n=>n.hasPointerCapture(1))).toBe(true);
  await frame.dispatchEvent(event,{pointerId:1});
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2+30);await page.mouse.up();
  await expect(page.getByRole('button',{name:'Center',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await frame.evaluate(n=>n.hasPointerCapture(1))).toBe(false);
 }
});
test('position changes reuse cached source and text asset',async ({page}) => {
 await page.addInitScript(() => { const original=window.createImageBitmap.bind(window); (window as unknown as {bitmapCalls:number}).bitmapCalls=0; window.createImageBitmap=((...args: Parameters<typeof createImageBitmap>) => { (window as unknown as {bitmapCalls:number}).bitmapCalls++;return original(...args); }) as typeof createImageBitmap; });
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);await page.getByLabel('Watermark text').fill('Cached');
 await page.getByLabel('Image preview').screenshot();
 await page.waitForTimeout(150);
 const before=await page.evaluate(() => (window as unknown as {bitmapCalls:number}).bitmapCalls);
 for(const name of ['Left','Top','Right']) {await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(50);}
 expect(await page.evaluate(() => (window as unknown as {bitmapCalls:number}).bitmapCalls)).toBe(before);
});
test('failed preview cache creation clears its temporary canvas',async ({page}) => {
 await page.goto('/');
 const result=await page.evaluate(async () => {
 const {createPreviewCache}=await import(String('/src/lib/editor/preview.ts'));
 const source=document.createElement('canvas');source.width=80;source.height=120;
 const original=document.createElement.bind(document);let temp:HTMLCanvasElement | null=null;
 document.createElement=((tag:string,...args:unknown[]) => {const node=original(tag,...args as []);if(tag==='canvas') temp=node as HTMLCanvasElement;return node;}) as typeof document.createElement;
 window.createImageBitmap=()=>Promise.reject(new Error('forced cache failure'));
 let failed=false;try {await createPreviewCache({kind:'image',source,size:{width:80,height:120},dispose(){}},{width:320,height:200});}catch {failed=true;}
 return {failed,width:temp!.width,height:temp!.height};
 });
 expect(result).toEqual({failed:true,width:0,height:0});
});
test('obsolete async preview assets close after rapid edits and replacement',async ({page}) => {
 await page.addInitScript(() => {
 const live=new Set<ImageBitmap>();(window as unknown as {liveBitmaps:Set<ImageBitmap>}).liveBitmaps=live;
 const original=window.createImageBitmap.bind(window), close=ImageBitmap.prototype.close;
 ImageBitmap.prototype.close=function() {live.delete(this);return close.call(this);};
 window.createImageBitmap=(async (...args:Parameters<typeof createImageBitmap>) => {const bitmap=await original(...args);live.add(bitmap);if(!(args[0] instanceof Blob)) await new Promise(resolve=>setTimeout(resolve,100));return bitmap;}) as typeof createImageBitmap;
 });
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);
 await page.getByLabel('Watermark text').fill('First');await page.getByLabel('Watermark text').fill('Newest');
 await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-1.png');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','120');
 await expect.poll(() => page.evaluate(() => (window as unknown as {liveBitmaps:Set<ImageBitmap>}).liveBitmaps.size)).toBe(3);
 await page.waitForTimeout(250);expect(await page.evaluate(() => (window as unknown as {liveBitmaps:Set<ImageBitmap>}).liveBitmaps.size)).toBe(3);
 await expect(page.getByLabel('Watermark text')).toHaveValue('Newest');
});

// Solid source colors isolate source identity from red watermark ink.
async function solidFile(page: import('@playwright/test').Page, color: string, name: string) {
 const png = await page.evaluate(color => {
  const c=document.createElement('canvas');c.width=240;c.height=160;
  const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);
  return c.toDataURL('image/png').split(',')[1];
 },color);
 return {name,mimeType:'image/png',buffer:Buffer.from(png,'base64')};
}
async function previewPixels(page: import('@playwright/test').Page) {
 return page.getByLabel('Image preview').evaluate((node: HTMLCanvasElement) => {
  const ctx=node.getContext('2d')!;
  const pixels=ctx.getImageData(0,0,node.width,node.height).data;
  let red=0,blue=0,green=0;
  for(let i=0;i<pixels.length;i+=4) {
   if(pixels[i]>pixels[i+1]+30 && pixels[i]>pixels[i+2]+30) red++;
   if(pixels[i+2]===255 && pixels[i]===0 && pixels[i+1]===0 && pixels[i+3]===255) blue++;
   if(pixels[i+1]===255 && pixels[i]===0 && pixels[i+2]===0 && pixels[i+3]===255) green++;
  }
  return {red,blue,green};
 });
}
async function holdAssetFailure(page: import('@playwright/test').Page) {
 await page.evaluate(() => {
  const original = window.createImageBitmap.bind(window);
  const state = window as unknown as { rejectAssets: () => void; assetRequests: number };
  state.assetRequests = 0;
  const pending: Array<(e: Error) => void> = [];
  window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
   if (args[0] instanceof OffscreenCanvas) return new Promise<never>((_, reject) => {
    state.assetRequests++;
    pending.push(reject);
    state.rejectAssets = () => { const r = pending.splice(0); r.forEach(fn => fn(new Error('forced asset failure'))); };
   });
   return original(...args);
  }) as typeof createImageBitmap;
 });
}
async function rejectAssets(page: import('@playwright/test').Page) {
 await expect.poll(() => page.evaluate(() => (window as unknown as { assetRequests: number }).assetRequests)).toBeGreaterThan(0);
 await page.evaluate(() => (window as unknown as { rejectAssets: () => void }).rejectAssets());
 await expect(page.getByRole('alert')).toContainText('Watermark could not be rendered.');
}
test('source pixels remain visible with prefilled text while initial asset is pending or fails',async ({page}) => {
 await page.goto('/');
 const source=await solidFile(page,'#0000ff','blue.png');
 await holdAssetFailure(page);
 await page.locator('input[type=file]').setInputFiles(source);
 await expect.poll(async()=> (await previewPixels(page)).blue).toBeGreaterThan(1000);
 expect((await previewPixels(page)).red).toBe(0);
 await rejectAssets(page);
 await expect.poll(async()=> (await previewPixels(page)).blue).toBeGreaterThan(1000);
 await expect(page.getByLabel('Watermark text')).toHaveValue(`For verification only, ${await page.evaluate(() => new Date().toLocaleDateString('en-CA'))}`);
});


async function visibleMarkedBlue(page: import('@playwright/test').Page) {
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles(await solidFile(page,'#0000ff','blue.png'));
 await page.getByLabel('Watermark text').fill('OLD MARK');
 await page.getByLabel('Size',{exact:true}).fill('20');await page.getByLabel('Size',{exact:true}).press('Enter');
 await page.getByLabel('Opacity',{exact:true}).fill('100');await page.getByLabel('Opacity',{exact:true}).press('Enter');
 await page.getByLabel('Color',{exact:true}).fill('#ff0000');
 await expect.poll(async()=> (await previewPixels(page)).blue).toBeGreaterThan(1000);
 await expect.poll(async()=> (await previewPixels(page)).red).toBeGreaterThan(100);
}
test('successful replacement shows new source pixels while the asset is pending or fails',async ({page}) => {
 await visibleMarkedBlue(page);
 const next=await solidFile(page,'#00ff00','green.png');
 await holdAssetFailure(page);
 await page.locator('input[type=file]').setInputFiles(next);
 await expect.poll(async()=> (await previewPixels(page)).green).toBeGreaterThan(1000);
 expect(await previewPixels(page)).toMatchObject({blue:0,red:0});
 await rejectAssets(page);
 expect(await previewPixels(page)).toMatchObject({blue:0,red:0});
 await expect(page.getByLabel('Watermark text')).toHaveValue('OLD MARK');
 // A decode failure, unlike a watermark failure, retains the last good source.
 await page.locator('input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad')});
 await expect(page.getByRole('alert')).toBeVisible();
 expect((await previewPixels(page)).green).toBeGreaterThan(1000);
});
test('failed text edit clears old watermark pixels while retaining source',async ({page}) => {
 await visibleMarkedBlue(page);
 await holdAssetFailure(page);
 await page.getByLabel('Watermark text').fill('NEW FAILED MARK');
 await expect.poll(async()=> (await previewPixels(page)).red).toBe(0);
 expect((await previewPixels(page)).blue).toBeGreaterThan(1000);
 await rejectAssets(page);
 expect((await previewPixels(page)).red).toBe(0);
 await expect(page.getByLabel('Watermark text')).toHaveValue('NEW FAILED MARK');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','240');
});
