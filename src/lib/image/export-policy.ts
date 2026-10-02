import type { Size } from '../editor/types';
export const JPEG_LIMIT = 1_048_576;
export const EXPORT_ERROR = 'Export failed. Try again.';
// Experimental only: the readability/device release gate must approve replacements.
export function candidates(area: Size): { size: Size; quality: number }[] {
 return [1,.85,.7,.55].flatMap(scale => [.92,.85,.78,.70].map(quality => ({
  size:{width:Math.max(1,Math.round(area.width*scale)),height:Math.max(1,Math.round(area.height*scale))},quality,
 })));
}
export function assertJpeg(blob: Blob | null): asserts blob is Blob {
 if (!blob || blob.type !== 'image/jpeg' || blob.size === 0 || blob.size > JPEG_LIMIT) throw new Error(EXPORT_ERROR);
}
export async function encodeBounded(area: Size, encode: (size:Size,quality:number)=>Promise<Blob | null>): Promise<{blob:Blob;size:Size}> {
 for(const candidate of candidates(area)) {
  const blob=await encode(candidate.size,candidate.quality);
  if(!blob || blob.type!=='image/jpeg' || !blob.size) throw new Error(EXPORT_ERROR);
  if(blob.size<=JPEG_LIMIT) {assertJpeg(blob);return {blob,size:candidate.size};}
 }
 throw new Error(EXPORT_ERROR);
}
