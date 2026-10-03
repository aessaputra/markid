import {test,expect} from '@playwright/test';
test('unusable OffscreenCanvas context falls back to real HTML canvas rendering',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const getContext=OffscreenCanvas.prototype.getContext;
  Object.defineProperty(OffscreenCanvas.prototype,'getContext',{value:()=>null,configurable:true});
  try {
   const {exportImage}=await import(String('/src/lib/image/export.ts'));
   const c=document.createElement('canvas');c.width=200;c.height=100;c.getContext('2d');
   const r=await exportImage({kind:'image',source:c,size:{width:200,height:100},resized:false,dispose(){}},{text:'Only',sizeRatio:.1,x:.5,y:.5,angle:45,opacity:.5,color:'#000'});
   const decoded=await createImageBitmap(r.blob);const size={width:decoded.width,height:decoded.height};decoded.close();return {mime:r.blob.type,size};
  } finally {Object.defineProperty(OffscreenCanvas.prototype,'getContext',{value:getContext,configurable:true});}
 });
 expect(result).toEqual({mime:'image/jpeg',size:{width:200,height:100}});
});
