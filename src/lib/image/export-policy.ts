export const EXPORT_ERROR = 'Export failed. Try again.';
export function assertJpeg(blob: Blob | null): asserts blob is Blob {
 if (!blob || blob.type !== 'image/jpeg' || blob.size === 0) throw new Error(EXPORT_ERROR);
}
