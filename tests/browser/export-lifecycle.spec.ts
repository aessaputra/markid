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
   const r=await exportImage({kind:'image',source,size:{width:100,height:100},resized:false,dispose(){}},{text:'Only',fontFamily:'Geist',sizeRatio:.1,x:.5,y:.5,angle:0,opacity:1,color:'#000'},{revision:42});
   return {mime:r.blob.type,size:r.size,sourceWidth:source.width};
  } finally {source.close();}
 });
 expect(result).toEqual({mime:'image/jpeg',size:{width:100,height:100},sourceWidth:100});
});

test('local worker FontFace asset load failure remains explicit',async({page})=>{
 await page.goto('/');
 // Page CSS is already loaded; only the worker's explicit FontFace URL is blocked.
 await page.route('**/geist-latin-400-normal.woff2*',route=>route.request().resourceType()==='font'?route.abort():route.continue());
 const error=await page.evaluate(async()=>{
  const {exportImage}=await import(String('/src/lib/image/export.ts'));
  const c=document.createElement('canvas');c.width=c.height=100;c.getContext('2d');
  try {await exportImage({kind:'image',source:c,size:{width:100,height:100},resized:false,dispose(){}},{text:'Only',fontFamily:'Geist',sizeRatio:.1,x:.5,y:.5,angle:0,opacity:1,color:'#000'});return 'unexpected success';}
  catch(e){return (e as Error).message;}
 });
 expect(error).toBe('Watermark font could not be loaded.');
});
