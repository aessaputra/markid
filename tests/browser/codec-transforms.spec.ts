import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('raw pinned libheif output already applies container transforms once',async({page})=>{
 await page.goto('/');
 for(const name of ['rotate','mirror']){
  const actual=await page.evaluate(async(bytes)=>{const {heicTo}=await import(/* @vite-ignore */String('/node_modules/heic-to/dist/csp/heic-to.js'));const b=await heicTo({blob:new Blob([new Uint8Array(bytes)]),type:'bitmap'});const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const ctx=c.getContext('2d')!;ctx.drawImage(b,0,0);const pixels=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>[...ctx.getImageData(Math.floor(x*c.width),Math.floor(y*c.height),1,1).data]);b.close();return {size:[c.width,c.height],pixels};},[...readFileSync(`tests/fixtures/codecs/${name}.heif`)]);
  expect(actual.size).toEqual(name==='rotate'?[240,320]:[320,240]);expect(actual.pixels.map(p=>p[0]>180?(p[1]>180?'Y':'R'):p[1]>90?'G':'B')).toEqual(name==='rotate'?['B','R','Y','G']:['G','R','Y','B']);
 }
});
for(const ext of ['webp','avif','heif']) for(const transform of ['rotate','mirror']) for(const fallback of [false,true]) {
 test(`${transform}.${ext} ${fallback?'fallback':'primary'} display and JPEG parity`,async({page})=>{
  await page.goto('/');
  const actual=await page.evaluate(async({bytes,fallback})=>{
   const {loadImage}=await import(/* @vite-ignore */String('/src/lib/image/load.ts'));
   const {exportImage}=await import(/* @vite-ignore */String('/src/lib/image/export.ts'));
   const original=window.createImageBitmap;
   if(fallback) window.createImageBitmap=((source: ImageBitmapSource,...args: unknown[])=>source instanceof Blob?Promise.reject(new Error('forced native failure')):original(source,...args as [])) as typeof createImageBitmap;
   let loaded;
   try {loaded=await loadImage(new File([new Uint8Array(bytes)],'wrong.jpg'));}
   finally {window.createImageBitmap=original;}
   const sample=(source:CanvasImageSource,w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!;ctx.drawImage(source,0,0,w,h);return [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>[...ctx.getImageData(Math.floor(x*w),Math.floor(y*h),1,1).data]);};
   const pixels=sample(loaded.source,loaded.size.width,loaded.size.height);
   const exported=await exportImage(loaded,{text:'Test',sizeRatio:.05,x:.5,y:.5,angle:0,opacity:0,color:'#000000'}, {forceMain:true});
   const jpeg=await original(exported.blob);const jpegPixels=sample(jpeg,jpeg.width,jpeg.height);const size=[loaded.size.width,loaded.size.height],jpegSize=[jpeg.width,jpeg.height];jpeg.close();loaded.dispose();
   return {size,jpegSize,pixels,jpegPixels};
  },{bytes:[...readFileSync(`tests/fixtures/codecs/${transform}.${ext}`)],fallback});
  expect(actual.size).toEqual(transform==='rotate'?[240,320]:[320,240]);expect(actual.jpegSize).toEqual(actual.size);
  const colors=(pixels:number[][])=>pixels.map(p=>p[0]>180?(p[1]>180?'Y':'R'):p[1]>90?'G':'B');
  const expected=transform==='rotate'?['B','R','Y','G']:['G','R','Y','B'];expect(colors(actual.pixels)).toEqual(expected);expect(colors(actual.jpegPixels)).toEqual(expected);
 });
}
