import {expect,test} from '@playwright/test';
for (const source of ['tests/fixtures/images/exif-6.png','tests/fixtures/pdf/two-pages.pdf']) for(const width of [390,1280]) {
 test(`selection drag and radial resize ${source} ${width}`,async({page})=>{
  await page.setViewportSize({width,height:800});await page.goto('/');await page.locator('input[type=file]').setInputFiles(source);
  await page.getByLabel('Watermark text').fill('Selection');
  await page.getByLabel('Angle',{exact:true}).fill('35');await page.getByLabel('Angle',{exact:true}).press('Enter');
  const selection=page.locator('.watermark-selection'),frame=page.locator('.preview-frame');await expect(selection).toBeVisible();
  await expect(selection.locator('.resize-handle')).toHaveCount(4);await frame.scrollIntoViewIfNeeded();
  const before=(await selection.boundingBox())!;const center={x:before.x+before.width/2,y:before.y+before.height/2};
  // A noncentral grab must not snap the anchor to the pointer.
  await page.mouse.move(center.x+2,center.y+2);await page.mouse.down();
  const grabbed=(await selection.boundingBox())!;expect(grabbed.x).toBeCloseTo(before.x,1);expect(grabbed.y).toBeCloseTo(before.y,1);
  await page.mouse.move(center.x+12,center.y+22);await page.mouse.up();
  const moved=(await selection.boundingBox())!;expect(moved.x-before.x).toBeCloseTo(10,0);expect(moved.y-before.y).toBeCloseTo(20,0);
  const c={x:moved.x+moved.width/2,y:moved.y+moved.height/2};
  const handle=selection.locator('[data-corner="se"]');const h=(await handle.boundingBox())!;const start={x:h.x+h.width/2,y:h.y+h.height/2};
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(c.x+(start.x-c.x)*2,c.y+(start.y-c.y)*2);await page.mouse.up();
  await expect.poll(async()=>Number(await page.getByLabel('Size',{exact:true}).inputValue())).toBeCloseTo(10,0);
  await expect(selection).toBeVisible();const resized=(await selection.boundingBox())!;expect(resized.x+resized.width/2).toBeCloseTo(c.x,0);expect(resized.y+resized.height/2).toBeCloseTo(c.y,0);
  // Canvas/letterbox is not a drag target.
  const f=(await frame.boundingBox())!;await page.mouse.move(f.x+2,f.y+2);await page.mouse.down();await page.mouse.move(f.x+20,f.y+30);await page.mouse.up();
  const unchanged=(await selection.boundingBox())!;expect(unchanged.x).toBeCloseTo(resized.x,0);expect(unchanged.y).toBeCloseTo(resized.y,0);
 });
}

for(const source of ['tests/fixtures/images/exif-6.png','tests/fixtures/pdf/two-pages.pdf']) {
 test(`every corner shrinks/grows and clamps at fixed center ${source}`,async({page})=>{
  await page.goto('/');await page.locator('input[type=file]').setInputFiles(source);await page.getByLabel('Watermark text').fill('Corners');
  const selection=page.locator('.watermark-selection');
  for(const angle of [0,90,-35]) for(const corner of ['nw','ne','sw','se']) {
   await page.getByLabel('Size',{exact:true}).fill('5');await page.getByLabel('Size',{exact:true}).press('Enter');
   await page.getByLabel('Angle',{exact:true}).fill(String(angle));await page.getByLabel('Angle',{exact:true}).press('Enter');
   await expect(selection).toBeVisible();await page.locator('.preview-frame').scrollIntoViewIfNeeded();
   const box=(await selection.boundingBox())!,c={x:box.x+box.width/2,y:box.y+box.height/2};
   const h=(await selection.locator(`[data-corner="${corner}"]`).boundingBox())!,p={x:h.x+h.width/2,y:h.y+h.height/2};
   await page.mouse.move(p.x,p.y);await page.mouse.down();
   await page.mouse.move(c.x+(p.x-c.x)*.6,c.y+(p.y-c.y)*.6);
   await expect(page.getByLabel('Size',{exact:true})).toHaveValue('3');
   await page.mouse.move(c.x,c.y);await expect(page.getByLabel('Size',{exact:true})).toHaveValue('1');
   await page.mouse.move(c.x+(p.x-c.x)*6,c.y+(p.y-c.y)*6);await page.mouse.up();
   await expect(page.getByLabel('Size',{exact:true})).toHaveValue('20');await expect(selection).toBeVisible();
   const after=(await selection.boundingBox())!;expect(after.x+after.width/2).toBeCloseTo(c.x,0);expect(after.y+after.height/2).toBeCloseTo(c.y,0);
  }
 });
 test(`native touch capture drag and resize ${source}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('input[type=file]').setInputFiles(source);
  await page.getByLabel('Watermark text').fill('Touch');const selection=page.locator('.watermark-selection');await expect(selection).toBeVisible();
  await page.locator('.preview-frame').scrollIntoViewIfNeeded();const b=(await selection.boundingBox())!,c={x:b.x+b.width/2,y:b.y+b.height/2};
  const session=await page.context().newCDPSession(page);
  const touch=async(type:'touchStart'|'touchMove'|'touchEnd'|'touchCancel',x:number,y:number)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:0}]});
  await touch('touchStart',c.x+1,c.y);await touch('touchMove',c.x+11,c.y+20);await touch('touchEnd',0,0);
  const moved=(await selection.boundingBox())!;expect(moved.x-b.x).toBeCloseTo(10,0);expect(moved.y-b.y).toBeCloseTo(20,0);
  const h=(await selection.locator('[data-corner="se"]').boundingBox())!,p={x:h.x+h.width/2,y:h.y+h.height/2},center={x:moved.x+moved.width/2,y:moved.y+moved.height/2};
  await touch('touchStart',p.x,p.y);await touch('touchMove',center.x+(p.x-center.x)*2,center.y+(p.y-center.y)*2);await touch('touchCancel',0,0);
  await expect(page.getByLabel('Size',{exact:true})).toHaveValue('10');
  await session.detach();expect(await page.locator('.preview-frame').evaluate(n=>n.hasPointerCapture(2))).toBe(false);
 });
}
