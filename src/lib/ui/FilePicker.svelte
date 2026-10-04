<script lang="ts">
 import Button from './Button.svelte';
 let { onchange, disabled=false, initial=false, fileName='' }: { onchange: (file: File, focusedChooser?: HTMLElement) => void; disabled?:boolean; initial?:boolean; fileName?:string } = $props();
 let input: HTMLInputElement;
 let dragging = $state(false);
 function drop(event: DragEvent) {
  event.preventDefault();dragging=false;
  const file=event.dataTransfer?.files[0];
  if(!disabled && file) onchange(file);
 }
</script>
<div class="file-picker grid gap-3">
 <input bind:this={input} type="file" {disabled} hidden aria-label="Choose file" aria-describedby={initial ? 'file-helper' : undefined} accept=".jpg,.jpeg,.png,.heic,.heif,.webp,.avif,.pdf" onchange={e => { const file=e.currentTarget.files?.[0]; e.currentTarget.value=''; if(file) { const button=input.parentElement?.querySelector('button'); onchange(file, initial && button && document.activeElement===button ? button : undefined); } }} />
 {#if initial}
 <button type="button" class="file-drop-zone" class:dragging {disabled} aria-describedby="file-helper file-privacy" onclick={() => input.click()} ondragover={event => {event.preventDefault();if(!disabled)dragging=true;}} ondragleave={() => dragging=false} ondrop={drop}>
  <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" /></svg>
  <span class="sr-only">Choose file</span>
  <span aria-hidden="true" class="text-sm"><strong>Choose a file</strong><br />or drag and drop</span>
  <span id="file-helper" aria-hidden="true" class="text-sm text-muted">JPG, PNG, HEIC, HEIF, WebP, AVIF or PDF.</span>
  <span id="file-privacy" aria-hidden="true" class="text-sm text-muted">Your files never leave your device.</span>
 </button>
 {:else}
 <div class="flex min-w-0 items-center justify-between gap-4"><div class="shrink-0"><Button {disabled} onclick={() => input.click()}>Change file</Button></div><p aria-label="Current file" class="min-w-0 truncate text-sm text-muted" title={fileName}>{fileName}</p></div>
 {/if}
</div>
