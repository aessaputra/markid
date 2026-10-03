import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('final decoded preview precedes real JPEG download; back retains source and settings', async ({ page }) => {
 await page.goto('/');
 await page.getByLabel('Choose file', {exact:true}).setInputFiles('tests/fixtures/images/alpha.png');
 await page.getByLabel('Watermark text').fill('For verification only\nÁgj');
 await page.getByRole('button', {name:'Preview',exact:true}).click();
 const downloadButton=page.getByRole('button',{name:'Download',exact:true});
 await expect(downloadButton).toBeEnabled();
 const image=page.getByAltText('Final JPEG preview');
 await expect(image).toBeVisible();
 const preview=await image.evaluate((node: HTMLImageElement)=>({width:node.naturalWidth,height:node.naturalHeight,url:node.src}));
 expect(preview.width).toBeGreaterThan(0);
 const [download]=await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
 const bytes=await readFile((await download.path())!);
 expect(bytes.length).toBeGreaterThan(0);
 expect([...bytes.subarray(0,2)]).toEqual([255,216]);
 const decoded=await page.evaluate(async ({bytes,url})=>{
  const actual=new Blob([new Uint8Array(bytes)],{type:'image/jpeg'});
  const response=await fetch(url);const mime=response.headers.get('content-type');
  const shown=await response.arrayBuffer();
  const bitmap=await createImageBitmap(actual);
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);
  const pixel=Array.from(ctx.getImageData(0,0,1,1).data);bitmap.close();
  return {mime,width:canvas.width,height:canvas.height,pixel,same:bytes.every((v,i)=>v===new Uint8Array(shown)[i])};
 },{bytes:[...bytes],url:preview.url});
 expect(decoded.mime).toBe('image/jpeg');expect(decoded.width).toBe(preview.width);expect(decoded.height).toBe(preview.height);
 // Fixture is uniform RGBA(20,180,80,128): independent white-composite oracle, JPEG ±2.
 [137,217,167,255].forEach((v,i)=>expect(Math.abs(decoded.pixel[i]-v)).toBeLessThanOrEqual(2));expect(decoded.same).toBe(true);
 await page.getByRole('button',{name:'Back to edit'}).click();
 await expect(page.getByLabel('Watermark text')).toHaveValue('For verification only\nÁgj');
 await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width',String(preview.width));
 await page.getByLabel('Watermark text').fill('Changed');
 await expect(downloadButton).toHaveCount(0);
});

for (const area of [{width:600,height:400},{width:400,height:600}]) test(`real worker/fallback decoded pixel parity ${area.width}x${area.height}`,async({page})=>{
 await page.goto('/');
 const results=await page.evaluate(async area=>{
  const {exportImage}=await import(String('/src/lib/image/export.ts'));
  const {renderWatermark}=await import(String('/src/lib/editor/watermark.ts'));
  const canvas=document.createElement('canvas');canvas.width=area.width;canvas.height=area.height;
  const source=await createImageBitmap(canvas);
  const image={kind:'image',source,size:area,dispose(){}};
  const out=[];
  try {
   for(const angle of [-180,0,45,180]) for(const opacity of [0,.5]) {
    const mark={text:'Ágj\nFor verification only',sizeRatio:.08,x:.32,y:.63,angle,opacity,color:'#ff0000'};
    const worker=await exportImage(image,mark),main=await exportImage(image,mark,{forceMain:true});
    async function pixels(blob:Blob) {
     const decoded=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=decoded.width;c.height=decoded.height;
     const ctx=c.getContext('2d')!;ctx.drawImage(decoded,0,0);decoded.close();return ctx.getImageData(0,0,c.width,c.height).data;
    }
    const oracle=document.createElement('canvas');oracle.width=area.width;oracle.height=area.height;
    const ctx=oracle.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,area.width,area.height);
    const inkBitmap=await renderWatermark(mark,area);
    ctx.translate(mark.x*area.width,mark.y*area.height);ctx.rotate(mark.angle*Math.PI/180);ctx.globalAlpha=mark.opacity;
    ctx.drawImage(inkBitmap,-inkBitmap.width/2,-inkBitmap.height/2);inkBitmap.close();
    const expectedBlob=await new Promise<Blob>(resolve=>oracle.toBlob(blob=>resolve(blob!),'image/jpeg',.92));
    const a=await pixels(worker.blob),b=await pixels(main.blob),expected=await pixels(expectedBlob);
    let oracleMax=0;for(let i=0;i<a.length;i++)oracleMax=Math.max(oracleMax,Math.abs(a[i]-expected[i]));
    let max=0,ink=0;for(let i=0;i<a.length;i++){max=Math.max(max,Math.abs(a[i]-b[i]));if(i%4!==3 && a[i]<240)ink++;}
    out.push({angle,opacity,max,oracleMax,ink,mime:worker.blob.type,bytes:worker.blob.size,size:worker.size});
    worker.dispose();main.dispose();
   }
   return {out,sourceWidth:source.width};
  } finally {source.close();}
 },area);
 expect(results.sourceWidth).toBe(area.width);
 for(const r of results.out){expect(r.max).toBeLessThanOrEqual(2);expect(r.oracleMax).toBeLessThanOrEqual(2);if(r.opacity===0)expect(r.ink).toBe(0);if(r.opacity!==0)expect(r.ink).toBeGreaterThan(100);expect(r.mime).toBe('image/jpeg');expect(r.bytes).toBeGreaterThan(0);expect(r.size).toEqual(area);}
});

test('noisy original source encodes above 1MiB with worker/fallback parity',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {exportImage}=await import(String('/src/lib/image/export.ts'));
  const c=document.createElement('canvas');c.width=2400;c.height=3200;const ctx=c.getContext('2d')!;
  const noise=ctx.createImageData(c.width,c.height);let seed=42;
  for(let i=0;i<noise.data.length;i+=4){for(let k=0;k<3;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise.data[i+k]=seed>>>24;}noise.data[i+3]=255;}
  ctx.putImageData(noise,0,0);
  const source=await createImageBitmap(c);const image={kind:'image',source,size:{width:c.width,height:c.height},dispose(){}};
  const mark={text:'For verification only',sizeRatio:.06,x:.5,y:.5,angle:45,opacity:.8,color:'#ffffff'};
  const out=[];
  for(const forceMain of [false,true]) {
   const r=await exportImage(image,mark,{forceMain});const bitmap=await createImageBitmap(r.blob);
   out.push({bytes:r.blob.size,mime:r.blob.type,size:r.size,decoded:{width:bitmap.width,height:bitmap.height}});bitmap.close();r.dispose();
  }
  source.close();return out;
 });
 for(const r of result){expect(r.bytes).toBeGreaterThan(0);expect(r.bytes).toBeGreaterThan(1048576);expect(r.mime).toBe('image/jpeg');expect(r.size).toEqual(r.decoded);expect(r.size).toEqual({width:2400,height:3200});expect(r.size!.width/r.size!.height).toBe(.75);}
 expect(result[0]).toEqual(result[1]);
});

for(const mode of ['null','empty','mime','throw','corrupt','large-corrupt'] as const) test(`main fallback ${mode} failure returns no result`,async({page})=>{
 await page.goto('/');
 const error=await page.evaluate(async mode=>{
  const {exportImage}=await import(String('/src/lib/image/export.ts'));
  const c=document.createElement('canvas');c.width=c.height=100;c.getContext('2d');
  const image={kind:'image',source:c,size:{width:100,height:100},dispose(){}};
  const mark={text:'For verification only',sizeRatio:.05,x:.5,y:.5,angle:0,opacity:0,color:'#000'};
  const original=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(callback){
   if(mode==='throw') throw new Error('codec unavailable');
   callback(mode==='null'?null:new Blob(mode==='empty'?[]:mode==='large-corrupt'?[new Uint8Array(1048577)]:['not jpeg'],{type:mode==='mime'?'image/png':'image/jpeg'}));
  };
  try {await exportImage(image,mark,{forceMain:true});return 'unexpected success';}
  catch(e){return (e as Error).message;}finally {HTMLCanvasElement.prototype.toBlob=original;}
 },mode);
 if(mode==='corrupt'||mode==='large-corrupt') expect(error).not.toBe('unexpected success');
 else expect(error).toBe(mode==='throw'?'codec unavailable':'Export failed. Try again.');
});

test('capability fallback yields UI, locks file/style/drag and releases final URL on back',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(window,'Worker',{value:undefined,configurable:true});
  Object.defineProperty(window,'OffscreenCanvas',{value:undefined,configurable:true});
  const encode=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){setTimeout(()=>encode.call(this,callback,type,quality),300);};
  const revoke=URL.revokeObjectURL;
  (window as unknown as {revoked:string[]}).revoked=[];
  URL.revokeObjectURL=url=>{(window as unknown as {revoked:string[]}).revoked.push(url);revoke(url);};
 });
 await page.goto('/');await page.getByLabel('Choose file',{exact:true}).setInputFiles('tests/fixtures/images/exif-1.jpg');
 await page.getByLabel('Watermark text').fill('Only');await expect(page.locator('.watermark-selection')).toBeVisible();
 await expect(page.getByRole('button',{name:'Center',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByText('Processing…',{exact:true})).toBeVisible();
 await expect(page.locator('.watermark-selection')).toHaveClass(/locked/);
 await page.locator('.watermark-selection').dispatchEvent('pointerdown',{pointerId:1,button:0});
 await page.locator('.preview-frame').dispatchEvent('pointermove',{pointerId:1,clientX:20,clientY:20});
 await expect(page.getByRole('button',{name:'Center',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Choose file',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Change file',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Watermark text')).toBeDisabled();await expect(page.getByRole('button',{name:'Reset',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const url=await page.getByAltText('Final JPEG preview').getAttribute('src');
 expect(await page.evaluate(url=>(window as unknown as {revoked:string[]}).revoked.includes(url!),url)).toBe(false);
 await page.getByRole('button',{name:'Back to edit'}).click();
 expect(await page.evaluate(url=>(window as unknown as {revoked:string[]}).revoked.includes(url!),url)).toBe(true);
 await expect(page.getByLabel('Watermark text')).toHaveValue('Only');
});
