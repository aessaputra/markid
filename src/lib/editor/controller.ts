import type { ExportResult, LoadedSource, Watermark } from './types';
/** Snapshot/revision ownership; stale finalizers cannot clear a newer job. */
export class ExportController<T extends LoadedSource = LoadedSource> {
 result:ExportResult | null=null;
 processing=false;
 error='';
 revision=0;
 private disposed=false;
 constructor(private readonly exporter:(image:T,mark:Watermark,options:{revision:number})=>Promise<ExportResult>,private readonly changed:()=>void=()=>{}) {}
 invalidate():void {++this.revision;this.result?.dispose();this.result=null;this.error='';this.changed();}
 async prepare(image:T,mark:Watermark):Promise<void> {
  if(this.disposed || this.processing || !mark.text.trim()) return;
  this.invalidate();const revision=this.revision;
  this.processing=true;this.changed();
  try {
   const result=await this.exporter(image,{...mark},{revision});
   if(this.disposed || revision!==this.revision) {result.dispose();return;}
   this.result=result;
  } catch(error) {
   if(!this.disposed && revision===this.revision) this.error=error instanceof Error?error.message:'Export failed. Try again.';
  } finally {
   // Invalidation changes ownership, not execution: only settlement releases the lock.
   this.processing=false;
   if(!this.disposed) this.changed();
  }
 }
 dispose():void {if(this.disposed)return;this.disposed=true;this.invalidate();}
}
/** Owns successful resources; pending decoders retain their resources until settled. */
export class ImageController {
  current: LoadedSource | null = null;
  revision = 0;
  loading = false;
  error = '';
  private disposed = false;
  constructor(private readonly loader: (file:File)=>Promise<LoadedSource>, private readonly changed: ()=>void = ()=>{}) {}
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
