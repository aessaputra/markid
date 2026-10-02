import { test, expect } from '@playwright/test';

for (const dpr of [1, 2]) for (const area of [{ width: 600, height: 400 }, { width: 400, height: 600 }, { width: 400, height: 400 }]) {
  test(`composition parity, single opacity and clockwise rotation ${area.width}x${area.height} DPR ${dpr}`, async ({ browser }) => {
    const context = await browser.newContext({ deviceScaleFactor: dpr });
    const page = await context.newPage();
    await page.goto('/');
    const result = await page.evaluate(async ({ area, dpr }) => {
      const path = '/src/lib/editor/watermark.ts';
      const { renderWatermark, composeWatermark } = await import(/* @vite-ignore */ path);
      const mark = { text: 'Ágj\nFor verification only', fontFamily: 'Geist', sizeRatio: .08, x: .53, y: .41, angle: 0, opacity: .5, color: '#ff0000' };
      const bitmap = await renderWatermark(mark, area);
      function bounds(canvas: HTMLCanvasElement) {
        const p = canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
        let l=canvas.width,r=-1,t=canvas.height,b=-1,max=0;
        for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
          const a=p[(y*canvas.width+x)*4+3];
          if(a) { l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);max=Math.max(max,a); }
        }
        return { l,r,t,b,max };
      }
      const out = [];
      for (const angle of [-180, 0, 45, 180]) {
        const full=document.createElement('canvas');full.width=area.width;full.height=area.height;
        const preview=document.createElement('canvas');preview.width=area.width/2*dpr;preview.height=area.height/2*dpr;
        composeWatermark(full.getContext('2d')!,bitmap,{...mark,angle},area);
        const ctx=preview.getContext('2d')!;ctx.scale(dpr/2,dpr/2);
        composeWatermark(ctx,bitmap,{...mark,angle},area);
        const a=bounds(full),b=bounds(preview);
        out.push({ angle, max:a.max, error:Math.max(...(['l','r','t','b'] as const).map(k=>Math.abs(a[k]/2-b[k]/dpr))) });
      }
      const zero=document.createElement('canvas');zero.width=area.width;zero.height=area.height;
      composeWatermark(zero.getContext('2d')!,bitmap,{...mark,opacity:0},area);
      const empty=await renderWatermark({...mark,text:' \n\t'},area);
      const e=document.createElement('canvas');e.width=empty.width;e.height=empty.height;e.getContext('2d')!.drawImage(empty,0,0);
      bitmap.close();empty.close();
      return { out, zero:bounds(zero).max, empty:bounds(e).max };
    }, { area, dpr });
    expect(result.zero).toBe(0);expect(result.empty).toBe(0);
    for (const r of result.out) { expect(r.max).toBeGreaterThanOrEqual(127);expect(r.max).toBeLessThanOrEqual(128);expect(r.error).toBeLessThanOrEqual(1); }
    await context.close();
  });
}

test('preview caches the viewport source across position changes and disposes ownership', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path='/src/lib/editor/preview.ts';const { createPreviewCache, drawPreview }=await import(/* @vite-ignore */ path);
    const wp='/src/lib/editor/watermark.ts';const { renderWatermark }=await import(/* @vite-ignore */ wp);
    const source=document.createElement('canvas');source.width=2400;source.height=3200;
    source.getContext('2d')!.fillRect(0,0,2400,3200);
    const image={ kind:'image',source,size:{width:2400,height:3200},resized:false,dispose() {} };
    const viewport={width:320,height:400};
    const cache=await createPreviewCache(image,viewport,2);
    const mark={text:'For verification only',fontFamily:'Geist',sizeRatio:.05,x:.5,y:.5,angle:45,opacity:.5,color:'#f00'};
    const bitmap=await renderWatermark(mark,image.size);
    const output=document.createElement('canvas');output.width=640;output.height=800;
    // Mutate original after cache creation: cached source must remain unchanged.
    source.getContext('2d')!.clearRect(0,0,2400,3200);
    for(let i=0;i<10;i++) drawPreview(output.getContext('2d')!,cache,bitmap,{...mark,x:i/10});
    const pixel=Array.from(output.getContext('2d')!.getImageData(320,100,1,1).data);
    const size={width:cache.source.width,height:cache.source.height};
    bitmap.close();cache.dispose();cache.dispose();
    let released=false;try { drawPreview(output.getContext('2d')!,cache,bitmap,mark); } catch { released=true; }
    return {size,pixel,released};
  });
  expect(result.size.width).toBeLessThanOrEqual(640);expect(result.size.height).toBeLessThanOrEqual(800);
  expect(result.pixel).toEqual([0,0,0,255]);expect(result.released).toBe(true);
});

test('clockwise rotation and center are applied once with context state restored', async ({ page }) => {
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const path='/src/lib/editor/watermark.ts';const { composeWatermark }=await import(/* @vite-ignore */ path);
    const asset=document.createElement('canvas');asset.width=20;asset.height=10;
    asset.getContext('2d')!.fillRect(15,0,5,5);const bitmap=await createImageBitmap(asset);
    const c=document.createElement('canvas');c.width=100;c.height=100;const ctx=c.getContext('2d')!;
    ctx.globalAlpha=.8;
    composeWatermark(ctx,bitmap,{text:'',fontFamily:'Geist',sizeRatio:.1,x:.5,y:.5,angle:90,opacity:1,color:'#000'},{width:100,height:100});
    const alpha=(x:number,y:number)=>ctx.getImageData(x,y,1,1).data[3];
    const result={clockwise:alpha(52,57),wrong:alpha(47,42),alpha:ctx.globalAlpha,transform:ctx.getTransform().isIdentity};bitmap.close();return result;
  });
  expect(result.clockwise).toBe(255);expect(result.wrong).toBe(0);expect(result.alpha).toBe(.8);expect(result.transform).toBe(true);
});

test('unknown and failed registered fonts fail explicitly instead of silently falling back', async ({ page }) => {
  await page.goto('/');
  const errors = await page.evaluate(async () => {
    const path='/src/lib/editor/watermark.ts';const { requireFont }=await import(/* @vite-ignore */ path);
    const failed=new FontFace('BrokenLocal', 'url(/missing-local-font.woff2)');document.fonts.add(failed);
    const errors=[];
    for(const family of ['NoRegisteredFont','BrokenLocal']) {
      try { await requireFont(family,32,'For verification only');errors.push('no error'); } catch(e) { errors.push((e as Error).message); }
    }
    return errors;
  });
  expect(errors).toEqual(['Watermark font could not be loaded.','Watermark font could not be loaded.']);
});

test('renderer produces bounded multiline glyphs using loaded local Geist', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/lib/editor/watermark.ts';
    const { renderWatermark } = await import(/* @vite-ignore */ path);
    const mark = { text: 'Ágj\nFor verification only', fontFamily: 'Geist', sizeRatio: .08, x: .5, y: .5, angle: 45, opacity: 0, color: '#ff0000' };
    const bitmap = await renderWatermark(mark, { width: 600, height: 400 });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1, maxAlpha = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha) { minX = Math.min(minX,x); maxX = Math.max(maxX,x); minY = Math.min(minY,y); maxY = Math.max(maxY,y); maxAlpha = Math.max(maxAlpha,alpha); }
    }
    const faces = await document.fonts.load('32px Geist', mark.text);
    bitmap.close();
    return { width: canvas.width, height: canvas.height, minX, minY, maxX, maxY, maxAlpha, loaded: faces.length > 0 && faces.every(face => face.status === 'loaded' && face.family.replaceAll('"','') === 'Geist') };
  });
  expect(result.loaded).toBe(true);
  expect(result.width).toBeGreaterThan(result.height);
  expect(result.height).toBeGreaterThan(32);
  expect(result.minX).toBeGreaterThanOrEqual(1);
  expect(result.minY).toBeGreaterThanOrEqual(1);
  expect(result.maxX).toBeLessThan(result.width - 1);
  expect(result.maxY).toBeLessThan(result.height - 1);
  expect(result.maxAlpha).toBe(255); // opacity/rotation are composition-only
});

test('reviewable deterministic local-font fixture uses Canvas fallback', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    Object.defineProperty(window, 'OffscreenCanvas', { value: undefined, configurable: true });
    const path='/src/lib/editor/watermark.ts';const {renderWatermark,composeWatermark}=await import(/* @vite-ignore */ path);
    const mark={text:'Ágj\nFor verification only',fontFamily:'Geist',sizeRatio:.09,x:.5,y:.5,angle:45,opacity:.5,color:'#059669'};
    const bitmap=await renderWatermark(mark,{width:600,height:400});
    const c=document.createElement('canvas');c.width=600;c.height=400;
    c.setAttribute('data-fixture','renderer');
    const ctx=c.getContext('2d')!;ctx.fillStyle='#fafafa';ctx.fillRect(0,0,600,400);
    composeWatermark(ctx,bitmap,mark,{width:600,height:400});document.body.replaceChildren(c);
    const width=bitmap.width,height=bitmap.height;bitmap.close();return {width,height};
  });
  expect(result.width).toBeGreaterThan(100);expect(result.height).toBeGreaterThan(40);
  await page.locator('[data-fixture="renderer"]').screenshot({ path: 'test-results/renderer-local-geist.png' });
});
