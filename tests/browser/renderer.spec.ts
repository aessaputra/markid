import { test, expect } from '@playwright/test';

for (const dpr of [1, 2]) for (const area of [{ width: 600, height: 400 }, { width: 400, height: 600 }, { width: 400, height: 400 }]) {
  test(`composition parity, single opacity and clockwise rotation ${area.width}x${area.height} DPR ${dpr}`, async ({ browser }) => {
    const context = await browser.newContext({ deviceScaleFactor: dpr });
    const page = await context.newPage();
    await page.goto('/');
    const result = await page.evaluate(async ({ area, dpr }) => {
      const path = '/src/lib/editor/watermark.ts';
      const { renderWatermark, composeWatermark } = await import(/* @vite-ignore */ path);
      const mark = { text: 'Ágj\nFor verification only', sizeRatio: .08, x: .53, y: .41, angle: 0, opacity: .5, color: '#ff0000' };
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

test('source-only preview clears previous watermark and letterbox pixels', async ({page}) => {
 await page.goto('/');
 const pixels=await page.evaluate(async()=>{
  const {createPreviewCache,drawPreview}=await import(String('/src/lib/editor/preview.ts'));
  const source=document.createElement('canvas');source.width=240;source.height=160;
  const s=source.getContext('2d')!;s.fillStyle='#0000ff';s.fillRect(0,0,240,160);
  const cache=await createPreviewCache({kind:'image',source,size:{width:240,height:160},dispose(){}},{width:240,height:240});
  const out=document.createElement('canvas');out.width=out.height=240;
  const ctx=out.getContext('2d')!;ctx.fillStyle='#ff0000';ctx.fillRect(0,0,240,240);
  try {
   drawPreview(ctx,cache,null,{text:'pending',sizeRatio:.1,x:.5,y:.5,angle:0,opacity:1,color:'#ff0000'});
   return {source:Array.from(ctx.getImageData(120,120,1,1).data),letterbox:Array.from(ctx.getImageData(120,10,1,1).data)};
  } finally {cache.dispose();}
 });
 expect(pixels).toEqual({source:[0,0,255,255],letterbox:[0,0,0,0]});
});

// The oracle composes in image space without either production composition/geometry
// helper, then projects that raster into a centered contain rectangle. Transparent
// sources isolate watermark ink from cache pixels, including in the letterbox.
for (const dpr of [1, 2]) for (const { area, viewport } of [
  { area: { width: 600, height: 400 }, viewport: { width: 317, height: 439 } },
  { area: { width: 400, height: 600 }, viewport: { width: 463, height: 281 } },
]) {
  test(`actual preview helper parity ${area.width}x${area.height} in ${viewport.width}x${viewport.height} DPR ${dpr}`, async ({ browser }) => {
    const context = await browser.newContext({ deviceScaleFactor: dpr });
    try {
      const page = await context.newPage();
      await page.goto('/');
      const results = await page.evaluate(async ({ area, viewport, dpr }) => {
        const pp = '/src/lib/editor/preview.ts';
        const { createPreviewCache, drawPreview } = await import(/* @vite-ignore */ pp);
        const wp = '/src/lib/editor/watermark.ts';
        const { renderWatermark } = await import(/* @vite-ignore */ wp);
        const source = document.createElement('canvas');
        source.width = area.width; source.height = area.height;
        source.getContext('2d')!; // Initialize a transparent, orientation-normalized source.
        const cache = await createPreviewCache({ kind: 'image', source, size: area, dispose() {} }, viewport, dpr);
        const mark = { text: 'Ágj\nFor verification only', sizeRatio: .08, x: .27, y: .71, angle: 0, opacity: .5, color: '#ff0000' };
        const bitmap = await renderWatermark(mark, area);
        const scale = Math.min(viewport.width / area.width, viewport.height / area.height);
        const offsetX = (viewport.width - area.width * scale) / 2;
        const offsetY = (viewport.height - area.height * scale) / 2;
        function measure(canvas: HTMLCanvasElement) {
          const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
          let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
          let weight = 0, sumX = 0, sumY = 0, letterboxAlpha = 0;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const alpha = pixels[(y * canvas.width + x) * 4 + 3];
            // Compare visible ink, excluding sub-8/255 resampling fringe.
            if (alpha >= 8) {
              left = Math.min(left, x); right = Math.max(right, x + 1);
              top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
              weight += alpha; sumX += (x + .5) * alpha; sumY += (y + .5) * alpha;
            }
            // Only whole pixels outside the fractional contain rect are letterbox.
            if (x + 1 <= offsetX * dpr || x >= (offsetX + area.width * scale) * dpr ||
                y + 1 <= offsetY * dpr || y >= (offsetY + area.height * scale) * dpr) {
              letterboxAlpha = Math.max(letterboxAlpha, alpha);
            }
          }
          return { bounds: [left, right, top, bottom].map(v => v / dpr),
            center: [sumX / weight / dpr, sumY / weight / dpr], weight, letterboxAlpha };
        }
        const results = [];
        try {
          for (const angle of [-180, 0, 45, 180]) for (const position of [
            { x: .27, y: .71 }, { x: 0, y: .23 }, { x: 1, y: .79 },
          ]) {
            const current = { ...mark, ...position, angle };
            const full = document.createElement('canvas');
            full.width = area.width; full.height = area.height;
            const fullCtx = full.getContext('2d')!;
            // Independent composition; canvas image bounds provide export clipping.
            fullCtx.globalAlpha = current.opacity;
            fullCtx.translate(current.x * area.width, current.y * area.height);
            fullCtx.rotate(current.angle * Math.PI / 180);
            fullCtx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
            const expected = document.createElement('canvas');
            expected.width = viewport.width * dpr; expected.height = viewport.height * dpr;
            expected.getContext('2d')!.drawImage(full, offsetX * dpr, offsetY * dpr,
              area.width * scale * dpr, area.height * scale * dpr);
            const actual = document.createElement('canvas');
            actual.width = expected.width; actual.height = expected.height;
            drawPreview(actual.getContext('2d')!, cache, bitmap, current);
            results.push({ angle, position, actual: measure(actual), expected: measure(expected),
              imageEdges: [offsetX, offsetX + area.width * scale] });
          }
        } finally { bitmap.close(); cache.dispose(); }
        return results;
      }, { area, viewport, dpr });
      for (const result of results) {
        const label = `angle=${result.angle}, position=${JSON.stringify(result.position)}`;
        expect(result.actual.weight, label).toBeGreaterThan(0);
        expect(result.expected.weight, label).toBeGreaterThan(0);
        expect(result.actual.letterboxAlpha, label).toBe(0);
        for (const key of ['bounds', 'center'] as const) {
          result.expected[key].forEach((value, i) => {
            expect(Math.abs(result.actual[key][i] - value), `${label} ${key}[${i}] CSSpx`).toBeLessThanOrEqual(1);
          });
        }
        // Edge positions really exercise clipping rather than merely testing a
        // centered mark that never reaches the contain/image boundary.
        if (result.position.x === 0 || result.position.x === 1) {
          const edge = result.position.x === 0 ? 0 : 1;
          expect(Math.abs(result.expected.bounds[edge] - result.imageEdges[edge]), `${label} clipped edge`).toBeLessThanOrEqual(1);
        }
      }
    } finally { await context.close(); }
  });
}

test('preview caches the viewport source across position changes and disposes ownership', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path='/src/lib/editor/preview.ts';const { createPreviewCache, drawPreview }=await import(/* @vite-ignore */ path);
    const wp='/src/lib/editor/watermark.ts';const { renderWatermark }=await import(/* @vite-ignore */ wp);
    const source=document.createElement('canvas');source.width=2400;source.height=3200;
    source.getContext('2d')!.fillRect(0,0,2400,3200);
    const image={ kind:'image',source,size:{width:2400,height:3200},dispose() {} };
    const viewport={width:320,height:400};
    const cache=await createPreviewCache(image,viewport,2);
    const mark={text:'For verification only',sizeRatio:.05,x:.5,y:.5,angle:45,opacity:.5,color:'#f00'};
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
    composeWatermark(ctx,bitmap,{text:'',sizeRatio:.1,x:.5,y:.5,angle:90,opacity:1,color:'#000'},{width:100,height:100});
    const alpha=(x:number,y:number)=>ctx.getImageData(x,y,1,1).data[3];
    const result={clockwise:alpha(52,57),wrong:alpha(47,42),alpha:ctx.globalAlpha,transform:ctx.getTransform().isIdentity};bitmap.close();return result;
  });
  expect(result.clockwise).toBe(255);expect(result.wrong).toBe(0);expect(result.alpha).toBe(.8);expect(result.transform).toBe(true);
});

test('system font resolves identically on main thread and in a worker canvas', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/lib/editor/watermark.ts';
    const { SYSTEM_FONT } = await import(/* @vite-ignore */ path);
    const stack = `32px ${SYSTEM_FONT}`;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = stack;
    const main = { font: ctx.font, width: ctx.measureText('For verification only').width };
    const worker = await new Promise((resolve, reject) => {
      const w = new Worker(URL.createObjectURL(new Blob([`const c=new OffscreenCanvas(64,64);const x=c.getContext('2d');x.font=${JSON.stringify(stack)};const m=x.measureText('For verification only');postMessage({font:x.font,width:m.width});`], { type: 'text/javascript' })));
      w.onmessage = ({ data }: MessageEvent) => { w.terminate(); resolve(data); };
      w.onerror = (e) => { w.terminate(); reject(new Error(e.message)); };
    });
    return { stack: SYSTEM_FONT, main, worker };
  });
  expect(result.stack).toBe('system-ui, sans-serif');
  expect(result.main.width).toBeGreaterThan(0);
  expect(result.worker).toEqual(result.main);
});

test('renderer produces bounded multiline glyphs with the shared system font', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/lib/editor/watermark.ts';
    const { renderWatermark } = await import(/* @vite-ignore */ path);
    const mark = { text: 'Ágj\nFor verification only', sizeRatio: .08, x: .5, y: .5, angle: 45, opacity: 0, color: '#ff0000' };
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
    bitmap.close();
    return { width: canvas.width, height: canvas.height, minX, minY, maxX, maxY, maxAlpha };
  });
  expect(result.width).toBeGreaterThan(result.height);
  expect(result.height).toBeGreaterThan(32);
  expect(result.minX).toBeGreaterThanOrEqual(1);
  expect(result.minY).toBeGreaterThanOrEqual(1);
  expect(result.maxX).toBeLessThan(result.width - 1);
  expect(result.maxY).toBeLessThan(result.height - 1);
  expect(result.maxAlpha).toBe(255); // opacity/rotation are composition-only
});

test('reviewable deterministic system-font fixture uses Canvas fallback', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    Object.defineProperty(window, 'OffscreenCanvas', { value: undefined, configurable: true });
    const path='/src/lib/editor/watermark.ts';const {renderWatermark,composeWatermark}=await import(/* @vite-ignore */ path);
    const mark={text:'Ágj\nFor verification only',sizeRatio:.09,x:.5,y:.5,angle:45,opacity:.5,color:'#059669'};
    const bitmap=await renderWatermark(mark,{width:600,height:400});
    const c=document.createElement('canvas');c.width=600;c.height=400;
    c.setAttribute('data-fixture','renderer');
    const ctx=c.getContext('2d')!;ctx.fillStyle='#fafafa';ctx.fillRect(0,0,600,400);
    composeWatermark(ctx,bitmap,mark,{width:600,height:400});document.body.replaceChildren(c);
    const width=bitmap.width,height=bitmap.height;bitmap.close();return {width,height};
  });
  expect(result.width).toBeGreaterThan(100);expect(result.height).toBeGreaterThan(40);
  await page.locator('[data-fixture="renderer"]').screenshot({ path: 'test-results/renderer-system-font.png' });
});
