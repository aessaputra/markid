import type {LoadedPdf,Watermark} from '../../src/lib/editor/types';
import type {ExportRequest,ExportResponse} from '../../src/lib/image/export.worker';
type GapWindow=Window & {gapReplies:Array<{blob:Blob;mark:Watermark}>};
import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function precisePreview(page: Page) {
  return page.getByLabel('Image preview').evaluate(async node => {
    const {loadSource}=await import(String('/src/lib/input/load.ts'));
    const {renderWatermark}=await import(String('/src/lib/editor/watermark.ts')) as typeof import('../../src/lib/editor/watermark');
    const {createPreviewCache,drawPreview}=await import(String('/src/lib/editor/preview.ts'));
    const source=await loadSource(new File([await (await fetch('/tests/fixtures/images/exif-6.png')).arrayBuffer()],'x.png'));
    const canvas=node as HTMLCanvasElement;
    const viewport={width:canvas.getBoundingClientRect().width,height:canvas.getBoundingClientRect().height};
    const mark={text:(document.querySelector('#text') as HTMLTextAreaElement).value,mode:'tiled' as const,sizeRatio:.05,x:.5,y:.5,angle:-45,opacity:.3,color:'#888888',gapX:37,gapY:123};
    const bitmap=await renderWatermark(mark,source.size);
    const cache=await createPreviewCache(source,viewport,devicePixelRatio);
    const expected=document.createElement('canvas');expected.width=canvas.width;expected.height=canvas.height;
    drawPreview(expected.getContext('2d')!,cache,bitmap,mark);
    const actual=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
    const pixels=expected.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
    let error=0;for(let i=0;i<pixels.length;i++)error=Math.max(error,Math.abs(actual[i]-pixels[i]));
    bitmap.close();cache.dispose();source.dispose();return error;
  });
}

test('gap controls retain precise values across modes and reset defaults', async ({page}) => {
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message, ...args) {
      if (message?.mark) (window as unknown as {exportMark: unknown}).exportMark = message.mark;
      return Reflect.apply(post, this, [message, ...args]);
    };
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  const x=page.getByRole('slider',{name:'Horizontal gap',exact:true});
  const y=page.getByRole('slider',{name:'Vertical gap',exact:true});
  await expect(x).toHaveCount(0);await expect(y).toHaveCount(0);
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  for(const [slider,value] of [[x,'25'],[y,'75']] as const){
    await expect(slider).toHaveValue(value);
    await expect(slider).toHaveAttribute('min','0');
    await expect(slider).toHaveAttribute('max','200');
    await expect(slider).toHaveAttribute('step','5');
  }
  const xn=page.getByRole('spinbutton',{name:'Horizontal gap value',exact:true});
  const yn=page.getByRole('spinbutton',{name:'Vertical gap value',exact:true});
  await xn.fill('37');await xn.press('Enter');await yn.fill('123');await yn.press('Enter');
  await expect(xn).toHaveValue('37');await expect(yn).toHaveValue('123');
  // Native range inputs sanitize off-tick values; only the displayed tick is rounded.
  await expect(x).toHaveValue('35');await expect(y).toHaveValue('125');

  await expect.poll(() => precisePreview(page)).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as {exportMark: unknown}).exportMark)).toMatchObject({gapX:37,gapY:123});
  await page.getByRole('button',{name:'Back to edit',exact:true}).click();
  await expect(xn).toHaveValue('37');await expect(yn).toHaveValue('123');
  await page.getByRole('button',{name:'Single',exact:true}).click();await expect(x).toHaveCount(0);
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  await expect(xn).toHaveValue('37');await expect(yn).toHaveValue('123');
  await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(x).toHaveCount(0);
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  await expect(x).toHaveValue('25');await expect(y).toHaveValue('75');
  await expect(page.locator('.watermark-selection')).toHaveCount(0);
});

test('gap sliders use five-point arrows while numeric commits clamp integer percentages', async ({page}) => {
  await page.goto('/');await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  await page.getByRole('button',{name:'Tiled',exact:true}).click();
  for(const name of ['Size','Opacity','Angle']) await expect(page.getByRole('slider',{name,exact:true})).toHaveAttribute('step','1');
  for(const name of ['Horizontal gap','Vertical gap']) {
    const slider=page.getByRole('slider',{name,exact:true});
    const number=page.getByRole('spinbutton',{name:`${name} value`,exact:true});
    await expect(number).toHaveAttribute('step','1');
    const initial=Number(await slider.inputValue());
    await slider.focus();await slider.press('ArrowRight');
    await expect(slider).toHaveValue(String(initial+5));await expect(number).toHaveValue(String(initial+5));
    for(const [typed,value] of [['0','0'],['200','200'],['-10','0'],['250','200'],['37.4','37']] as const) {
      await number.fill(typed);await number.press('Enter');await expect(number).toHaveValue(value);
    }
    await number.fill('123');await number.press('Tab');await expect(number).toHaveValue('123');
  }
});

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
  await expect(hint).toBeHidden();
  await expect(hint).toHaveAttribute('aria-hidden','true');
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
    if (mode === 'tiled') {
      const gaps = page.locator('#gap-x, #gap-y');
      const [x,y] = await Promise.all([gaps.nth(0).boundingBox(),gaps.nth(1).boundingBox()]);
      const angle = await page.getByRole('slider',{name:'Angle',exact:true}).boundingBox();
      expect(x!.y).toBeGreaterThanOrEqual(angle!.y + angle!.height);
      if (width < 420) {
        expect(y!.y).toBeGreaterThanOrEqual(x!.y + x!.height);
        expect(x!.x).toBeCloseTo(y!.x,1);
      } else {
        expect(x!.y).toBeCloseTo(y!.y,1);
        expect(y!.x).toBeGreaterThan(x!.x + x!.width);
      }
      for (const id of ['gap-x-number','gap-y-number']) {
        const wrapper=page.locator(`#${id}`).locator('..');
        const bounds=await wrapper.boundingBox();
        expect(bounds!.height).toBe(44);
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      console.log('Gap bounds',JSON.stringify({width,x,y}));
    } else await expect(page.getByRole('slider',{name:'Horizontal gap',exact:true})).toHaveCount(0);
    console.log('Watermark layout bounds', JSON.stringify({ width, mode, group: g, single: s, tiled: t, textarea: input }));
  }
});

for(const angle of [0,45,-45,90]) test(`actual tiled Canvas pixels and image export oracle ${angle}`,async({page})=>{
  await page.goto('/');
  const results=await page.evaluate(async angle=>{
    const {renderWatermark,composeWatermark}=await import(String('/src/lib/editor/watermark.ts')) as typeof import('../../src/lib/editor/watermark');
    const {exportImage}=await import(String('/src/lib/image/export.ts'));
    const {createPreviewCache,drawPreview}=await import(String('/src/lib/editor/preview.ts'));
    const out=[];
    for(const text of ['I','A long verification watermark','Ágj\nSecond line']) for(const [gapX,gapY] of [[0,0],[25,75],[37,123],[200,200]]){
      const area={width:400,height:400};const source=document.createElement('canvas');source.width=400;source.height=400;source.getContext('2d')!.fillStyle='#fff';source.getContext('2d')!.fillRect(0,0,400,400);
      const mark={text,mode:'tiled' as const,sizeRatio:.05,x:.17,y:.83,angle,opacity:.7,color:'#ff0000',gapX,gapY};
      const bitmap=await renderWatermark(mark,area);
      const actual=document.createElement('canvas');actual.width=400;actual.height=400;const a=actual.getContext('2d')!;a.drawImage(source,0,0);composeWatermark(a,bitmap,mark,area);
      // Independent finite oracle: centered rectangular grid; no production centers helper.
      const expected=document.createElement('canvas');expected.width=400;expected.height=400;const e=expected.getContext('2d')!;e.drawImage(source,0,0);e.globalAlpha=.7;
      // Square source keeps even zero-gap I below the existing candidate safety budget.
      // The former 600x400 case exceeded it (5509 candidates at 45deg).
      const scale=400/1600,w=bitmap.width*scale,h=bitmap.height*scale;
      const t=angle*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
      const sx=w*(1+gapX/100),sy=h*(1+gapY/100);
      const hx=Math.abs(c)*w/2+Math.abs(s)*h/2,hy=Math.abs(s)*w/2+Math.abs(c)*h/2;
      const reachX=Math.ceil((Math.abs(c)*(200+hx)+Math.abs(s)*(200+hy))/sx);
      const reachY=Math.ceil((Math.abs(s)*(200+hx)+Math.abs(c)*(200+hy))/sy);
      const candidates=(2*Math.floor((Math.abs(c)*(200+hx)+Math.abs(s)*(200+hy))/sx)+1)*(2*Math.floor((Math.abs(s)*(200+hx)+Math.abs(c)*(200+hy))/sy)+1);
      let placements=0;
      for(let j=-80;j<=80;j++)for(let i=-80;i<=80;i++){const x=i*sx,y=j*sy;const px=200+x*c-y*s,py=200+x*s+y*c;if(px+hx>=0 && px-hx<=400 && py+hy>=0 && py-hy<=400)placements++;e.save();e.translate(200+x*c-y*s,200+x*s+y*c);e.rotate(t);e.drawImage(bitmap,-w/2,-h/2,w,h);e.restore();}
      const ap=a.getImageData(0,0,400,400).data,ep=e.getImageData(0,0,400,400).data;
      let max=0,ink=0;for(let i=0;i<ap.length;i++){max=Math.max(max,Math.abs(ap[i]-ep[i]));if(i%4===1 && ap[i]<230)ink++;}
      const image={kind:'image',source,size:area,dispose(){}};
      const cache=await createPreviewCache(image,area,1);drawPreview(a,cache,bitmap,mark);cache.dispose();
      const preview=a.getImageData(0,0,400,400).data;let previewMax=0;for(let i=0;i<preview.length;i++)previewMax=Math.max(previewMax,Math.abs(preview[i]-ep[i]));
      let reply:Blob|undefined,htmlEncodes=0;
      const post=Worker.prototype.postMessage,nativeEncode=HTMLCanvasElement.prototype.toBlob;
      Worker.prototype.postMessage=function(message:ExportRequest,...args:[(Transferable[] | StructuredSerializeOptions)?]){this.addEventListener('message',({data}:MessageEvent<ExportResponse>)=>{if(data.id===message.id && data.revision===message.revision && 'blob' in data)reply=data.blob;});return Reflect.apply(post,this,[message,...args]);};
      HTMLCanvasElement.prototype.toBlob=function(...args){htmlEncodes++;return nativeEncode.apply(this,args);};
      let saved;try{saved=await exportImage(image,mark);}finally{Worker.prototype.postMessage=post;HTMLCanvasElement.prototype.toBlob=nativeEncode;}
      const savedBytes=new Uint8Array(await saved.blob.arrayBuffer());
      const replyBytes=reply?new Uint8Array(await reply.arrayBuffer()):new Uint8Array();
      const workerSame=replyBytes.length===savedBytes.length && replyBytes.every((v,i)=>v===savedBytes[i]);
      const main=await exportImage(image,mark,{forceMain:true});
      const encoded=await new Promise<Blob>(resolve=>expected.toBlob(b=>resolve(b!),'image/jpeg',.92));
      async function pixels(blob:Blob){const b=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d')!.drawImage(b,0,0);b.close();return c.getContext('2d')!.getImageData(0,0,400,400).data;}
      const sp=await pixels(saved.blob),op=await pixels(encoded);let exportMax=0;for(let i=0;i<sp.length;i++)exportMax=Math.max(exportMax,Math.abs(sp[i]-op[i]));
      const mp=await pixels(main.blob);let mainMax=0;for(let i=0;i<mp.length;i++)mainMax=Math.max(mainMax,Math.abs(mp[i]-op[i]));
      out.push({text,gapX,gapY,w,h,reachX,reachY,candidates,placements,max,previewMax,ink,exportMax,mainMax,workerSame,htmlEncodes});saved.dispose();main.dispose();bitmap.close();
    }return out;
  },angle);
  console.log('Image gap oracle',JSON.stringify({angle,results}));
  for(const r of results){expect(r.reachX).toBeLessThanOrEqual(80);expect(r.reachY).toBeLessThanOrEqual(80);expect(r.candidates).toBeLessThanOrEqual(4096);expect(r.placements).toBeLessThanOrEqual(4096);expect(r.workerSame).toBe(true);expect(r.htmlEncodes).toBe(0);expect(r.mainMax,JSON.stringify(r)).toBeLessThanOrEqual(2);expect(r.max,JSON.stringify(r)).toBeLessThanOrEqual(1);expect(r.previewMax,JSON.stringify(r)).toBeLessThanOrEqual(1);expect(r.exportMax,JSON.stringify(r)).toBeLessThanOrEqual(2);expect(r.ink).toBeGreaterThan(100);}
});

test('Tiled PDF rotated/cropped export raster matches preview at different resolutions',async({page})=>{
  test.setTimeout(180_000);
  await page.goto('/');
  const results=await page.evaluate(async()=>{
    const {loadPdf,states}=await import(String('/src/lib/pdf/load.ts')) as typeof import('../../src/lib/pdf/load');const {previewPdf}=await import(String('/src/lib/pdf/preview.ts')) as typeof import('../../src/lib/pdf/preview');const {exportPdf}=await import(String('/src/lib/pdf/export.ts')) as typeof import('../../src/lib/pdf/export');const {renderWatermark}=await import(String('/src/lib/editor/watermark.ts')) as typeof import('../../src/lib/editor/watermark');
    const pdf=await loadPdf(new File([await (await fetch('/tests/fixtures/pdf/rotated-crop.pdf')).arrayBuffer()],'x.pdf'));
    const out=[];
    for(const angle of [0,45,-45,90]) for(const text of ['I','A long verification watermark','Ágj\nVerification']) for(const [gapX,gapY] of [[0,0],[25,75],[37,123],[200,200]]){
      const mark={text,mode:'tiled' as const,sizeRatio:.05,x:.1,y:.9,angle,opacity:.7,color:'#ff0000',gapX,gapY};
      const saved=await exportPdf(pdf,mark);
      // At zero gap the narrow I asset is reduced below 50% at 420px: PDF.js
      // prescales and snaps image edges, while Canvas samples fractional edges.
      // Compare above that resampling boundary; retain the original default-gap raster too.
      for(const display of (gapX===25 && gapY===75 ? [420,840] : [840])) for(let index=0;index<pdf.pageCount;index++){
        const source=await previewPdf(pdf,index,{width:display,height:display*4/3}),actual=await previewPdf(saved.pdf!,index,{width:display,height:display*4/3});
        const c=document.createElement('canvas');c.width=Math.ceil(source.size.width);c.height=Math.ceil(source.size.height);const ctx=c.getContext('2d')!;ctx.drawImage(source.source,0,0);
        const bitmap=await renderWatermark(mark,source.size);
        const scale=Math.min(source.size.width,source.size.height)/1600,w=bitmap.width*scale,h=bitmap.height*scale;
        const theta=angle*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta),cx=source.size.width/2,cy=source.size.height/2;
        let sx=w*(1+gapX/100),sy=h*(1+gapY/100);
        const hx=(Math.abs(cos)*w+Math.abs(sin)*h)/2,hy=(Math.abs(sin)*w+Math.abs(cos)*h)/2;
        const rx=Math.abs(cos)*(cx+hx)+Math.abs(sin)*(cy+hy),ry=Math.abs(sin)*(cx+hx)+Math.abs(cos)*(cy+hy);
        // Rotated portrait pages can reach the existing symmetric density policy.
        const candidates=()=> (2*Math.floor(rx/sx)+1)*(2*Math.floor(ry/sy)+1);
        while(candidates()>4096){const factor=Math.max(1.1,Math.sqrt(candidates()/4096));sx*=factor;sy*=factor;}
        const nx=Math.floor(rx/sx),ny=Math.floor(ry/sy);
        ctx.globalAlpha=mark.opacity;
        // Independent centered percent lattice: no production centers/compositor in the PDF oracle.
        for(let row=-ny;row<=ny;row++)for(let col=-nx;col<=nx;col++){
          const x=cx+col*sx*cos-row*sy*sin,y=cy+col*sx*sin+row*sy*cos;
          if(x+hx<0||x-hx>source.size.width||y+hy<0||y-hy>source.size.height)continue;
          ctx.save();ctx.translate(x,y);ctx.rotate(theta);ctx.drawImage(bitmap,-w/2,-h/2,w,h);ctx.restore();
        }
        ctx.globalAlpha=1;bitmap.close();const expected=ctx.getImageData(0,0,c.width,c.height).data;
        ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(actual.source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;
        let error=0,ink=0,overlap=0;for(let i=0;i<pixels.length;i+=4){error+=Math.abs(pixels[i+1]-expected[i+1]);if(expected[i]>expected[i+1]+30){ink++;if(pixels[i]>pixels[i+1]+20)overlap++;}}
        const textContent=async(p:LoadedPdf)=>{const page=await states.get(p)!.doc.getPage(index+1);return (await page.getTextContent()).items.map(v=>'str' in v?v.str:'').join('');};
        out.push({angle,text,gapX,gapY,display,index,raster:angle===0 && text==='I' && gapX===0 && index===0?c.toDataURL():undefined,error:error/(pixels.length/4),overlap:overlap/ink,ink,pageCount:saved.pdf!.pageCount,originalCount:pdf.pageCount,textSame:await textContent(pdf)===await textContent(saved.pdf!)});source.dispose();actual.dispose();
      }saved.dispose();
    }pdf.dispose();return out;
  });
  const raster=results.find(r=>r.raster)?.raster;
  if(raster){const {writeFile}=await import('node:fs/promises');await writeFile(join(tmpdir(),'markid-task-3-zero-gap-pdf.png'),Buffer.from(raster.split(',')[1],'base64'));}
  console.log('PDF gap metrics',JSON.stringify(results.map(metric=>({...metric,raster:undefined}))));
  console.log('PDF tiled raster summary',JSON.stringify({cases:results.length,maxMeanError:Math.max(...results.map(r=>r.error)),minInkOverlap:Math.min(...results.map(r=>r.overlap))}));
  // Unchanged tolerances; the higher-resolution oracle avoids PDF.js prescale/snap
  // differences proved in pdf-gap-diagnostic-report.md, not a relaxed error budget.
  for(const r of results){expect(r.pageCount).toBe(r.originalCount);expect(r.textSame).toBe(true);expect(r.ink).toBeGreaterThan(100);expect(r.error,JSON.stringify(r)).toBeLessThan(7);expect(r.overlap,JSON.stringify(r)).toBeGreaterThan(.85);}
});

test('custom gaps survive real downloads, fresh regeneration, source replacement and processing lock',async({page})=>{
  await page.addInitScript(()=>{
    const post=Worker.prototype.postMessage;
    (window as unknown as GapWindow).gapReplies=[];
    Worker.prototype.postMessage=function(message:ExportRequest,...args:[(Transferable[] | StructuredSerializeOptions)?]){
      if(message?.mark) this.addEventListener('message',({data}:MessageEvent<ExportResponse>)=>{if(data.id===message.id && data.revision===message.revision && 'blob' in data)(window as unknown as GapWindow).gapReplies.push({blob:data.blob,mark:message.mark});});
      return Reflect.apply(post,this,[message,...args]);
    };
  });
  // Delay only module delivery: the real worker still renders and replies.
  await page.route('**/src/lib/image/export.worker.ts*',async route=>{const response=await route.fetch();await new Promise(resolve=>setTimeout(resolve,350));await route.fulfill({response});});
  await page.goto('/');await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');
  await page.getByLabel('Watermark text').fill('Gap lifecycle');await page.getByRole('button',{name:'Tiled',exact:true}).click();
  const xn=page.getByRole('spinbutton',{name:'Horizontal gap value',exact:true}),yn=page.getByRole('spinbutton',{name:'Vertical gap value',exact:true});
  await xn.fill('37');await xn.press('Enter');await yn.fill('123');await yn.press('Enter');
  const pixels=()=>page.getByLabel('Image preview').evaluate(n=>(n as HTMLCanvasElement).toDataURL());
  await expect.poll(() => precisePreview(page)).toBeLessThanOrEqual(1);
  const baseline=await pixels();
  async function download(){
    await page.getByRole('button',{name:'Preview',exact:true}).click();
    for(const name of ['Horizontal gap','Vertical gap']){await expect(page.getByRole('slider',{name,exact:true})).toBeDisabled();await expect(page.getByRole('spinbutton',{name:`${name} value`,exact:true})).toBeDisabled();}
    const button=page.getByRole('button',{name:'Download',exact:true});await expect(button).toBeEnabled();
    const pending=page.waitForEvent('download');await button.click();const file=await pending;
    const {readFile}=await import('node:fs/promises');const bytes=await readFile((await file.path())!);
    const reply=await page.evaluate(async()=>{const r=(window as unknown as GapWindow).gapReplies.at(-1)!;return {bytes:Array.from(new Uint8Array(await r.blob.arrayBuffer())),mark:r.mark,count:(window as unknown as GapWindow).gapReplies.length};});
    expect(Array.from(bytes)).toEqual(reply.bytes);
    await page.getByRole('button',{name:'Back to edit',exact:true}).click();
    return {bytes,reply};
  }
  const first=await download();await expect.poll(pixels).toBe(baseline);expect(first.reply.mark).toMatchObject({gapX:37,gapY:123});await expect(xn).toHaveValue('37');await expect(yn).toHaveValue('123');
  await xn.fill('200');await xn.press('Enter');await expect.poll(pixels).not.toBe(baseline);
  const second=await download();expect(second.bytes.equals(first.bytes)).toBe(false);expect(second.reply.count).toBe(2);
  const repeat=await download();expect(repeat.bytes.equals(second.bytes)).toBe(true);expect(repeat.reply.count).toBe(3);
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-1.jpg');
  await expect(page.getByText('exif-1.jpg',{exact:true})).toBeVisible();await expect(xn).toHaveValue('200');await expect(yn).toHaveValue('123');
  const replacement=await download();expect(replacement.reply.mark).toMatchObject({gapX:200,gapY:123});expect(replacement.reply.count).toBe(4);
});

for(const width of [390,1280]) test(`inspectable custom-gap editor at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/');await page.locator('input[type=file]').setInputFiles('tests/fixtures/images/exif-6.png');await page.getByLabel('Watermark text').fill('For verification only');
  await page.getByLabel('Angle',{exact:true}).fill('45');await page.getByLabel('Angle',{exact:true}).press('Enter');await page.getByRole('button',{name:'Tiled',exact:true}).click();await expect(page.locator('.watermark-selection')).toHaveCount(0);
  for(const [name,value] of [['Horizontal gap value','37'],['Vertical gap value','123']]){const n=page.getByRole('spinbutton',{name,exact:true});await n.fill(value);await n.press('Enter');}
  await expect(page.getByRole('spinbutton',{name:'Vertical gap value',exact:true})).toHaveValue('123');
  await page.screenshot({path:join(tmpdir(),`markid-task-3-custom-gap-${width}.png`),fullPage:true});
});
