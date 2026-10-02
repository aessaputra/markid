/// <reference lib="webworker" />
import geist from '@fontsource/geist/files/geist-latin-400-normal.woff2?url';
import { renderJpeg } from './export-render';
import { EXPORT_ERROR } from './export-policy';
import type { Size, Watermark } from '../editor/types';
const scope = self as unknown as DedicatedWorkerGlobalScope;
export type ExportRequest={id:number;revision:number;image:ImageBitmap;size:Size;mark:Watermark};
export type ExportResponse={id:number;revision:number;blob:Blob;size:Size} | {id:number;revision:number;error:string;unsupported?:boolean};
scope.onmessage=async ({data}:MessageEvent<ExportRequest>)=>{
 const {id,revision,image,size,mark}=data;
 try {
  if(typeof OffscreenCanvas==='undefined' || !new OffscreenCanvas(1,1).getContext('2d') || typeof FontFace==='undefined' || !scope.fonts || !OffscreenCanvas.prototype.convertToBlob) {
   scope.postMessage({id,revision,error:EXPORT_ERROR,unsupported:true} satisfies ExportResponse);return;
  }
  // Workers have their own FontFaceSet; no dependency on the document's CSS faces.
  if(mark.fontFamily!=='Geist') throw new Error('Watermark font could not be loaded.');
  try {const face=await new FontFace('Geist',`url(${geist})`).load();scope.fonts.add(face);}
  catch(cause) {throw new Error('Watermark font could not be loaded.',{cause});}
  const result=await renderJpeg(image,size,mark,true);
  scope.postMessage({id,revision,...result} satisfies ExportResponse);
 } catch(error) {scope.postMessage({id,revision,error:error instanceof Error?error.message:EXPORT_ERROR} satisfies ExportResponse);}
 finally {image.close();}
};
