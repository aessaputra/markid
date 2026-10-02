import type { ImagePolicy, Size, LoadedImage } from '../editor/types';
import { validateSize, readDimensions, readOrientation } from '../input/headers';
import { checkFileSize } from '../input/policy';
import { identify } from '../input/identify';
import { decodeNative } from './native';
import { decodeHeif, normalizeBitmap } from './heic';
let decodeTail:Promise<void>=Promise.resolve();
/** Serialize full decode allocation; controller still disposes stale completed resources. */
export async function loadImage(file: File, policy: ImagePolicy): Promise<LoadedImage> {
  const previous=decodeTail;let release!:()=>void;
  decodeTail=new Promise<void>(resolve=>release=resolve);
  await previous;
  try { return await loadActive(file,policy); } finally { release(); }
}
async function loadActive(file: File, policy: ImagePolicy): Promise<LoadedImage> {
  checkFileSize(file.size);
  const format = await identify(file);
  const encodedSize = await readDimensions(file,format);
  if (format === 'heif' || format === 'avif' || format === 'webp') {
    const blob=file.slice(0,file.size,`image/${format}`);
    try { return await normalizeBitmap(await createImageBitmap(blob,{imageOrientation:'from-image'}),policy); }
    catch {
      if (format === 'heif') return decodeHeif(file,policy);
      // Native HTML fallback only, never route AVIF/WebP to HEVC.
      return decodeNative(blob,encodedSize,fitWorkingSize(encodedSize,policy));
    }
  }
  const orientation = await readOrientation(file,format);
  const size = orientation >= 5 ? {width:encodedSize.height,height:encodedSize.width} : encodedSize;
  const working = fitWorkingSize(size,policy);
  // Correct MIME from signature; user-supplied MIME/extension is untrusted.
  return decodeNative(file.slice(0,file.size,`image/${format}`),size,working);
}
export function fitWorkingSize(size: Size, policy: ImagePolicy): Size {
  validateSize(size);
  validateSize({width:policy.maxSide,height:policy.maxPixels});
  const scale = Math.min(1, policy.maxSide / size.width, policy.maxSide / size.height, Math.sqrt(policy.maxPixels / (size.width * size.height)));
  return {width:Math.max(1,Math.floor(size.width*scale)),height:Math.max(1,Math.floor(size.height*scale))};
}
