<script lang="ts">
 import { onDestroy, onMount, untrack } from 'svelte';
 import type { LoadedImage, Watermark, Point } from '../editor/types';
 import { createPreviewCache, drawPreview, type PreviewCache } from '../editor/preview';
 import { renderWatermark } from '../editor/watermark';
 import { containTransform, toImagePoint, clampImagePoint } from '../editor/geometry';
 let { image, mark, onposition, onsize, onerror, disabled=false }: { image: LoadedImage; mark: Watermark; disabled?:boolean; onposition: (point: Point) => void; onsize: (sizeRatio: number) => void; onerror: (error: string) => void } = $props();
 let canvas: HTMLCanvasElement;
 let viewport = $state({width:1,height:1});
 let dpr=$state(window.devicePixelRatio || 1);
 onMount(()=>{
  let query:MediaQueryList;
  function refresh(){query?.removeEventListener('change',refresh);dpr=window.devicePixelRatio || 1;query=matchMedia(`(resolution: ${dpr}dppx)`);query.addEventListener('change',refresh);}
  refresh();window.addEventListener('resize',refresh);
  return ()=>{query.removeEventListener('change',refresh);window.removeEventListener('resize',refresh);};
 });
 let cache = $state.raw<PreviewCache | null>(null);
 let bitmap = $state.raw<ImageBitmap | null>(null);
 let frame: HTMLDivElement;
 let gesture: {id:number; mode:'move'|'resize'; center:Point; offset:Point; distance:number; size:number} | null = null;
 const projection = $derived(containTransform(image.size, viewport));
 const selection = $derived(bitmap && mark.text.trim() ? {
   x:projection.x + mark.x * image.size.width * projection.scale,
   y:projection.y + mark.y * image.size.height * projection.scale,
   width:bitmap.width * projection.scale, height:bitmap.height * projection.scale,
 } : null);
 function cleanup() {
   const active=gesture;gesture=null;
   if(active && frame?.hasPointerCapture(active.id)) frame.releasePointerCapture(active.id);
 }
 onDestroy(cleanup);
 $effect(() => { void disabled; void image; untrack(cleanup); });
 const text = $derived(mark.text);
 const sizeRatio = $derived(mark.sizeRatio);
 const color = $derived(mark.color);
 function measure(node: HTMLCanvasElement) {
   const observer = new ResizeObserver(([entry]) => { viewport={width:Math.max(1,entry.contentRect.width),height:Math.max(1,entry.contentRect.height)}; });
   observer.observe(node);
   return {destroy() {observer.disconnect(); node.width=node.height=0;}};
 }
 $effect(() => {
   const source=image, size={...viewport}, pixelRatio=dpr;
   let stale=false, owned: PreviewCache | null=null;
   cache=null;
   createPreviewCache(source,size,pixelRatio).then(value => { if(stale) value.dispose(); else {owned=value;cache=value;} }).catch(() => { if(!stale) onerror('Could not process this file. Try a smaller one.'); });
   return () => {stale=true;owned?.dispose();};
 });
 $effect(() => {
   // Position/opacity/angle only change composition, not the text asset.
   const style={text,sizeRatio,color};
   const snapshot={...untrack(() => mark),...style};
   const area=image.size;
   let stale=false, owned: ImageBitmap | null=null;
   bitmap=null;
   renderWatermark(snapshot,area).then(value => {if(stale) value.close();else {owned=value;bitmap=value;}}).catch(() => {if(!stale) onerror('Watermark could not be rendered.');});
   return () => {stale=true;owned?.close();};
 });
 $effect(() => {
   const source=cache, asset=bitmap, snapshot={...mark};
   if(!canvas) return;
   // Invalidate stale source/mark pixels even while the next cache is pending.
   if(!source) {canvas.width=canvas.height=0;return;}
   // A pending/failed watermark must never hide the successfully loaded source.
   canvas.width=Math.ceil(source.viewport.width*source.dpr);canvas.height=Math.ceil(source.viewport.height*source.dpr);
   const ctx=canvas.getContext('2d');
   if(ctx) drawPreview(ctx,source,asset,snapshot);
 });
 function point(event:PointerEvent):Point {
   const bounds=canvas.getBoundingClientRect();
   return toImagePoint({x:event.clientX-bounds.left,y:event.clientY-bounds.top},image.size,viewport);
 }
 function start(event:PointerEvent) {
   if(disabled || gesture || event.button!==0 || !selection) return;
   const p=point(event), center={x:mark.x*image.size.width,y:mark.y*image.size.height};
   const target=event.target as HTMLElement;
   gesture={id:event.pointerId,mode:target.closest('.resize-handle')?'resize':'move',center,
     offset:{x:p.x-center.x,y:p.y-center.y},distance:Math.max(.001,Math.hypot(p.x-center.x,p.y-center.y)),size:mark.sizeRatio};
   frame.setPointerCapture(event.pointerId);event.preventDefault();
 }
 function move(event: PointerEvent) {
   if(disabled) {cleanup();return;}
   const active=gesture;if(!active || active.id!==event.pointerId) return;
   const p=point(event);
   if(active.mode==='resize') onsize(Math.max(.01,Math.min(.20,active.size*Math.hypot(p.x-active.center.x,p.y-active.center.y)/active.distance)));
   else onposition(clampImagePoint({x:p.x-active.offset.x,y:p.y-active.offset.y},image.size));
   event.preventDefault();
 }
 function end(event: PointerEvent) {
   if(gesture?.id===event.pointerId) cleanup();
 }
</script>
<div bind:this={frame} class="preview-frame" role="group" aria-label="Watermark preview" onpointermove={move} onpointerup={end} onpointercancel={end} onlostpointercapture={end}>
 <canvas bind:this={canvas} use:measure aria-label="Image preview" data-image-width={image.size.width} data-image-height={image.size.height} class="editor-canvas">Image preview. Use Position and Size controls to adjust the watermark.</canvas>
 {#if selection}
 <div class="watermark-selection" class:locked={disabled} aria-hidden="true" onpointerdown={start} style={`left:${selection.x}px;top:${selection.y}px;width:${selection.width}px;height:${selection.height}px;transform:translate(-50%,-50%) rotate(${mark.angle}deg)`}>
  {#each ['nw','ne','sw','se'] as corner (corner)}<span class={`resize-handle ${corner}`} data-corner={corner}></span>{/each}
 </div>
 {/if}
</div>
<p class="text-sm text-muted">Drag the watermark to move it; drag a corner to resize. Or use Position and Size below.</p>
