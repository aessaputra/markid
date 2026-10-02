import type { LoadedImage, Size } from '../editor/types';
import { validateSize } from '../input/headers';
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
  const url = URL.createObjectURL(blob);
  const image = new Image();
  let canvas: HTMLCanvasElement | undefined;
  try {
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(failure());image.src=url;});
    validateSize({width:image.naturalWidth,height:image.naturalHeight});
    if (image.naturalWidth !== displaySize.width || image.naturalHeight !== displaySize.height) throw failure();
    canvas = document.createElement('canvas'); canvas.width=workingSize.width; canvas.height=workingSize.height;
    const context = canvas.getContext('2d'); if (!context) throw failure();
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const source=canvas; let disposed=false;
    return {kind:'image',size:workingSize,source,resized,dispose(){if(!disposed){disposed=true;source.width=0;source.height=0;}}};
  } catch { if(canvas){canvas.width=0;canvas.height=0;} throw failure(); }
  finally {image.onload=null;image.onerror=null;image.src='';URL.revokeObjectURL(url);}
}
