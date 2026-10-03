import { composeWatermark, renderWatermark } from '../editor/watermark';
import type { Size, Watermark } from '../editor/types';
import { encodeJpeg, EXPORT_ERROR } from './export-policy';

/** Compose from the normalized original source and encode once. */
export async function renderJpeg(source: ImageBitmap, area: Size, mark: Watermark, offscreen: boolean): Promise<{blob:Blob;size:Size}> {
 return encodeJpeg(area, async (size,quality) => {
  // Yield once so the main-thread processing status can paint.
  if(!offscreen) await new Promise<void>(resolve=>setTimeout(resolve,0));
  const canvas=offscreen ? new OffscreenCanvas(size.width,size.height) : document.createElement('canvas');
  canvas.width=size.width;canvas.height=size.height;
  let bitmap:ImageBitmap | null=null;
  try {
   const ctx=canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
   if(!ctx) throw new Error(EXPORT_ERROR);
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size.width,size.height);
   ctx.drawImage(source,0,0,size.width,size.height);
   bitmap=await renderWatermark(mark,size);
   composeWatermark(ctx,bitmap,mark,size);
   if('toBlob' in canvas) return await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
   return await canvas.convertToBlob({type:'image/jpeg',quality});
  } finally {bitmap?.close();canvas.width=canvas.height=0;}
 });
}
