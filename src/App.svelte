<script lang="ts">
 import { onDestroy, onMount } from 'svelte';
 import { readTheme, setTheme, watchSystemTheme, type Theme } from './lib/ui/theme';
 let theme = $state<Theme>(readTheme());
 onMount(() => watchSystemTheme(() => theme));
 import { ImageController } from './lib/editor/controller';
 import { loadImage } from './lib/image/load';
 import { experimentPolicy } from './lib/input/policy';
 import type { LoadedImage, Watermark } from './lib/editor/types';
 import FilePicker from './lib/ui/FilePicker.svelte';
 import EditorPreview from './lib/ui/EditorPreview.svelte';
 import WatermarkControls from './lib/ui/WatermarkControls.svelte';
 import StatusMessage from './lib/ui/StatusMessage.svelte';
 const defaults: Watermark = {text:'',fontFamily:'Geist',sizeRatio:.05,x:.5,y:.5,angle:0,opacity:.35,color:'#18181b'};
 let mark = $state<Watermark>({...defaults});
 let current = $state.raw<LoadedImage | null>(null);
 let loading = $state(false);
 let error = $state('');
 let previewError = $state('');
 const controller = new ImageController(file => loadImage(file,experimentPolicy), () => {
   if(current!==controller.current) {mark={...mark,x:.5,y:.5};previewError='';}
   current=controller.current;loading=controller.loading;error=controller.error;
 });
 onDestroy(() => controller.dispose());
</script>
<main class="mx-auto max-w-6xl px-4 py-6 sm:px-8">
 <header class="mb-6 flex items-center justify-between border-b border-border pb-4"><h1 class="text-xl font-semibold tracking-tight">MarkID</h1><div class="flex items-center gap-2"><label for="theme">Theme</label><select id="theme" value={theme} onchange={e => {theme=e.currentTarget.value as Theme;setTheme(theme);}}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></header>
 <div class="editor-layout">
 <section aria-label="Source image" class="panel preview-panel grid gap-4">
 <FilePicker onchange={file => {previewError='';void controller.replace(file);}} />
 <p class="text-sm text-muted">Files stay on your device.</p>
 <StatusMessage status={loading ? 'Loading…' : current ? 'Ready' : ''} error={error || previewError} />
 {#if current}
 <EditorPreview image={current} {mark} onposition={point => {mark={...mark,x:point.x/current!.size.width,y:point.y/current!.size.height};}} onerror={message => previewError=message} />
 {#if current.resized}<p class="text-sm text-muted">Image resized for processing.</p>{/if}
 {:else}<div class="empty-preview text-muted">Choose a file to start.</div>{/if}
 </section>
 <WatermarkControls {mark} onchange={value => {mark=value;previewError='';}} onreset={() => {mark={...defaults};previewError='';}} ready={!!current && !!mark.text.trim() && !loading} onpreview={() => {error='';previewError='Result preview is not available yet. Your edits are kept.';}} />
 </div>
</main>
