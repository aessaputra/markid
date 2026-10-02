<script lang="ts">
  import { onDestroy } from 'svelte';
  import { copy } from './lib/ui/copy';
  import { ImageController } from './lib/editor/controller';
  import { loadImage } from './lib/image/load';
  import { experimentPolicy } from './lib/input/policy';
  import type { LoadedImage } from './lib/editor/types';
  let fileInput: HTMLInputElement;
  let current = $state.raw<LoadedImage | null>(null);
  let loading = $state(false);
  let error = $state('');
  const controller = new ImageController(file => loadImage(file, experimentPolicy), () => {
    current = controller.current; loading = controller.loading; error = controller.error;
  });
  onDestroy(() => controller.dispose());
  function choose(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void controller.replace(file);
  }
  function drawPreview(node: HTMLCanvasElement, image: LoadedImage) {
    function draw(value: LoadedImage) {
      node.width = value.size.width; node.height = value.size.height;
      node.getContext('2d')?.drawImage(value.source, 0, 0);
    }
    draw(image);
    return { update: draw, destroy() { node.width = 0; node.height = 0; } };
  }
</script>

<main class="mx-auto max-w-6xl px-4 py-6 sm:px-8">
  <header class="mb-8 border-b border-border pb-4">
    <h1 class="text-xl font-semibold tracking-tight">{copy.appName}</h1>
  </header>
  <section aria-labelledby="file-heading" class="rounded-panel border border-border bg-surface p-5 sm:p-8">
    <h2 id="file-heading" class="mb-2 text-lg font-semibold">{copy.chooseFile}</h2>
    <p id="file-helper" class="mb-6 text-sm text-muted">{copy.fileHelper}</p>
    <input
      bind:this={fileInput}
      type="file"
      aria-label={copy.chooseFile}
      aria-describedby="file-helper"
      accept=".jpg,.jpeg,.png,.heic,.heif,.webp,.avif,.pdf"
      hidden
      onchange={choose}
    />
    <button type="button" class="primary-button" aria-describedby="file-helper" onclick={() => fileInput.click()}>{copy.chooseFile}</button>
    <p class="mt-5 text-sm text-muted">{copy.privacy}</p>
    <p role="status" class="mt-4 text-sm text-muted">{loading ? 'Loading…' : current ? 'Ready' : ''}</p>
    {#if error}<p role="alert" class="mt-2 text-sm text-danger">{error}</p>{/if}
    {#if current}
      <canvas use:drawPreview={current} aria-label="Image preview" class="mt-4 h-auto max-w-full">Image preview</canvas>
      {#if current.resized}<p class="mt-2 text-sm text-muted">Image resized for processing.</p>{/if}
    {/if}
  </section>
</main>
