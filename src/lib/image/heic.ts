import type { LoadedImage } from '../editor/types';
import { validateSize } from '../input/headers';
/** Own decoded orientation-normalized bitmap; preserve actual display dimensions. */
export function normalizeBitmap(bitmap:ImageBitmap):Promise<LoadedImage>{
 const source=bitmap;
 try {
  const working=validateSize({width:bitmap.width,height:bitmap.height});
  let disposed=false;return Promise.resolve({kind:'image',source,size:working,dispose(){if(!disposed){disposed=true;source.close();}}});
 }catch{source.close();return Promise.reject(new Error('Could not open this file. Try a JPG or PNG.'));}
}
/** CSP entry uses a lazy local Blob worker in tested 1.6.5, not unsafe-eval. */
export async function decodeHeif(file:File):Promise<LoadedImage>{
 try{const {heicTo}=await import('heic-to/csp');return await normalizeBitmap(await heicTo({blob:file,type:'bitmap'}));}
 catch{throw new Error('Could not open this file. Try a JPG or PNG.');}
}
