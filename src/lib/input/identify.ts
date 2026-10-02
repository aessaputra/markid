export type InputFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'heif' | 'pdf';
export const pngSignature = [137,80,78,71,13,10,26,10];
/** Only proven Stage A formats are identified here; BMFF/WebP/PDF await their adapters. */
export async function identify(file: Blob): Promise<InputFormat> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'jpeg';
  if (pngSignature.every((n,i) => b[i] === n)) return 'png';
  throw new Error('Unsupported format.');
}
