import type {LoadedImage} from '../editor/types';
import {validateSize} from '../input/headers';
/** Remove EXIF before native decode: WebP EXIF support differs by engine.
 * Transform stripped pixels exactly once, including mirror variants. */
export async function stripWebpExif(file:Blob):Promise<Blob>{
 const bytes=new Uint8Array(await file.arrayBuffer()),d=new DataView(bytes.buffer),parts=[bytes.slice(0,12)];
 for(let o=12;o<bytes.length;){const n=d.getUint32(o+4,true),end=o+8+n+n%2;
  if(d.getUint32(o)!==0x45584946)parts.push(bytes.slice(o,end));o=end;
 }
 const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){result.set(p,o);o+=p.length;}
 new DataView(result.buffer).setUint32(4,result.length-8,true);
 // EXIF-present flag is cleared in VP8X after removing its chunk.
 if(new DataView(result.buffer).getUint32(12)===0x56503858)result[20]&=~8;
 return new Blob([result],{type:'image/webp'});
}
export function orientWebp(image:LoadedImage,orientation:number):LoadedImage {
 try {
  const {width:w,height:h}=image.size,display=orientation>=5?{width:h,height:w}:image.size,size=validateSize(display);
  const c=document.createElement('canvas');c.width=size.width;c.height=size.height;const ctx=c.getContext('2d');if(!ctx)throw new Error('No canvas.');
  ctx.scale(size.width/display.width,size.height/display.height);
  const matrices:Record<number,number[]>={2:[-1,0,0,1,w,0],3:[-1,0,0,-1,w,h],4:[1,0,0,-1,0,h],5:[0,1,1,0,0,0],6:[0,1,-1,0,h,0],7:[0,-1,-1,0,h,w],8:[0,-1,1,0,0,w]};
  const [a,b,d,e,x,y]=matrices[orientation];ctx.transform(a,b,d,e,x,y);ctx.drawImage(image.source,0,0);
  let disposed=false;return {kind:'image',source:c,size,resized:image.resized||size.width!==display.width||size.height!==display.height,dispose(){if(!disposed){disposed=true;c.width=0;c.height=0;}}};
 } finally {image.dispose();}
}
