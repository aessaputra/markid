import type { ImagePolicy, LoadedImage } from '../editor/types';
import { validateSize } from '../input/headers';
import { fitWorkingSize } from './load';
/** Own decoded orientation-normalized bitmap; resize from actual display dimensions. */
export async function normalizeBitmap(bitmap:ImageBitmap,policy:ImagePolicy):Promise<LoadedImage>{
 let source=bitmap;
 try {
  const size=validateSize({width:bitmap.width,height:bitmap.height}),working=fitWorkingSize(size,policy);
  const resized=size.width!==working.width||size.height!==working.height;
  if(resized){source=await createImageBitmap(bitmap,{resizeWidth:working.width,resizeHeight:working.height,resizeQuality:'high'});bitmap.close();}
  if(source.width!==working.width||source.height!==working.height)throw new Error('Invalid bitmap.');
  let disposed=false;return {kind:'image',source,size:working,resized,dispose(){if(!disposed){disposed=true;source.close();}}};
 }catch{source.close();if(source!==bitmap)bitmap.close();throw new Error('Could not open this file. Try a JPG or PNG.');}
}
/** CSP entry uses a lazy local Blob worker in tested 1.6.5, not unsafe-eval. */
export async function decodeHeif(file:File,policy:ImagePolicy):Promise<LoadedImage>{
 try{const {heicTo}=await import('heic-to/csp');return await normalizeBitmap(await heicTo({blob:file,type:'bitmap'}),policy);}
 catch{throw new Error('Could not open this file. Try a JPG or PNG.');}
}
