<script lang="ts">
 import { onDestroy } from 'svelte';
 import { ExportController, ImageController } from './lib/editor/controller';
 import { loadSource } from './lib/input/load';
 import PdfPreview from './lib/ui/PdfPreview.svelte';
 import type { ExportResult, LoadedSource, Size, Watermark } from './lib/editor/types';
 import FilePicker from './lib/ui/FilePicker.svelte';
 import EditorPreview from './lib/ui/EditorPreview.svelte';
 import WatermarkControls from './lib/ui/WatermarkControls.svelte';
 import StatusMessage from './lib/ui/StatusMessage.svelte';
 function todayText() { return new Date().toLocaleDateString('en-CA'); }
function defaultMark(): Watermark {
  return { text: `For verification only, ${todayText()}`, sizeRatio: .05, x: .5, y: .5, angle: 0, opacity: .35, color: '#18181b', mode: 'single' };
}
let mark = $state<Watermark>(defaultMark());
let watermarkArea = $state<{ image: Size; watermark: Size | null } | null>(null);
 let current = $state.raw<LoadedSource | null>(null);
 let fileName = $state('');
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
  if(current!==controller.current) {exports.invalidate();mark={...mark,x:.5,y:.5};previewError='';watermarkArea=null;}
   current=controller.current;fileName=controller.fileName;loading=controller.loading;error=controller.error;
 });
 onDestroy(() => {controller.dispose();exports.dispose();});
</script>
<main class="mx-auto max-w-6xl px-4 py-6 sm:px-8">
 <header class="mb-6 border-b border-border pb-4"><h1 class="text-xl font-semibold tracking-tight">MarkID</h1></header>
 {#if result}
 <ResultView {result} error={exportError} onback={() => exports.invalidate()} onerror={message => {exportError=message;}} />
 {/if}
 {#snippet picker()}
 <FilePicker initial={!current} {fileName} disabled={processing} onchange={file => {if(processing)return;exports.invalidate();previewError='';void controller.replace(file);}} />
 {/snippet}
 <div class="grid gap-4" hidden={!!result}>
 {#if current}{@render picker()}{/if}
 <div class={current ? 'editor-layout' : 'w-full'} class:pdf-layout={current?.kind==='pdf'}>
 <section aria-label={current ? 'Source image' : 'File selection'} class="panel grid gap-4" class:preview-panel={!!current}>
 {#if !current}
 <div><h2 class="text-xl font-semibold tracking-tight mb-2">Watermark your file</h2><p class="text-sm text-muted">Add a text watermark to an image or PDF before sharing.</p></div>
 {/if}
 {#if !current}{@render picker()}{/if}
 <StatusMessage status={processing ? 'Processing…' : loading ? 'Loading…' : ''} error={exportError || error || previewError} />
 {#if current}
 {#if current.kind==='pdf'}{#key current}<PdfPreview pdf={current} {mark} disabled={processing} onwatermark={info=>watermarkArea=info} onsize={sizeRatio=>edit({...mark,sizeRatio})} onposition={point=>edit({...mark,...point})} onerror={message=>previewError=message} />{/key}{:else}
 <EditorPreview image={current} {mark} disabled={processing} onwatermark={info=>watermarkArea=info} onsize={sizeRatio=>edit({...mark,sizeRatio})} onposition={point => {if(current?.kind==='image')edit({...mark,x:point.x/current.size.width,y:point.y/current.size.height});}} onerror={message => previewError=message} />
 {/if}
 {/if}
 </section>
 {#if current}
 <fieldset disabled={processing} class="min-w-0 border-0 p-0 m-0"><WatermarkControls {mark} area={watermarkArea} onchange={edit} onreset={() => edit(defaultMark())} ready={!!current && !!mark.text.trim() && !loading && !processing} onpreview={() => {if(current) {error='';previewError='';void exports.prepare(current,mark);}}} /></fieldset>
 {/if}
 </div>
 </div>
</main>
