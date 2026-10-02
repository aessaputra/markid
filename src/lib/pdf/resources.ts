import manifest from './resource-manifest.json';
/** PDF.js may swallow factory errors; retain them independently of its promise. */
export function requiredResources(){
 let failure:unknown;
 async function read(path:string){
  try{
   const expected=manifest[path as keyof typeof manifest];if(!expected)throw new Error('Unknown PDF resource.');
   const response=await fetch(`/pdf-assets/${path}`,{cache:'no-store'});if(!response.ok)throw new Error('Missing PDF resource.');
   const data=new Uint8Array(await response.arrayBuffer());
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
   if(data.length!==expected.size||digest!==expected.sha256)throw new Error('Invalid PDF resource.');
   return data;
  }catch(error){failure=error;throw error;}
 }
 return {
  assert(){if(failure)throw new Error('Required PDF rendering resource failed.',{cause:failure});},
  StandardFontDataFactory:class {async fetch({filename}:{filename:string}){return read(`standard_fonts/${filename}`);}},
  CMapReaderFactory:class {async fetch({name}:{name:string}){return {cMapData:await read(`cmaps/${name}.bcmap`),compressionType:1};}},
 };
}
