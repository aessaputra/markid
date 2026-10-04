import { composeWatermark, renderWatermark } from '../editor/watermark';
import type { Size, Watermark } from '../editor/types';
import { validateSize } from '../input/headers';
import { assertJpeg, EXPORT_ERROR } from './export-policy';

/** Compose from the normalized original source and encode once. */
export async function renderJpeg(source: ImageBitmap, area: Size, mark: Watermark, offscreen: boolean): Promise<{blob:Blob;size:Size}> {
 validateSize(area);
 const size={...area};
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
  const blob='toBlob' in canvas ? await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.92)) : await canvas.convertToBlob({type:'image/jpeg',quality:.92});
  assertJpeg(blob);
  return {blob,size};
 } finally {bitmap?.close();canvas.width=canvas.height=0;}
}
