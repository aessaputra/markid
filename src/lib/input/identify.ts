import { brands } from './containers';
export type InputFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'heif' | 'pdf';
const pngSignature = [137,80,78,71,13,10,26,10];
/** Signatures only: recognized containers still require bounded metadata and decode validation. */
export async function identify(file: Blob): Promise<InputFormat> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...b.slice(0,5)) === '%PDF-') return 'pdf';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'jpeg';
  if (pngSignature.every((n,i) => b[i] === n)) return 'png';
  if (String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP') return 'webp';
  if (String.fromCharCode(...b.slice(4,8)) === 'ftyp') {
    const names=await brands(file);
    if(names.includes('avif') || names.includes('avis')) return 'avif';
    if(names.some(n=>['heic','heix','hevc','hevx'].includes(n))) return 'heif';
  }
  throw new Error('Unsupported format.');
}
