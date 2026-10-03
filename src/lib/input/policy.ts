export function checkFileSize(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error('Empty file.');
}
