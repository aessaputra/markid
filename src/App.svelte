<script lang="ts">
  import { copy } from './lib/ui/copy';
  let fileInput: HTMLInputElement;
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
    />
    <button type="button" class="primary-button" aria-describedby="file-helper" onclick={() => fileInput.click()}>{copy.chooseFile}</button>
    <p class="mt-5 text-sm text-muted">{copy.privacy}</p>
  </section>
</main>
