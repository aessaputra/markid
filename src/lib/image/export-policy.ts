import type { Size } from '../editor/types';
import { validateSize } from '../input/headers';
export const EXPORT_ERROR = 'Export failed. Try again.';
export function assertJpeg(blob: Blob | null): asserts blob is Blob {
 if (!blob || blob.type !== 'image/jpeg' || blob.size === 0) throw new Error(EXPORT_ERROR);
}
/** One encode of the normalized original dimensions; capacity belongs to the device. */
export async function encodeJpeg(area: Size, encode: (size:Size,quality:number)=>Promise<Blob | null>): Promise<{blob:Blob;size:Size}> {
 validateSize(area);
 const size={...area};
 const blob=await encode(size,.92);
 assertJpeg(blob);
 return {blob,size};
}
