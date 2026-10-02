import type { LoadedImage } from './types';
/** Owns successful resources; pending decoders retain their resources until settled. */
export class ImageController {
  current: LoadedImage | null = null;
  revision = 0;
  loading = false;
  error = '';
  private disposed = false;
  constructor(private readonly loader: (file:File)=>Promise<LoadedImage>, private readonly changed: ()=>void = ()=>{}) {}
  async replace(file: File): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.revision;
    this.loading = true; this.error = ''; this.changed();
    try {
      const next = await this.loader(file);
      if (this.disposed || revision !== this.revision) { next.dispose(); return; }
      const old = this.current;
      this.current = next;
      old?.dispose();
    } catch (error) {
      if (!this.disposed && revision === this.revision) this.error = error instanceof Error ? error.message : 'Could not open this file. Try a JPG or PNG.';
    } finally {
      if (!this.disposed && revision === this.revision) { this.loading = false; this.changed(); }
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; ++this.revision; this.loading = false;
    this.current?.dispose(); this.current = null;
  }
}
