<script lang="ts">
 import type { ExportResult } from '../editor/types';
 import Button from './Button.svelte';
 import PdfPreview from './PdfPreview.svelte';
 let { result, onback, onerror = () => {}, error='' }: { result: ExportResult; onback: () => void; onerror?: (message:string)=>void; error?:string } = $props();
 let url = $state('');
 let decoded = $state(false);
 $effect(() => {
  const value=result;
  decoded=false;url='';
  const owned=URL.createObjectURL(value.blob);url=owned;
  return () => URL.revokeObjectURL(owned);
 });
 function download() {
  if(!decoded || !url) return;
  const a=document.createElement('a');a.href=url;a.download=result.kind==='pdf'?'markid.pdf':'markid.jpg';a.click();
 }
</script>
<section aria-label="Result preview" class="panel grid gap-4">
 {#if url}
  {#if result.kind==='pdf' && result.pdf}<PdfPreview pdf={result.pdf} onready={()=>decoded=true} onerror={message=>{decoded=false;onerror(message);}} />{:else}
  <img src={url} alt="Final JPEG preview" class="block h-auto max-h-[65vh] w-full rounded-lg bg-white object-contain" onload={() => decoded=true} onerror={() => {decoded=false;onerror('Export failed. Try again.');}} />
  {/if}
  <p>{result.blob.size.toLocaleString('en-US')} bytes{#if result.kind==='image'} · {result.size?.width} × {result.size?.height} px{:else} · {result.pdf?.pageCount} pages{/if}</p>
  <Button primary disabled={!decoded} onclick={download}>Download</Button>
 {/if}
 {#if error}<p role="alert">{error}</p>{/if}
 <Button onclick={onback}>Back to edit</Button>
</section>
