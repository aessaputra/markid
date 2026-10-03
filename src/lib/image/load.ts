import type { LoadedImage } from '../editor/types';
import { validateSize, readDimensions, readOrientation } from '../input/headers';
import { checkFileSize } from '../input/policy';
import { identify } from '../input/identify';
import { decodeNative, decodeNativeHtml } from './native';
import { decodeHeif, normalizeBitmap } from './heic';
import { stripWebpExif, orientWebp } from './webp';
let decodeTail:Promise<void>=Promise.resolve();
/** Serialize full decode allocation; controller still disposes stale completed resources. */
export async function loadImage(file: File): Promise<LoadedImage> {
  const previous=decodeTail;let release!:()=>void;
  decodeTail=new Promise<void>(resolve=>release=resolve);
  await previous;
  try { return await loadActive(file); } finally { release(); }
}
async function loadActive(file: File): Promise<LoadedImage> {
  checkFileSize(file.size);
  const format = await identify(file);
  const encodedSize = await readDimensions(file,format);
  if (format === 'heif' || format === 'avif' || format === 'webp') {
    const orientation=format==='webp'?await readOrientation(file,format):1;
    const blob=orientation!==1?await stripWebpExif(file):file.slice(0,file.size,`image/${format}`);
    // Strip WebP EXIF before decoding, then apply once from actual decoded size.
    let loaded:LoadedImage;
    try { loaded=await normalizeBitmap(await createImageBitmap(blob,{imageOrientation:'from-image'})); }
    catch {
      if (format === 'heif') return decodeHeif(file);
      // Native HTML fallback only, never route AVIF/WebP to HEVC.
      loaded=await decodeNativeHtml(blob);
    }
    return orientation!==1?orientWebp(loaded,orientation):loaded;
  }
  const orientation = await readOrientation(file,format);
  const size = validateSize(orientation >= 5 ? {width:encodedSize.height,height:encodedSize.width} : encodedSize);
  // Correct MIME from signature; user-supplied MIME/extension is untrusted.
  return decodeNative(file.slice(0,file.size,`image/${format}`),size);
}
