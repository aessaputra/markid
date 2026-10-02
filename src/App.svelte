<script lang="ts">
 import { onDestroy, onMount } from 'svelte';
 import { readTheme, setTheme, watchSystemTheme, type Theme } from './lib/ui/theme';
 let theme = $state<Theme>(readTheme());
 onMount(() => watchSystemTheme(() => theme));
 import { ExportController, ImageController } from './lib/editor/controller';
 import { loadSource } from './lib/input/load';
 import PdfPreview from './lib/ui/PdfPreview.svelte';
 import type { ExportResult, LoadedSource, Watermark } from './lib/editor/types';
 import FilePicker from './lib/ui/FilePicker.svelte';
 import EditorPreview from './lib/ui/EditorPreview.svelte';
 import WatermarkControls from './lib/ui/WatermarkControls.svelte';
 import StatusMessage from './lib/ui/StatusMessage.svelte';
 const defaults: Watermark = {text:'',fontFamily:'Geist',sizeRatio:.05,x:.5,y:.5,angle:0,opacity:.35,color:'#18181b'};
 let mark = $state<Watermark>({...defaults});
 let current = $state.raw<LoadedSource | null>(null);
 let loading = $state(false);
 let error = $state('');
 let previewError = $state('');
 import { exportImage } from './lib/image/export';
 import ResultView from './lib/ui/ResultView.svelte';
 let result=$state.raw<ExportResult|null>(null);
 let processing=$state(false);
 let exportError=$state('');
 const exports=new ExportController(async (source,mark,options)=>{if(source.kind==='image')return exportImage(source,mark,options);const {exportPdf}=await import('./lib/pdf/export');return exportPdf(source,mark);},()=>{result=exports.result;processing=exports.processing;exportError=exports.error;});
 function edit(value:Watermark) {if(processing)return;exports.invalidate();mark=value;previewError='';}

 const controller = new ImageController(loadSource, () => {
   if(current!==controller.current) {exports.invalidate();mark={...mark,x:.5,y:.5};previewError='';}
   current=controller.current;loading=controller.loading;error=controller.error;
 });
 onDestroy(() => {controller.dispose();exports.dispose();});
</script>
<main class="mx-auto max-w-6xl px-4 py-6 sm:px-8">
 <header class="mb-6 flex items-center justify-between border-b border-border pb-4"><h1 class="text-xl font-semibold tracking-tight">MarkID</h1><div class="flex items-center gap-2"><label for="theme">Theme</label><select id="theme" value={theme} onchange={e => {theme=e.currentTarget.value as Theme;setTheme(theme);}}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></header>
 {#if result}
 <ResultView {result} error={exportError} reduced={current?.kind==='image' && (result.size?.width!==current.size.width || result.size?.height!==current.size.height)} onback={() => exports.invalidate()} onerror={message => {exportError=message;}} />
 {/if}
 <div class="editor-layout" hidden={!!result} style:display={result ? 'none' : undefined}>
 <section aria-label="Source image" class="panel preview-panel grid gap-4">
 <FilePicker disabled={processing} onchange={file => {if(processing)return;exports.invalidate();previewError='';void controller.replace(file);}} />
 <p class="text-sm text-muted">Files stay on your device.</p>
 <StatusMessage status={processing ? 'Processing…' : loading ? 'Loading…' : current ? 'Ready' : ''} error={exportError || error || previewError} />
 {#if current}
 {#if current.kind==='pdf'}{#key current}<PdfPreview pdf={current} {mark} disabled={processing} onposition={point=>edit({...mark,...point})} onerror={message=>previewError=message} />{/key}{:else}
 <EditorPreview image={current} {mark} disabled={processing} onposition={point => {if(current?.kind==='image')edit({...mark,x:point.x/current.size.width,y:point.y/current.size.height});}} onerror={message => previewError=message} />
 {#if current.resized}<p class="text-sm text-muted">Image resized for processing.</p>{/if}
 {/if}
 {:else}<div class="empty-preview text-muted">Choose a file to start.</div>{/if}
 </section>
 <fieldset disabled={processing} class="min-w-0 border-0 p-0 m-0"><WatermarkControls {mark} onchange={edit} onreset={() => edit({...defaults})} ready={!!current && !!mark.text.trim() && !loading && !processing} onpreview={() => {if(current) {error='';previewError='';void exports.prepare(current,mark);}}} /></fieldset>
 </div>
</main>
