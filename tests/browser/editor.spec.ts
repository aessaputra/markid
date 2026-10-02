import { expect, test } from '@playwright/test';
const portrait = 'tests/fixtures/images/exif-6.png';
test('editing and reset restores settings without deleting source', async ({page}) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(portrait);
  await page.getByLabel('Watermark text').fill('For verification only\n2026-10-02');
  await expect(page.getByRole('button', {name:'Preview',exact:true})).toBeEnabled();
  await page.getByLabel('Size', {exact:true}).fill('12');
  await page.getByLabel('Opacity', {exact:true}).fill('80');
  await page.getByText('More options', {exact:true}).click();
  await page.getByLabel('Color', {exact:true}).fill('#008844');
  await page.getByLabel('Position X').fill('20');
  await page.getByLabel('Position Y').fill('30');
  await page.getByLabel('Rotation', {exact:true}).fill('45');
  await page.getByRole('button', {name:'Reset',exact:true}).click();
  await expect(page.getByLabel('Watermark text')).toHaveValue('');
  await expect(page.getByLabel('Size', {exact:true})).toHaveValue('5');
  await expect(page.getByLabel('Opacity', {exact:true})).toHaveValue('35');
  await expect(page.getByLabel('Color', {exact:true})).toHaveValue('#18181b');
  await expect(page.getByLabel('Font', {exact:true})).toHaveValue('Geist');
  await expect(page.getByLabel('Position X')).toHaveValue('50');
  await expect(page.getByLabel('Position Y')).toHaveValue('50');
  await expect(page.getByLabel('Rotation', {exact:true})).toHaveValue('0');
  await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','80');
  await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-height','120');
  await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeDisabled();
});

test('preset, replacement and failed preparation preserve edits', async ({page}) => {
 await page.goto('/'); await page.locator('input[type=file]').setInputFiles(portrait);
 await page.getByLabel('Purpose',{exact:true}).fill('account check'); await page.getByLabel('Date',{exact:true}).fill('2026-10-02');
 await page.getByRole('button',{name:'Use preset'}).click();
 await expect(page.getByLabel('Watermark text')).toHaveValue('For account check only · 2026-10-02');
 await page.getByLabel('Opacity',{exact:true}).fill('0'); await page.getByText('More options',{exact:true}).click();
 await page.getByLabel('Position X').fill('20'); await page.getByLabel('Rotation',{exact:true}).fill('45');
 await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-1.png');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','120');
 await expect(page.getByLabel('Position X')).toHaveValue('50'); await expect(page.getByLabel('Opacity',{exact:true})).toHaveValue('0');
 await expect(page.getByLabel('Rotation',{exact:true})).toHaveValue('45');
 await page.locator('input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad')});
 await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('Watermark text')).toHaveValue('For account check only · 2026-10-02');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','120');
 await page.getByRole('button',{name:'Preview',exact:true}).click(); await expect(page.getByRole('alert')).toContainText('Your edits are kept');
 await expect(page.getByRole('button',{name:'Download',exact:true})).toHaveCount(0);
 await page.getByLabel('Watermark text').fill('   ');await expect(page.getByRole('button',{name:'Preview',exact:true})).toBeDisabled();
});
for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]) for(const theme of ['light','dark'] as const) {
 test(`layout ${width}x${height} ${theme}, keyboard and touch targets`,async ({page}) => {
 await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await page.goto('/');
 await page.locator('input[type=file]').setInputFiles(portrait);await page.getByText('More options',{exact:true}).click();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 const targets=await page.locator('button,input:not([type=file]),select,summary,textarea').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
 expect(targets.every(h => h >= 44)).toBe(true);
 await page.getByLabel('Watermark text').focus();await page.keyboard.type('Keyboard only');await page.keyboard.press('Tab');
 await expect(page.getByLabel('Purpose',{exact:true})).toBeFocused();
 await page.getByLabel('Position X').focus();await page.keyboard.press('ArrowRight');await expect(page.getByLabel('Position X')).toHaveValue('51');
 expect(await page.getByLabel('Position X').evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid');
 const position=await page.locator('.preview-panel').evaluate(n => getComputedStyle(n).position);
 expect(position).toBe(width >=1024 && height>=760 ? 'sticky':'static');
 const allTouch=await page.locator('main *').evaluateAll(nodes => nodes.filter(n => getComputedStyle(n).touchAction==='none').map(n => n.tagName));
 expect(allTouch).toEqual(['CANVAS']);
 });
}
test('drag uses image space and ends on cancellation or lost capture',async ({page}) => {
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);
 await page.getByLabel('Watermark text').fill('Drag');await page.getByText('More options',{exact:true}).click();
 const preview=page.getByLabel('Image preview');await expect(preview).toHaveAttribute('data-image-height','120');
 const box=(await preview.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 expect(await preview.evaluate(n => n.hasPointerCapture(1))).toBe(true);
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.75);await expect(page.getByLabel('Position Y')).toHaveValue('75');
 await preview.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.move(box.x+box.width/2,box.y+box.height*.1);
 await expect(page.getByLabel('Position Y')).toHaveValue('75');await page.mouse.up();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await preview.dispatchEvent('lostpointercapture',{pointerId:1});
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.1);await expect(page.getByLabel('Position Y')).toHaveValue('50');await page.mouse.up();
});
test('position changes reuse cached source and text asset',async ({page}) => {
 await page.addInitScript(() => { const original=window.createImageBitmap.bind(window); (window as unknown as {bitmapCalls:number}).bitmapCalls=0; window.createImageBitmap=((...args: Parameters<typeof createImageBitmap>) => { (window as unknown as {bitmapCalls:number}).bitmapCalls++;return original(...args); }) as typeof createImageBitmap; });
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);await page.getByLabel('Watermark text').fill('Cached');
 await page.getByText('More options',{exact:true}).click();await page.getByLabel('Image preview').screenshot();
 await page.waitForTimeout(150);
 const before=await page.evaluate(() => (window as unknown as {bitmapCalls:number}).bitmapCalls);
 for(const value of ['51','52','53']) {await page.getByLabel('Position X').fill(value);await page.waitForTimeout(50);}
 expect(await page.evaluate(() => (window as unknown as {bitmapCalls:number}).bitmapCalls)).toBe(before);
});
test('failed preview cache creation clears its temporary canvas',async ({page}) => {
 await page.goto('/');
 const result=await page.evaluate(async () => {
 const {createPreviewCache}=await import(String('/src/lib/editor/preview.ts'));
 const source=document.createElement('canvas');source.width=80;source.height=120;
 const original=document.createElement.bind(document);let temp:HTMLCanvasElement | null=null;
 document.createElement=((tag:string,...args:unknown[]) => {const node=original(tag,...args as []);if(tag==='canvas') temp=node as HTMLCanvasElement;return node;}) as typeof document.createElement;
 window.createImageBitmap=async()=>{throw new Error('forced cache failure');};
 let failed=false;try {await createPreviewCache({kind:'image',source,size:{width:80,height:120},resized:false,dispose(){}},{width:320,height:200});}catch {failed=true;}
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
  let red=0,blue=0,green=0,opaque=0;
  for(let i=0;i<pixels.length;i+=4) {
   if(pixels[i+3]===255) opaque++;
   if(pixels[i]>pixels[i+1]+30 && pixels[i]>pixels[i+2]+30) red++;
   if(pixels[i+2]===255 && pixels[i]===0 && pixels[i+1]===0 && pixels[i+3]===255) blue++;
   if(pixels[i+1]===255 && pixels[i]===0 && pixels[i+2]===0 && pixels[i+3]===255) green++;
  }
  return {red,blue,green,opaque};
 });
}
async function holdFontFailure(page: import('@playwright/test').Page) {
 await page.evaluate(() => {
  const state=window as unknown as {rejectFonts:()=>void; fontRequests:number};
  state.fontRequests=0;
  document.fonts.load=()=>new Promise((_,reject) => {
   state.fontRequests++;state.rejectFonts=()=>reject(new Error('forced font failure'));
  });
 });
}
async function rejectFont(page: import('@playwright/test').Page) {
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {fontRequests:number}).fontRequests)).toBeGreaterThan(0);
 await page.evaluate(()=>(window as unknown as {rejectFonts:()=>void}).rejectFonts());
 await expect(page.getByRole('alert')).toContainText('Watermark font could not be loaded.');
}
test('source pixels remain visible with prefilled text while initial font is pending or fails',async ({page}) => {
 await page.goto('/');
 const source=await solidFile(page,'#0000ff','blue.png');
 await page.getByLabel('Watermark text').fill('Prefilled');
 await holdFontFailure(page);
 await page.locator('input[type=file]').setInputFiles(source);
 await expect.poll(async()=> (await previewPixels(page)).blue).toBeGreaterThan(1000);
 expect((await previewPixels(page)).red).toBe(0);
 await rejectFont(page);
 await expect.poll(async()=> (await previewPixels(page)).blue).toBeGreaterThan(1000);
 await expect(page.getByLabel('Watermark text')).toHaveValue('Prefilled');
});


async function visibleMarkedBlue(page: import('@playwright/test').Page) {
 await page.goto('/');
 await page.getByLabel('Watermark text').fill('OLD MARK');
 await page.getByLabel('Size',{exact:true}).fill('20');
 await page.getByLabel('Opacity',{exact:true}).fill('100');
 await page.getByText('More options',{exact:true}).click();
 await page.getByLabel('Color',{exact:true}).fill('#ff0000');
 await page.locator('input[type=file]').setInputFiles(await solidFile(page,'#0000ff','blue.png'));
 await expect.poll(async()=> (await previewPixels(page)).blue).toBeGreaterThan(1000);
 await expect.poll(async()=> (await previewPixels(page)).red).toBeGreaterThan(100);
}
for(const failure of ['font','asset'] as const) test(`successful replacement shows new source pixels when ${failure} is pending or fails`,async ({page}) => {
 await visibleMarkedBlue(page);
 const next=await solidFile(page,'#00ff00','green.png');
 if(failure==='font') await holdFontFailure(page);
 else await page.evaluate(()=>{
  const original=window.createImageBitmap.bind(window);
  const state=window as unknown as {rejectFonts:()=>void; fontRequests:number};state.fontRequests=0;
  window.createImageBitmap=((...args:Parameters<typeof createImageBitmap>)=>{
   if(args[0] instanceof OffscreenCanvas) return new Promise((_,reject)=>{
    state.fontRequests++;state.rejectFonts=()=>reject(new Error('forced asset failure'));
   });
   return original(...args);
  }) as typeof createImageBitmap;
 });
 await page.locator('input[type=file]').setInputFiles(next);
 await expect.poll(async()=> (await previewPixels(page)).green).toBeGreaterThan(1000);
 expect(await previewPixels(page)).toMatchObject({blue:0,red:0});
 await rejectFont(page);
 expect(await previewPixels(page)).toMatchObject({blue:0,red:0});
 await expect(page.getByLabel('Watermark text')).toHaveValue('OLD MARK');
 // A decode failure, unlike a watermark failure, retains the last good source.
 await page.locator('input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad')});
 await expect(page.getByRole('alert')).toBeVisible();
 expect((await previewPixels(page)).green).toBeGreaterThan(1000);
});
test('failed text edit clears old watermark pixels while retaining source',async ({page}) => {
 await visibleMarkedBlue(page);
 await holdFontFailure(page);
 await page.getByLabel('Watermark text').fill('NEW FAILED MARK');
 await expect.poll(async()=> (await previewPixels(page)).red).toBe(0);
 expect((await previewPixels(page)).blue).toBeGreaterThan(1000);
 await rejectFont(page);
 expect((await previewPixels(page)).red).toBe(0);
 await expect(page.getByLabel('Watermark text')).toHaveValue('NEW FAILED MARK');
});

test('font preparation failure keeps text and source',async ({page}) => {
 await page.goto('/');await page.locator('input[type=file]').setInputFiles(portrait);
 await page.evaluate(() => {document.fonts.load=async()=>{throw new Error('forced font failure');};});
 await page.getByLabel('Watermark text').fill('Keep my text');
 await expect(page.getByRole('alert')).toContainText('Watermark font could not be loaded.');
 await expect(page.getByLabel('Watermark text')).toHaveValue('Keep my text');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','80');
});
