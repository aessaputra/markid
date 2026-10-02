import type { ImagePolicy, Size } from '../editor/types';
/** Working experiment only; physical-device release validation is outstanding. */
export const experimentPolicy: ImagePolicy = { maxSide: 4096, maxPixels: 8_000_000 };
export function checkFileSize(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error('Empty file.');
  if (bytes > 10_000_000) throw new Error('File exceeds 10 MB.');
}
