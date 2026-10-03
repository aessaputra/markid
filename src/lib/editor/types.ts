export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/** x/y: normalized display coordinates with a center anchor. Angle: clockwise degrees. */
export type Watermark = {
  text: string;
  sizeRatio: number;
  x: number;
  y: number;
  angle: number;
  opacity: number;
  color: string;
};

/** Decoded sources are orientation-normalized; renderers must not reapply EXIF. */
export type LoadedImage = {
  kind: 'image';
  size: Size;
  source: CanvasImageSource;
  resized: boolean;
  dispose(): void;
};

export type LoadedPdf = {kind:'pdf'; bytes:Uint8Array; pageCount:number; dispose():void};
export type LoadedSource = LoadedImage | LoadedPdf;

export type ExportResult = {
  pdf?: LoadedPdf;
  blob: Blob;
  kind: 'image' | 'pdf';
  size?: Size;
  dispose(): void;
};
