import type { ImagePolicy, LoadedImage, Size } from '../editor/types';
import { validateSize } from '../input/headers';
import { fitWorkingSize } from './load';
const failure = () => new Error('Could not open this file. Try a JPG or PNG.');
/** Decoder applies EXIF. Never apply a second orientation transform. */
export async function decodeNative(blob: Blob, displaySize: Size, workingSize: Size): Promise<LoadedImage> {
  const resized = displaySize.width !== workingSize.width || displaySize.height !== workingSize.height;
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(blob, {imageOrientation:'from-image',resizeWidth:workingSize.width,resizeHeight:workingSize.height,resizeQuality:'high'});
      validateSize({width:bitmap.width,height:bitmap.height});
      if (bitmap.width !== workingSize.width || bitmap.height !== workingSize.height) throw failure();
      const source = bitmap;
      let disposed = false;
      return {kind:'image',size:workingSize,source,resized,dispose(){if (!disposed) {disposed=true;source.close();}}};
    } catch { bitmap?.close(); /* Native HTML decoder fallback below. */ }
  }
  return decodeNativeHtml(blob, undefined, displaySize, workingSize);
}
/** Modern fallback trusts real HTML display dimensions, not encoded metadata. */
export async function decodeNativeHtml(blob:Blob, policy?:ImagePolicy, displaySize?:Size, expectedWorking?:Size):Promise<LoadedImage> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  let canvas: HTMLCanvasElement | undefined;
  try {
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(failure());image.src=url;});
    validateSize({width:image.naturalWidth,height:image.naturalHeight});
    const actual={width:image.naturalWidth,height:image.naturalHeight};
    if (displaySize && (actual.width !== displaySize.width || actual.height !== displaySize.height)) throw failure();
    const workingSize=policy?fitWorkingSize(actual,policy):expectedWorking!;
    const resized=actual.width!==workingSize.width||actual.height!==workingSize.height;
    canvas = document.createElement('canvas'); canvas.width=workingSize.width; canvas.height=workingSize.height;
    const context = canvas.getContext('2d'); if (!context) throw failure();
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const source=canvas; let disposed=false;
    return {kind:'image',size:workingSize,source,resized,dispose(){if(!disposed){disposed=true;source.width=0;source.height=0;}}};
  } catch { if(canvas){canvas.width=0;canvas.height=0;} throw failure(); }
  finally {image.onload=null;image.onerror=null;image.src='';URL.revokeObjectURL(url);}
}
