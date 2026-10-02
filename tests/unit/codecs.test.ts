import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { identify } from '../../src/lib/input/identify';
import { readDimensions } from '../../src/lib/input/headers';
const fixture=(name:string)=>new Blob([readFileSync(`tests/fixtures/codecs/${name}`)]);
for(const [name,format,size] of [['lossy.webp','webp',[320,240]],['lossless.webp','webp',[320,240]],['still.avif','avif',[320,240]],['encoded.heic','heif',[320,240]],['portrait.heif','heif',[240,320]]] as const) {
 test(`signature and dimensions ${name}`,async()=>{const f=fixture(name);expect(await identify(f)).toBe(format);expect(await readDimensions(f,format)).toEqual({width:size[0],height:size[1]});});
}
test('static scope rejects animated WebP and HEIF collection',async()=>{for(const name of ['animated.webp','collection.heif']) {const f=fixture(name);await expect(readDimensions(f,await identify(f))).rejects.toThrow();}});
test('AVIF compatible brand never routes to HEVC; generic BMFF is unsupported',async()=>{const avif=new Uint8Array(await fixture('still.avif').arrayBuffer());avif.set(new TextEncoder().encode('heic'),8);expect(await identify(new Blob([avif]))).toBe('avif');const generic=new Uint8Array(20);new DataView(generic.buffer).setUint32(0,20);generic.set(new TextEncoder().encode('ftypmif1'),4);generic.set(new TextEncoder().encode('mif1'),16);await expect(identify(new Blob([generic]))).rejects.toThrow('Unsupported format.');});
test('oversized metadata and invalid RIFF lengths reject',async()=>{const bmff=new Uint8Array(await fixture('encoded.heic').arrayBuffer());new DataView(bmff.buffer).setUint32(0,65536);await expect(identify(new Blob([bmff]))).rejects.toThrow();const webp=new Uint8Array(await fixture('lossy.webp').arrayBuffer());new DataView(webp.buffer).setUint32(4,0xffffffff,true);await expect(readDimensions(new Blob([webp]),'webp')).rejects.toThrow();});
test('truncated and overflow containers fail closed',async()=>{for(const name of ['lossy.webp','still.avif','encoded.heic']) {const f=fixture(name);await expect(readDimensions(f.slice(0,35),await identify(f))).rejects.toThrow();}});
