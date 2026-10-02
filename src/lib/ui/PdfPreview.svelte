<script lang="ts">
 import type {LoadedPdf,LoadedImage,Watermark,Point} from '../editor/types';
 import {previewPdf} from '../pdf/preview';
 import EditorPreview from './EditorPreview.svelte';
 import PdfPager from './PdfPager.svelte';
 let {pdf,mark=null,disabled=false,onposition=()=>{},onerror=()=>{},onready=()=>{}}:{pdf:LoadedPdf;mark?:Watermark|null;disabled?:boolean;onposition?:(point:Point)=>void;onerror?:(message:string)=>void;onready?:()=>void}=$props();
 let pageIndex=$state(0),image=$state.raw<LoadedImage|null>(null),loading=$state(false);
 $effect(()=>{
  const source=pdf,index=pageIndex;let stale=false,owned:LoadedImage|null=null;
  image=null;loading=true;
  previewPdf(source,index).then(value=>{if(stale)value.dispose();else{owned=value;image=value;loading=false;onready();}}).catch(()=>{if(!stale){loading=false;onerror('Could not process this file. Try a smaller one.');}});
  return ()=>{stale=true;owned?.dispose();};
 });
</script>
<PdfPager {pageIndex} pageCount={pdf.pageCount} disabled={disabled || loading} onchange={index=>pageIndex=index} />
{#if image}
 {#if mark}<EditorPreview {image} {mark} {disabled} onposition={p=>onposition({x:p.x/image!.size.width,y:p.y/image!.size.height})} {onerror} />
 {:else}<canvas aria-label="Final PDF preview" class="max-h-[65vh] max-w-full object-contain" use:paint={image}>Final PDF preview</canvas>{/if}
{:else}<p>Loading…</p>{/if}
<script lang="ts" module>
 function paint(node:HTMLCanvasElement,image:LoadedImage){node.width=Math.ceil(image.size.width);node.height=Math.ceil(image.size.height);node.getContext('2d')?.drawImage(image.source,0,0);return {destroy(){node.width=node.height=0;}};}
</script>
