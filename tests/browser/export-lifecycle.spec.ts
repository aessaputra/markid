import {test,expect} from '@playwright/test';

test('worker ignores stale protocol messages and closes cloned resources after real response',async({page})=>{
 await page.addInitScript(()=>{
  const Native=window.Worker;
  window.Worker=class extends Native {
   override postMessage(message:unknown,transfer:Transferable[] | StructuredSerializeOptions = []) {
    const m=message as {id:number;revision:number};
    setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:{id:m.id-1,revision:m.revision,error:'stale response'}})),0);
    if(Array.isArray(transfer))super.postMessage(message,transfer);else super.postMessage(message,transfer);
   }
  };
 });
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {exportImage}=await import(String('/src/lib/image/export.ts'));
  const c=document.createElement('canvas');c.width=c.height=100;c.getContext('2d');
  const source=await createImageBitmap(c);
  try {
   const r=await exportImage({kind:'image',source,size:{width:100,height:100},dispose(){}},{text:'Only',sizeRatio:.1,x:.5,y:.5,angle:0,opacity:1,color:'#000'},{revision:42});
   return {mime:r.blob.type,size:r.size,sourceWidth:source.width};
  } finally {source.close();}
 });
 expect(result).toEqual({mime:'image/jpeg',size:{width:100,height:100},sourceWidth:100});
});

for(const probe of ['constructor','context'] as const) test(`worker-only ${probe} probe exception selects real HTML Canvas JPEG fallback`,async({page})=>{
 let injected=0;
 await page.route('**/src/lib/image/export.worker.ts*',async route=>{
  const response=await route.fetch();
  const fault=probe==='constructor'
   ? "self.OffscreenCanvas=class { constructor(){throw new Error('worker probe constructor');} };"
   : "self.OffscreenCanvas.prototype.getContext=function(){throw new Error('worker probe context');};";
  injected++;
  await route.fulfill({response,body:fault+'\n'+await response.text()});
 });
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const pageOffscreenWorks=!!new OffscreenCanvas(1,1).getContext('2d');
  let encodes=0;
  const native=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(...args){encodes++;return native.apply(this,args);};
  try {
   const {exportImage}=await import(String('/src/lib/image/export.ts'));
   const c=document.createElement('canvas');c.width=200;c.height=100;
   const context=c.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,200,100);
   const r=await exportImage({kind:'image',source:c,size:{width:200,height:100},dispose(){}},{text:'Only',sizeRatio:.1,x:.5,y:.5,angle:0,opacity:1,color:'#000'});
   const bytes=new Uint8Array(await r.blob.arrayBuffer());
   const decoded=await createImageBitmap(r.blob);
   const size={width:decoded.width,height:decoded.height};decoded.close();
   return {pageOffscreenWorks,encodes,mime:r.blob.type,bytes:r.blob.size,signature:Array.from(bytes.slice(0,3)),size};
  } finally {HTMLCanvasElement.prototype.toBlob=native;}
 });
 expect(injected).toBe(1);expect(result.pageOffscreenWorks).toBe(true);expect(result.encodes).toBeGreaterThan(0);
 expect(result.mime).toBe('image/jpeg');expect(result.bytes).toBeGreaterThan(0);
 expect(result.signature).toEqual([255,216,255]);expect(result.size).toEqual({width:200,height:100});
 console.log(`worker ${probe} probe fallback JPEG`,result);
});

test('actual worker encode exception remains explicit without main Canvas fallback',async({page})=>{
 const workers:string[]=[];page.on('worker',worker=>workers.push(worker.url()));
 await page.route('**/src/lib/image/export.worker.ts*',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:"self.OffscreenCanvas.prototype.convertToBlob=async function(){throw new Error('worker encode failed');};\n"+await response.text()});
 });
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  let encodes=0;
  const native=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(...args){encodes++;return native.apply(this,args);};
  try {
   const {exportImage}=await import(String('/src/lib/image/export.ts'));
   const c=document.createElement('canvas');c.width=c.height=100;c.getContext('2d');
   try {await exportImage({kind:'image',source:c,size:{width:100,height:100},dispose(){}},{text:'Only',sizeRatio:.1,x:.5,y:.5,angle:0,opacity:1,color:'#000'});return {error:'unexpected success',encodes};}
   catch(e){return {error:(e as Error).message,encodes};}
  } finally {HTMLCanvasElement.prototype.toBlob=native;}
 });
 expect(result).toEqual({error:'worker encode failed',encodes:0});
 expect(workers.some(url=>url.includes('export.worker'))).toBe(true);
});
