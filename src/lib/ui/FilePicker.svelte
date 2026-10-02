<script lang="ts">
 import Button from './Button.svelte';
 let { onchange }: { onchange: (file: File) => void } = $props();
 let input: HTMLInputElement;
</script>
<div class="grid gap-3">
 <input bind:this={input} type="file" hidden aria-label="Choose file" aria-describedby="file-helper" accept=".jpg,.jpeg,.png,.heic,.heif,.webp,.avif,.pdf" onchange={e => { const file=e.currentTarget.files?.[0]; e.currentTarget.value=''; if(file) onchange(file); }} />
 <div><Button onclick={() => input.click()}>Choose file</Button></div>
 <p id="file-helper" class="text-sm text-muted">JPG, PNG, HEIC, HEIF, WebP, AVIF or PDF. Max 10 MB.</p>
</div>
