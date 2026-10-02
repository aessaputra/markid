import type { Size } from '../editor/types';
const failure=()=>new Error('Could not open this file. Try a JPG or PNG.');
export const fourcc=(d:DataView,o:number)=>String.fromCharCode(...new Uint8Array(d.buffer,d.byteOffset+o,4));
async function read(f:Blob,o:number,n:number){if(o<0 || o+n>f.size || n>65536)throw failure();return new DataView(await f.slice(o,o+n).arrayBuffer());}
/** Bounded metadata probe, not a container decoder. Unsupported layouts fail closed. */
export async function brands(f:Blob):Promise<string[]> {
 const h=await read(f,0,16), n=h.getUint32(0);
 if(fourcc(h,4)!=='ftyp'||n<16||n>4096||n>f.size||(n-16)%4)throw failure();
 const b=await read(f,0,n),out=[fourcc(b,8)];for(let o=16;o<n;o+=4)out.push(fourcc(b,o));return out;
}
export async function webpSize(f:Blob):Promise<Size>{
 const h=await read(f,0,12);if(h.getUint32(4,true)+8!==f.size)throw failure();
 let size:Size|undefined, count=0;
 for(let o=12;o<f.size;){
  if(++count>4096)throw failure();const h=await read(f,o,8),n=h.getUint32(4,true),type=fourcc(h,0);if(o+8+n+(n%2)>f.size)throw failure();
  if(type==='ANIM'||type==='ANMF')throw failure();
  if(type==='VP8X'){if(n!==10)throw failure();const d=await read(f,o+8,10);if(d.getUint8(0)&2)throw failure();const u=(i:number)=>d.getUint8(i)+256*d.getUint8(i+1)+65536*d.getUint8(i+2);size={width:1+u(4),height:1+u(7)};}
  if(type==='VP8 '&&!size){if(n<10)throw failure();const d=await read(f,o+8,10);if(d.getUint8(3)!==157||d.getUint8(4)!==1||d.getUint8(5)!==42)throw failure();size={width:d.getUint16(6,true)&16383,height:d.getUint16(8,true)&16383};}
  if(type==='VP8L'&&!size){if(n<5)throw failure();const d=await read(f,o+8,5);if(d.getUint8(0)!==47)throw failure();const bits=d.getUint32(1,true);size={width:1+(bits&16383),height:1+((bits>>>14)&16383)};}
  o+=8+n+(n%2);
 }
 if(!size)throw failure();return size;
}
export async function bmffSize(f:Blob):Promise<Size>{
 const b=await brands(f);if(b.some(x=>['avis','msf1','hevc','hevx'].includes(x)))throw failure();
 let boxes=0,visible=0,size:Size|undefined;
 async function walk(start:number,end:number,depth:number):Promise<void>{
  if(depth>5)throw failure();
  for(let o=start;o<end;){
   if(++boxes>4096)throw failure();const h=await read(f,o,8),n=h.getUint32(0),t=fourcc(h,4);
   // Deliberately no extended/zero-sized boxes: bounded selected still subset.
   if(n<8||o+n>end)throw failure();const p=o+8;
   if(t==='meta')await walk(p+4,o+n,depth+1);
   else if(t==='iprp'||t==='ipco')await walk(p,o+n,depth+1);
   else if(t==='iinf'){const d=await read(f,p,8);const v=d.getUint8(0);if(v>1)throw failure();await walk(p+(v===0?6:8),o+n,depth+1);}
   else if(t==='infe'){const d=await read(f,p,4);if(d.getUint8(0)<2||d.getUint8(0)>3)throw failure();if(!(d.getUint32(0)&1))visible++;}
   else if(t==='ispe'){if(n!==20)throw failure();const d=await read(f,p,12);const s={width:d.getUint32(4),height:d.getUint32(8)};if(!size||s.width*s.height>size.width*size.height)size=s;}
   o+=n;
  }
 }
 await walk(0,f.size,0);if(!size||visible!==1)throw failure();return size;
}
