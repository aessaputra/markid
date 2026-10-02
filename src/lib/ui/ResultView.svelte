<script lang="ts">
 import type { ExportResult } from '../editor/types';
 import Button from './Button.svelte';
 let { result = null, onback, reduced = false, onerror = () => {} }: { result?: ExportResult | null; onback: () => void; reduced?: boolean; onerror?: (message:string)=>void } = $props();
 let url = $state('');
 let decoded = $state(false);
 $effect(() => {
  const value=result;
  decoded=false;url='';
  if(!value) return;
  const owned=URL.createObjectURL(value.blob);url=owned;
  return () => URL.revokeObjectURL(owned);
 });
 function download() {
  if(!result || !decoded || !url) return;
  const a=document.createElement('a');a.href=url;a.download='markid.jpg';a.click();
 }
</script>
<section aria-label="Result preview" class="panel grid gap-4">
 {#if result && url}
  <img src={url} alt="Final JPEG preview" class="max-h-[65vh] max-w-full object-contain" onload={() => decoded=true} onerror={() => {decoded=false;onerror('Export failed. Try again.');}} />
  <p>{result.blob.size.toLocaleString('en-US')} bytes · {result.size?.width} × {result.size?.height} px</p>
  {#if reduced}<p class="text-sm text-muted">Output dimensions reduced.</p>{/if}
  <Button primary disabled={!decoded} onclick={download}>Download</Button>
 {:else}<p>No result yet.</p>{/if}
 <Button onclick={onback}>Back to edit</Button>
</section>
