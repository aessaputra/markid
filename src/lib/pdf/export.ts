import type {LoadedPdf,Watermark,ExportResult} from '../editor/types';
import {renderWatermark,tiledCenters} from '../editor/watermark';
import {displaySize,imagePlacement} from './geometry';
import {openPdf,states} from './load';
export async function exportPdf(pdf:LoadedPdf,mark:Watermark):Promise<ExportResult>{
 const {PDFDocument,degrees}=await import('pdf-lib');
 const doc=await PDFDocument.load(pdf.bytes.slice(),{updateMetadata:false});
 const snapshot={...mark};
 // Fixed normalized layout: one shared high-resolution asset, proportional on every page.
 const bitmap=await renderWatermark(snapshot,{width:1600,height:1600});
 try{
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas renderer is unavailable.');
  let png:Blob;
  try{ctx.drawImage(bitmap,0,0);png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Export failed. Try again.')),'image/png'));}
  finally{canvas.width=canvas.height=0;}
  const asset=await doc.embedPng(await png.arrayBuffer());
  const state=states.get(pdf);if(!state || state.disposed)throw new Error('PDF is closed.');
  for(const [index,page] of doc.getPages().entries()){
   // Use the actual preview reader's normalized bounds/rotation, including malformed-box fallback.
   const reader=await state.doc.getPage(index+1);
   const [x,y,right,top]=reader.view;const rotation=reader.rotate;reader.cleanup();
   const box={x,y,width:right-x,height:top-y},size=displaySize(box,rotation);
   const scale=Math.min(size.width,size.height)/1600,width=bitmap.width*scale,height=bitmap.height*scale;
   if(snapshot.mode==='tiled'){
    const centers=tiledCenters({width:size.width,height:size.height},{width,height},snapshot.angle,snapshot.gapX,snapshot.gapY);
    for(const c of centers){
     const p=imagePlacement(box,rotation,{x:c.x/size.width,y:c.y/size.height,angle:snapshot.angle},width,height);
     page.drawImage(asset,{x:p.x,y:p.y,width,height,rotate:degrees(p.angle),opacity:snapshot.opacity});
    }
   }else{
    const p=imagePlacement(box,rotation,snapshot,width,height);
    page.drawImage(asset,{x:p.x,y:p.y,width,height,rotate:degrees(p.angle),opacity:snapshot.opacity});
   }
  }
  const bytes=await doc.save();const output=await openPdf(bytes);
  return {kind:'pdf',blob:new Blob([bytes.slice().buffer],{type:'application/pdf'}),pdf:output,dispose(){output.dispose();}};
 }finally{bitmap.close();}
}
