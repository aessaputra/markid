import { expect, test, vi } from 'vitest';
import { fitWorkingSize } from '../../src/lib/image/load';
import { checkFileSize } from '../../src/lib/input/policy';
import { identify } from '../../src/lib/input/identify';
import { readFileSync } from 'node:fs';
import { readDimensions, readOrientation } from '../../src/lib/input/headers';
const jpg = (marker = 0xc0, w = 4000, h = 3000) => new Blob([new Uint8Array([255,216,255,224,0,4,0,0,255,255,marker,0,11,8,h>>8,h&255,w>>8,w&255,1,1,17,0])], {type:'text/plain'});
test('signature beats MIME and JPEG frames have dimensions', async () => {
  for (const m of [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]) {
    expect(await identify(jpg(m))).toBe('jpeg');
    expect(await readDimensions(jpg(m),'jpeg')).toEqual({width:4000,height:3000});
  }
  await expect(identify(new Blob(['not jpeg'],{type:'image/jpeg'}))).rejects.toThrow('Unsupported format.');
  await expect(identify(new Blob([new Uint8Array([0,0,0,24,102,116,121,112,109,105,102,49])]))).rejects.toThrow();
});

test('working target accepts normal large sources and rejects unsafe arithmetic', () => {
  for (const size of [{width:4000,height:3000},{width:8000,height:6000},{width:65535,height:65535}]) {
    const out = fitWorkingSize(size,{maxSide:4096,maxPixels:8_000_000});
    expect(out.width).toBeLessThanOrEqual(4096);
    expect(out.width*out.height).toBeLessThanOrEqual(8_000_000);
    expect(out.height).toBe(Math.floor(size.height*Math.min(1,4096/size.width,4096/size.height,Math.sqrt(8_000_000/(size.width*size.height)))));
  }
  expect(fitWorkingSize({width:1,height:65535},{maxSide:4096,maxPixels:8_000_000})).toEqual({width:1,height:4096});
  for (const size of [{width:0,height:1},{width:Infinity,height:1},{width:2**32,height:2**32}]) expect(() => fitWorkingSize(size,{maxSide:4096,maxPixels:8_000_000})).toThrow();
  for (const policy of [{maxSide:0,maxPixels:1},{maxSide:1,maxPixels:NaN},{maxSide:1.5,maxPixels:1}]) expect(() => fitWorkingSize({width:1,height:1},policy)).toThrow();
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
test('decimal 10 MB boundary', () => {
  expect(() => checkFileSize(10_000_000)).not.toThrow();
  expect(() => checkFileSize(10_000_001)).toThrow('File exceeds 10 MB.');
  for (const n of [0, -1, NaN, Infinity, 1.5]) expect(() => checkFileSize(n)).toThrow();
});
