import type { ExportResult, LoadedImage, Watermark } from '../editor/types';
import type { ExportRequest, ExportResponse } from './export.worker';
import { assertJpeg, EXPORT_ERROR } from './export-policy';
import { renderJpeg } from './export-render';
let sequence=0;
function workerAvailable(): boolean {
 try {return typeof Worker!=='undefined' && typeof OffscreenCanvas!=='undefined' && !!new OffscreenCanvas(1,1).getContext('2d') && typeof FontFace!=='undefined';}
 catch {return false;}
}
async function inWorker(source:ImageBitmap,image:LoadedImage,mark:Watermark,id:number,revision:number): Promise<ExportResponse> {
 const clone=await createImageBitmap(source);
 let worker:Worker;
 try {worker=new Worker(new URL('./export.worker.ts',import.meta.url),{type:'module'});}
 catch {clone.close();return {id,revision,error:EXPORT_ERROR,unsupported:true};}
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(new Error(EXPORT_ERROR)),60_000);
  function finish(result: ExportResponse | Error) {
   clearTimeout(timer);worker.terminate();clone.close();
   if(result instanceof Error) reject(result);else resolve(result);
  }
  worker.onmessage=({data}:MessageEvent<ExportResponse>)=>{
   if(data.id!==id || data.revision!==revision) return;
   finish(data);
  };
  worker.onerror=()=>finish(new Error(EXPORT_ERROR));
  const request:ExportRequest={id,revision,image:clone,size:{...image.size},mark};
  try {worker.postMessage(request,[clone]);} catch {finish(new Error(EXPORT_ERROR));}
 });
}
/** Owns clones only. Never transfers or closes the editor's source. */
export async function exportImage(image:LoadedImage,mark:Watermark,options:{revision?:number;forceMain?:boolean}={}):Promise<ExportResult> {
 const snapshot={...mark}, id=++sequence, revision=options.revision??0;
 const source=await createImageBitmap(image.source);
 try {
  let result: {blob:Blob;size:{width:number;height:number}};
  if(!options.forceMain && workerAvailable()) {
   const reply=await inWorker(source,image,snapshot,id,revision);
   if('error' in reply) {
    if(!reply.unsupported) throw new Error(reply.error);
    result=await renderJpeg(source,image.size,snapshot,false);
   } else result=reply;
  } else result=await renderJpeg(source,image.size,snapshot,false);
  assertJpeg(result.blob);
  // Decode the exact final bytes before making a result available to UI/download.
  const decoded=await createImageBitmap(result.blob);
  try {if(decoded.width!==result.size.width || decoded.height!==result.size.height) throw new Error(EXPORT_ERROR);}
  finally {decoded.close();}
  return {kind:'image',...result,dispose(){}};
 } finally {source.close();}
}
