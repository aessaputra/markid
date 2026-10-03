<script lang="ts">
 import type {LoadedPdf,LoadedImage,Watermark,Point,Size} from '../editor/types';
 import {previewPdf} from '../pdf/preview';
 import EditorPreview from './EditorPreview.svelte';
 import PdfPager from './PdfPager.svelte';
 let {pdf,mark=null,disabled=false,onposition=()=>{},onsize=()=>{},onerror=()=>{},onready=()=>{},onwatermark=()=>{}}:{pdf:LoadedPdf;mark?:Watermark|null;disabled?:boolean;onposition?:(point:Point)=>void;onsize?:(sizeRatio:number)=>void;onerror?:(message:string)=>void;onready?:()=>void;onwatermark?:(info:{image:Size;watermark:Size|null})=>void}=$props();
 let pageIndex=$state(0),image=$state.raw<LoadedImage|null>(null),loading=$state(false);
 let display=$state<Size|null>(null);
 function measure(node:HTMLDivElement) {
  const observer=new ResizeObserver(([entry])=>{
   const next={width:entry.contentRect.width,height:entry.contentRect.height};
   if(next.width>0 && next.height>0 && (!display || Math.abs(display.width-next.width)>.5 || Math.abs(display.height-next.height)>.5)) display=next;
  });
  observer.observe(node);return {destroy(){observer.disconnect();}};
 }
 $effect(()=>{
  const source=pdf,index=pageIndex,size=display;let stale=false,owned:LoadedImage|null=null;
  if(!size)return;
  image=null;loading=true;
  previewPdf(source,index,size).then(value=>{if(stale)value.dispose();else{owned=value;image=value;loading=false;onready();}}).catch(()=>{if(!stale){loading=false;onerror('Could not process this file. Try a smaller one.');}});
  return ()=>{stale=true;owned?.dispose();};
 });
</script>
<PdfPager {pageIndex} pageCount={pdf.pageCount} disabled={disabled || loading} onchange={index=>pageIndex=index} />
<div class="pdf-viewport" use:measure>
{#if image}
 {#if mark}<EditorPreview {image} {mark} {disabled} {onsize} onwatermark={onwatermark} onposition={p => { if (mark?.mode !== 'tiled') onposition({ x: p.x / image!.size.width, y: p.y / image!.size.height }); }} {onerror} />
 {:else}<canvas aria-label="Final PDF preview" class="h-full w-full object-contain" use:paint={image}>Final PDF preview</canvas>{/if}
{:else}<p>Loading…</p>{/if}
</div>
<script lang="ts" module>
 function paint(node:HTMLCanvasElement,image:LoadedImage){node.width=Math.ceil(image.size.width);node.height=Math.ceil(image.size.height);node.getContext('2d')?.drawImage(image.source,0,0);return {destroy(){node.width=node.height=0;}};}
</script>
