import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Tiled hides selection while Size changes pixels and Single retains placement', async ({page}) => {
  await page.goto('/');await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  await page.getByLabel('Watermark text').fill('Tiles');
  await page.getByRole('button',{name:'Bottom right',exact:true}).click();
  const selection=page.locator('.watermark-selection');await expect(selection).toBeVisible();
  const position=()=>selection.evaluate(n=>({x:(n as HTMLElement).style.left,y:(n as HTMLElement).style.top}));
  const before=await position();
  const hint=page.getByText('Drag the watermark to move it; drag a corner to resize. Or use Position and Size below.',{exact:true});
  await expect(hint).toBeVisible();
  const canvas=page.getByLabel('Image preview');
  const pixels=()=>canvas.evaluate(n=>(n as HTMLCanvasElement).toDataURL());
  const singlePixels=await pixels();
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  await expect(selection).toHaveCount(0);
  await expect(page.locator('.resize-handle')).toHaveCount(0);
  await expect(page.getByRole('group',{name:'Position',exact:true})).toHaveCount(0);
  await expect(hint).toHaveCount(0);
  await expect(page.getByText('Resize a tile with a corner, or use Size.',{exact:true})).toHaveCount(0);
  // Await the real tiled render, not the source-only frame while its bitmap loads.
  await expect.poll(pixels).not.toBe(singlePixels);
  const tiledPixels=await pixels();
  const slider=page.getByRole('slider',{name:'Size',exact:true});
  await slider.evaluate(n=>{(n as HTMLInputElement).value='10';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.getByLabel('Size',{exact:true})).toHaveValue('10');
  await expect.poll(pixels).not.toBe(tiledPixels);
  await expect(selection).toHaveCount(0);
  await page.getByRole('button',{name:'Single',exact:true}).click();
  await expect(selection).toBeVisible();
  await expect(page.locator('.resize-handle')).toHaveCount(4);
  await expect(page.getByRole('group',{name:'Position',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Bottom right',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await position()).toEqual(before);
  await expect(hint).toBeVisible();
});

for (const width of [320, 390, 1280]) test(`Watermark layout fills the form above text at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  const group = page.getByRole('group', { name: 'Watermark layout', exact: true });
  const single = group.getByRole('button', { name: 'Single', exact: true });
  const tiled = group.getByRole('button', { name: 'Tiled', exact: true });
  const text = page.getByLabel('Watermark text');
  const helper = page.getByText('Tiled covers the whole page. Position does not apply.', { exact: true });
  for (const mode of ['single', 'tiled', 'single']) {
    await (mode === 'single' ? single : tiled).click();
    await expect(single).toHaveAttribute('aria-pressed', String(mode === 'single'));
    await expect(tiled).toHaveAttribute('aria-pressed', String(mode === 'tiled'));
    await expect(helper).toHaveCount(0);
    await expect(page.locator('.watermark-selection')).toHaveCount(mode === 'single' ? 1 : 0);
    const [g, s, t, input] = await Promise.all([group.boundingBox(), single.boundingBox(), tiled.boundingBox(), text.boundingBox()]);
    expect(g!.y + g!.height).toBeLessThanOrEqual(input!.y);
    expect(g!.x).toBeCloseTo(input!.x, 1);
    expect(g!.width).toBeCloseTo(input!.width, 1);
    expect(s!.width).toBeCloseTo(t!.width, 1);
    expect(s!.x).toBeCloseTo(g!.x, 1);
    expect(t!.x + t!.width).toBeCloseTo(g!.x + g!.width, 1);
    expect(s!.y).toBeCloseTo(t!.y, 1);
    expect(s!.height).toBeCloseTo(t!.height, 1);
    expect(s!.height).toBeGreaterThanOrEqual(44);
    console.log('Watermark layout bounds', JSON.stringify({ width, mode, group: g, single: s, tiled: t, textarea: input }));
  }
});

for(const angle of [0,45,-45,90]) test(`actual tiled Canvas pixels and image export oracle ${angle}`,async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async angle=>{
    const {renderWatermark,composeWatermark}=await import(String('/src/lib/editor/watermark.ts'));
    const {exportImage}=await import(String('/src/lib/image/export.ts'));
    const {createPreviewCache,drawPreview}=await import(String('/src/lib/editor/preview.ts'));
    const out=[];
    for(const text of ['I','A long verification watermark','Ágj\nSecond line']){
      const area={width:600,height:400};const source=document.createElement('canvas');source.width=600;source.height=400;source.getContext('2d')!.fillStyle='#fff';source.getContext('2d')!.fillRect(0,0,600,400);
      const mark={text,mode:'tiled',sizeRatio:.05,x:.17,y:.83,angle,opacity:.7,color:'#ff0000'};
      const bitmap=await renderWatermark(mark,area);
      const actual=document.createElement('canvas');actual.width=600;actual.height=400;const a=actual.getContext('2d')!;a.drawImage(source,0,0);composeWatermark(a,bitmap,mark,area);
      // Independent finite oracle: centered rectangular grid; no production centers helper.
      const expected=document.createElement('canvas');expected.width=600;expected.height=400;const e=expected.getContext('2d')!;e.drawImage(source,0,0);e.globalAlpha=.7;
      const scale=400/1600,w=bitmap.width*scale,h=bitmap.height*scale;
      const t=angle*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
      for(let j=-80;j<=80;j++)for(let i=-80;i<=80;i++){const x=i*w*1.25,y=j*h*1.75;e.save();e.translate(300+x*c-y*s,200+x*s+y*c);e.rotate(t);e.drawImage(bitmap,-w/2,-h/2,w,h);e.restore();}
      const ap=a.getImageData(0,0,600,400).data,ep=e.getImageData(0,0,600,400).data;
      let max=0,ink=0;for(let i=0;i<ap.length;i++){max=Math.max(max,Math.abs(ap[i]-ep[i]));if(i%4===1 && ap[i]<230)ink++;}
      const image={kind:'image',source,size:area,dispose(){}};
      const cache=await createPreviewCache(image,area,1);drawPreview(a,cache,bitmap,mark);cache.dispose();
      const preview=a.getImageData(0,0,600,400).data;let previewMax=0;for(let i=0;i<preview.length;i++)previewMax=Math.max(previewMax,Math.abs(preview[i]-ep[i]));
      const saved=await exportImage(image,mark);
      const encoded=await new Promise<Blob>(resolve=>expected.toBlob(b=>resolve(b!),'image/jpeg',.92));
      async function pixels(blob:Blob){const b=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d')!.drawImage(b,0,0);b.close();return c.getContext('2d')!.getImageData(0,0,600,400).data;}
      const sp=await pixels(saved.blob),op=await pixels(encoded);let exportMax=0;for(let i=0;i<sp.length;i++)exportMax=Math.max(exportMax,Math.abs(sp[i]-op[i]));
      out.push({text,max,previewMax,ink,exportMax});saved.dispose();bitmap.close();
    }return out;
  },angle);
  for(const r of results){expect(r.max,JSON.stringify(r)).toBeLessThanOrEqual(1);expect(r.previewMax,JSON.stringify(r)).toBeLessThanOrEqual(1);expect(r.exportMax,JSON.stringify(r)).toBeLessThanOrEqual(2);expect(r.ink).toBeGreaterThan(100);}
});

test('Tiled PDF rotated/cropped export raster matches preview at different resolutions',async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const {loadPdf}=await import(String('/src/lib/pdf/load.ts'));const {previewPdf}=await import(String('/src/lib/pdf/preview.ts'));const {exportPdf}=await import(String('/src/lib/pdf/export.ts'));const {renderWatermark,composeWatermark}=await import(String('/src/lib/editor/watermark.ts'));
    const pdf=await loadPdf(new File([await (await fetch('/tests/fixtures/pdf/rotated-crop.pdf')).arrayBuffer()],'x.pdf'));
    const out=[];
    for(const angle of [0,45,-45,90]) for(const text of ['I','A long verification watermark','Ágj\nVerification']){
      const mark={text,mode:'tiled',sizeRatio:.05,x:.1,y:.9,angle,opacity:.7,color:'#ff0000'};
      const saved=await exportPdf(pdf,mark);
      for(let index=0;index<pdf.pageCount;index++){
        const source=await previewPdf(pdf,index,{width:420,height:560}),actual=await previewPdf(saved.pdf,index,{width:420,height:560});
        const c=document.createElement('canvas');c.width=Math.ceil(source.size.width);c.height=Math.ceil(source.size.height);const ctx=c.getContext('2d')!;ctx.drawImage(source.source,0,0);
        const bitmap=await renderWatermark(mark,source.size);composeWatermark(ctx,bitmap,mark,source.size);bitmap.close();const expected=ctx.getImageData(0,0,c.width,c.height).data;
        ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(actual.source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
        let error=0,ink=0,overlap=0;for(let i=0;i<pixels.length;i+=4){error+=Math.abs(pixels[i+1]-expected[i+1]);if(expected[i]>expected[i+1]+30){ink++;if(pixels[i]>pixels[i+1]+20)overlap++;}}
        out.push({angle,text,index,error:error/(pixels.length/4),overlap:overlap/ink,ink});source.dispose();actual.dispose();
      }saved.dispose();
    }pdf.dispose();return out;
  });
  console.log('PDF tiled raster summary',JSON.stringify({cases:results.length,maxMeanError:Math.max(...results.map(r=>r.error)),minInkOverlap:Math.min(...results.map(r=>r.overlap))}));
  // PDF.js vs Canvas interpolation differs most for densely repeated narrow I strokes.
  // Allow <3% mean channel error but require at least 85% ink-position overlap.
  for(const r of results){expect(r.ink).toBeGreaterThan(100);expect(r.error,JSON.stringify(r)).toBeLessThan(7);expect(r.overlap,JSON.stringify(r)).toBeGreaterThan(.85);}
});

test('inspectable real editor Tiled at 45 degrees',async({page})=>{
  await page.goto('/');await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');await page.getByLabel('Watermark text').fill('For verification only');
  await page.getByLabel('Angle',{exact:true}).fill('45');await page.getByLabel('Angle',{exact:true}).press('Enter');await page.getByRole('button',{name:'Tiled',exact:true}).click();await expect(page.locator('.watermark-selection')).toHaveCount(0);
  await page.screenshot({path:join(tmpdir(),'markid-tiled-45-after.png'),fullPage:true});
});
