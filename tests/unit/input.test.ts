import { expect, test, vi } from 'vitest';
import { validateSize, readDimensions, readOrientation } from '../../src/lib/input/headers';
import { checkFileSize } from '../../src/lib/input/policy';
import { identify } from '../../src/lib/input/identify';
import { readFileSync } from 'node:fs';
const jpg = (marker = 0xc0, w = 4000, h = 3000) => new Blob([new Uint8Array([255,216,255,224,0,4,0,0,255,255,marker,0,11,8,h>>8,h&255,w>>8,w&255,1,1,17,0])], {type:'text/plain'});
test('signature beats MIME and JPEG frames have dimensions', async () => {
  for (const m of [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]) {
    expect(await identify(jpg(m))).toBe('jpeg');
    expect(await readDimensions(jpg(m),'jpeg')).toEqual({width:4000,height:3000});
  }
  await expect(identify(new Blob(['not jpeg'],{type:'image/jpeg'}))).rejects.toThrow('Unsupported format.');
  await expect(identify(new Blob([new Uint8Array([0,0,0,24,102,116,121,112,109,105,102,49])]))).rejects.toThrow();
});

test('original normalized dimensions are preserved and unsafe arithmetic rejected', () => {
 for(const size of [{width:4000,height:3000},{width:8000,height:6000},{width:1,height:65535}]) expect(validateSize(size)).toEqual(size);
 for(const size of [{width:0,height:1},{width:Infinity,height:1},{width:2**32,height:2**32}]) expect(()=>validateSize(size)).toThrow();
});
test('PNG IHDR validates coding fields before decode', async () => {
  const valid = new Uint8Array(readFileSync('tests/fixtures/images/alpha.png'));
  expect(await identify(new Blob([valid],{type:'image/jpeg'}))).toBe('png');
  expect(await readDimensions(new Blob([valid]),'png')).toEqual({width:32,height:24});
  for (const [offset,value] of [[24,3],[25,7],[26,1],[27,1],[28,2]]) {
    const bad=valid.slice(); bad[offset]=value;
    await expect(readDimensions(new Blob([bad]),'png')).rejects.toThrow();
  }
});
test('truncated and malformed JPEG/PNG dimensions fail before allocation', async () => {
  const j = new Uint8Array(await jpg().arrayBuffer());
  for (const cut of [0,2,4,5,8,12,17,21]) await expect(readDimensions(new Blob([j.slice(0,cut)]),'jpeg')).rejects.toThrow();
  for (const [offset,value] of [[4,0xff],[5,1],[12,1],[18,0]]) {
    const b=j.slice(); b[offset]=value;
    await expect(readDimensions(new Blob([b]),'jpeg')).rejects.toThrow();
  }
  const png=new Uint8Array(readFileSync('tests/fixtures/images/alpha.png'));
  for(const cut of [8,16,24,32]) await expect(readDimensions(new Blob([png.slice(0,cut)]),'png')).rejects.toThrow();
  for(const value of [0,0xffffffff,0x7fffffff]) {
    const b=png.slice();const d=new DataView(b.buffer);d.setUint32(16,value);d.setUint32(20,value);
    await expect(readDimensions(new Blob([b]),'png')).rejects.toThrow();
  }
});
test('EXIF byte order and malformed offsets are validated', async () => {
  for(let n=1;n<=8;n++) expect(await readOrientation(new Blob([readFileSync(`tests/fixtures/images/exif-${n}.jpg`)]),'jpeg')).toBe(n);
  const exif = new Uint8Array(readFileSync('tests/fixtures/images/exif-1.jpg'));
  // Find Exif signature, then corrupt TIFF IFD0 offset (Pillow emits big endian).
  const start=exif.findIndex((v,i)=>v===69 && exif[i+1]===120 && exif[i+2]===105 && exif[i+3]===102);
  const b=exif.slice(); new DataView(b.buffer).setUint32(start+10,0xffffffff);
  await expect(readOrientation(new Blob([b]),'jpeg')).rejects.toThrow();
});
test('header reads are bounded and skip APP payloads', async () => {
  const j = new Uint8Array(await jpg().arrayBuffer());
  const blob=new Blob([j.slice(0,2),new Uint8Array([255,225,255,255]),new Uint8Array(65533),j.slice(8),new Uint8Array(1_000_000)]);
  const slices=vi.spyOn(blob,'slice');
  expect(await readDimensions(blob,'jpeg')).toEqual({width:4000,height:3000});
  for(const [start,end] of slices.mock.calls) expect(Number(end)-Number(start)).toBeLessThanOrEqual(65535);
  expect(slices.mock.calls.length).toBeLessThan(20);
});
test('little-endian IFD0 orientation is read without treating offsets as big endian', async () => {
  const tiff=new Uint8Array([73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const file=new Blob([new Uint8Array([255,216,255,225,0,34,69,120,105,102,0,0]),tiff]);
  expect(await readOrientation(file,'jpeg')).toBe(6);
});
test('PNG eXIf reads all display orientations from raw TIFF, not JPEG APP1', async () => {
  for(let n=1;n<=8;n++) {
    const blob=new Blob([readFileSync(`tests/fixtures/images/exif-${n}.png`)]);
    expect(await readDimensions(blob,'png')).toEqual({width:120,height:80});
    expect(await readOrientation(blob,'png')).toBe(n);
  }
});
const pngChunk = (type: string, data: Uint8Array) => {
  const out=new Uint8Array(data.length+12); const view=new DataView(out.buffer);
  view.setUint32(0,data.length); out.set(new TextEncoder().encode(type),4); out.set(data,8);
  return out; // Unit header probes only: pixel stream/CRC validation belongs to decoder.
};
const pngMetadata = (tiff: Uint8Array, extra: Uint8Array[] = []) => new Blob([
  new Uint8Array(readFileSync('tests/fixtures/images/alpha.png')).slice(0,33),
  pngChunk('eXIf',tiff), ...extra.map(data=>new Uint8Array(data)), pngChunk('IEND',new Uint8Array()),
]);
test('PNG TIFF bounds reject malformed metadata without reading outside the chunk', async () => {
  const tiff=new Uint8Array([73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  expect(await readOrientation(pngMetadata(tiff),'png')).toBe(6);
  for (const cut of [0,1,7,8,9,21,25]) await expect(readOrientation(pngMetadata(tiff.slice(0,cut)),'png')).rejects.toThrow();
  for (const [offset,value] of [[0,0],[2,43],[4,7],[4,255],[8,255],[12,4],[14,2],[18,0],[18,9]]) {
    const bad=tiff.slice(); bad[offset]=value;
    await expect(readOrientation(pngMetadata(bad),'png')).rejects.toThrow();
  }
  await expect(readOrientation(pngMetadata(tiff,[pngChunk('eXIf',tiff)]),'png')).rejects.toThrow();
  const truncated=new Uint8Array(await pngMetadata(tiff).arrayBuffer());
  new DataView(truncated.buffer).setUint32(33,0x7fffffff);
  await expect(readOrientation(new Blob([truncated]),'png')).rejects.toThrow();
  expect(await readOrientation(new Blob([readFileSync('tests/fixtures/images/alpha.png')]),'png')).toBe(1);
});
test('PNG chunk scanning skips IDAT and unrelated metadata; TIFF reads stay bounded for large profiles', async () => {
  const tiff=new Uint8Array(1_100_000), d=new DataView(tiff.buffer);
  d.setUint16(0,0x4d4d); d.setUint16(2,42); d.setUint32(4,100_000);
  d.setUint16(100_000,6000);
  const tag=100_002+5999*12;
  d.setUint16(tag,0x112); d.setUint16(tag+2,3); d.setUint32(tag+4,1); d.setUint16(tag+8,8);
  const header=new Uint8Array(readFileSync('tests/fixtures/images/alpha.png')).slice(0,33);
  const idat=pngChunk('IDAT',new Uint8Array(1_000_000));
  const blob=new Blob([header,pngChunk('tEXt',new Uint8Array(100_000)),idat,pngChunk('eXIf',tiff),pngChunk('IEND',new Uint8Array())]);
  const slices=vi.spyOn(blob,'slice');
  expect(await readOrientation(blob,'png')).toBe(8);
  expect(slices.mock.calls.length).toBeLessThan(15);
  for(const [start,end] of slices.mock.calls) expect(Number(end)-Number(start)).toBeLessThanOrEqual(65535);
  expect(slices.mock.calls.reduce((sum,[start,end])=>sum+Number(end)-Number(start),0)).toBeLessThan(73_000);
});
test('input size has no fixed byte cap but rejects empty or invalid sizes', () => {
  for (const n of [1,10_000_000,10_000_001,100_000_000]) expect(() => checkFileSize(n)).not.toThrow();
  for (const n of [0, -1, NaN, Infinity, 1.5]) expect(() => checkFileSize(n)).toThrow();
});
