import type { Size } from '../editor/types';
import { identify } from './identify';
import { webpSize, bmffSize } from './containers';
const invalid = () => new Error('Could not open this file. Try a JPG or PNG.');
export function validateSize(size: Size): Size {
  const { width, height } = size;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || !Number.isSafeInteger(width * height)) throw invalid();
  return size;
}
async function bytes(file: Blob, offset: number, length: number): Promise<DataView> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + length > file.size) throw invalid();
  return new DataView(await file.slice(offset, offset + length).arrayBuffer());
}
const frames = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
/** ITU T.81 Annex B: segment length includes its two length bytes, not marker. */
export async function readDimensions(file: Blob, format: string): Promise<Size> {
  if (await identify(file) !== format) throw invalid();
  if (format === 'webp') return validateSize(await webpSize(file));
  if (format === 'avif' || format === 'heif') return validateSize(await bmffSize(file));
  if (format === 'png') {
    const d = await bytes(file, 8, 25);
    if (d.getUint32(0) !== 13 || d.getUint32(4) !== 0x49484452) throw invalid();
    const size = validateSize({width:d.getUint32(8), height:d.getUint32(12)});
    if (size.width > 0x7fffffff || size.height > 0x7fffffff) throw invalid();
    const depth = d.getUint8(16), color = d.getUint8(17);
    const depths: Record<number, number[]> = {0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
    if (!depths[color]?.includes(depth) || d.getUint8(18) !== 0 || d.getUint8(19) !== 0 || d.getUint8(20) > 1) throw invalid();
    return size;
  }
  for await (const segment of jpegSegments(file)) {
    if (frames.has(segment.marker)) {
      const d = await bytes(file, segment.offset, segment.length);
      if (segment.length < 11 || d.getUint8(7) === 0 || segment.length !== 8 + 3 * d.getUint8(7)) throw invalid();
      return validateSize({width:d.getUint16(5),height:d.getUint16(3)});
    }
  }
  throw invalid();
}
async function* jpegSegments(file: Blob) {
  let offset = 2;
  // Reads are bounded (<=65535 bytes), never materialize compressed pixel data.
  while (offset < file.size) {
    if ((await bytes(file, offset++, 1)).getUint8(0) !== 255) throw invalid();
    let marker: number;
    do { marker = (await bytes(file, offset++, 1)).getUint8(0); } while (marker === 255);
    if (marker === 0 || marker === 216) throw invalid();
    if (marker === 217 || marker === 218) return;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = (await bytes(file, offset, 2)).getUint16(0);
    if (length < 2 || offset + length > file.size) throw invalid();
    yield {marker, offset, length};
    offset += length;
  }
}
/** TIFF offsets are relative to its header (PNG eXIf omits JPEG's Exif ID). */
async function tiffOrientation(file: Blob, base: number, length: number): Promise<number> {
  const read = (offset: number, count: number) => {
    if (offset < 0 || offset + count > length) throw invalid();
    return bytes(file, base + offset, count);
  };
  const header = await read(0, 8);
  const order = header.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) throw invalid();
  const le = order === 0x4949;
  if (header.getUint16(2, le) !== 42) throw invalid();
  const ifd = header.getUint32(4, le);
  if (ifd < 8) throw invalid();
  const count = (await read(ifd, 2)).getUint16(0, le);
  if (ifd + 2 + count * 12 + 4 > length) throw invalid();
  // Scan bounded blocks; never read thumbnails, IFD chains or compressed pixels.
  for (let i = 0; i < count; i += 5461) {
    const block = await read(ifd + 2 + i * 12, Math.min(count - i, 5461) * 12);
    for (let o = 0; o < block.byteLength; o += 12) {
      if (block.getUint16(o, le) !== 0x112) continue;
      if (block.getUint16(o + 2, le) !== 3 || block.getUint32(o + 4, le) !== 1) throw invalid();
      const orientation = block.getUint16(o + 8, le);
      if (orientation < 1 || orientation > 8) throw invalid();
      return orientation;
    }
  }
  return 1;
}
/** Reads IFD0 orientation only, never transforms pixels. Invalid metadata fails closed. */
export async function readOrientation(file: Blob, format: string): Promise<number> {
  if (format === 'png') {
    if (await identify(file) !== 'png') throw invalid();
    let offset = 8, orientation = 1, seen = false;
    // PNG chunks: length + type + data + CRC. Skip pixel payloads by offset.
    while (offset < file.size) {
      const header = await bytes(file, offset, 8);
      const length = header.getUint32(0), type = header.getUint32(4);
      const end = offset + 12 + length;
      if (length > 0x7fffffff || end > file.size) throw invalid();
      if (type === 0x65584966) {
        if (seen) throw invalid(); // PNG permits exactly one eXIf.
        seen = true;
        orientation = await tiffOrientation(file, offset + 8, length);
      }
      if (type === 0x49454e44) {
        if (length !== 0) throw invalid();
        return orientation;
      }
      offset = end;
    }
    throw invalid();
  }
  if (format !== 'jpeg') return 1;
  for await (const s of jpegSegments(file)) {
    if (s.marker !== 0xe1) continue;
    const d = await bytes(file, s.offset, s.length);
    if (d.byteLength < 8 || d.getUint32(2) !== 0x45786966 || d.getUint16(6) !== 0) continue;
    return tiffOrientation(file, s.offset + 8, s.length - 8);
  }
  return 1;
}
