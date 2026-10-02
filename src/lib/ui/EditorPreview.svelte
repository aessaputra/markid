<script lang="ts">
 import { untrack } from 'svelte';
 import type { LoadedImage, Watermark, Point } from '../editor/types';
 import { createPreviewCache, drawPreview, type PreviewCache } from '../editor/preview';
 import { renderWatermark } from '../editor/watermark';
 import { toImagePoint, clampImagePoint } from '../editor/geometry';
 let { image, mark, onposition, onerror, disabled=false }: { image: LoadedImage; mark: Watermark; disabled?:boolean; onposition: (point: Point) => void; onerror: (error: string) => void } = $props();
 let canvas: HTMLCanvasElement;
 let viewport = $state({width:1,height:1});
 let cache = $state.raw<PreviewCache | null>(null);
 let bitmap = $state.raw<ImageBitmap | null>(null);
 let pointer: number | null = null;
 const text = $derived(mark.text);
 const fontFamily = $derived(mark.fontFamily);
 const sizeRatio = $derived(mark.sizeRatio);
 const color = $derived(mark.color);
 function measure(node: HTMLCanvasElement) {
   const observer = new ResizeObserver(([entry]) => { viewport={width:Math.max(1,entry.contentRect.width),height:Math.max(1,entry.contentRect.height)}; });
   observer.observe(node);
   return {destroy() {observer.disconnect(); node.width=node.height=0;}};
 }
 $effect(() => {
   const source=image, size={...viewport}, dpr=window.devicePixelRatio || 1;
   let stale=false, owned: PreviewCache | null=null;
   cache=null;
   createPreviewCache(source,size,dpr).then(value => { if(stale) value.dispose(); else {owned=value;cache=value;} }).catch(() => { if(!stale) onerror('Could not process this file. Try a smaller one.'); });
   return () => {stale=true;owned?.dispose();};
 });
 $effect(() => {
   // Position/opacity/angle only change composition, not the text asset.
   const style={text,fontFamily,sizeRatio,color};
   const snapshot={...untrack(() => mark),...style};
   const area=image.size;
   let stale=false, owned: ImageBitmap | null=null;
   bitmap=null;
   renderWatermark(snapshot,area).then(value => {if(stale) value.close();else {owned=value;bitmap=value;}}).catch(() => {if(!stale) onerror('Watermark font could not be loaded.');});
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
 function move(event: PointerEvent) {
   if(disabled) return;
   if(pointer!==event.pointerId) return;
   const bounds=canvas.getBoundingClientRect();
   const point=clampImagePoint(toImagePoint({x:event.clientX-bounds.left,y:event.clientY-bounds.top},image.size,viewport),image.size);
   onposition(point);
 }
 function end(event: PointerEvent) {
   if(pointer!==event.pointerId) return;
   pointer=null;
   if(canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
 }
</script>
<canvas bind:this={canvas} use:measure aria-label="Image preview" data-image-width={image.size.width} data-image-height={image.size.height} class="editor-canvas" onpointerdown={event => {if(disabled || event.button!==0) return; pointer=event.pointerId;canvas.setPointerCapture(pointer);move(event);}} onpointermove={move} onpointerup={end} onpointercancel={end} onlostpointercapture={end}>Image preview. Use Position controls to move the watermark.</canvas>
<p class="text-sm text-muted">Drag to move the watermark, or use Position in More options.</p>
