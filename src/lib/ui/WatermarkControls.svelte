<script lang="ts">
 import type { Size, Watermark } from '../editor/types';
 import { clampPresetToVisible } from '../editor/geometry';
 import Field from './Field.svelte';
 import RangeField from './RangeField.svelte';
 import Button from './Button.svelte';
 let { mark, onchange, onreset, onpreview, ready, area=null }: { mark: Watermark; onchange: (value: Watermark) => void; onreset: () => void; onpreview: () => void; ready: boolean; area?: { image: Size; watermark: Size | null } | null } = $props();
 const positions = [{label:'Top left',x:.15,y:.15},{label:'Top',x:.5,y:.15},{label:'Top right',x:.85,y:.15},{label:'Left',x:.15,y:.5},{label:'Center',x:.5,y:.5},{label:'Right',x:.85,y:.5},{label:'Bottom left',x:.15,y:.85},{label:'Bottom',x:.5,y:.85},{label:'Bottom right',x:.85,y:.85}];
 // Inset corner/edge taps so the full rotated text stays visible. Drag keeps
 // center clamp (BentoPDF parity) and may still hang half out.
 const placed = $derived(positions.map(p => {
  if (!area?.watermark || !Number.isFinite(area.image.width) || !Number.isFinite(area.image.height)) return p;
  const q = clampPresetToVisible({x:p.x,y:p.y}, area.image, area.watermark, mark.angle);
  return {...p, x:q.x, y:q.y};
 }));
 const selected = $derived(placed.find(p => Math.abs(mark.x-p.x)<1e-6 && Math.abs(mark.y-p.y)<1e-6)?.label);
 function update(patch: Partial<Watermark>) { onchange({ ...mark, ...patch }); }
</script>
<section aria-label="Watermark settings" class="panel grid gap-5">
 <Field id="text" label="Watermark text"><textarea id="text" rows="3" value={mark.text} oninput={e => update({text:e.currentTarget.value})}></textarea></Field>
 <div class="grid min-w-0 grid-cols-1 gap-4 min-[420px]:grid-cols-2">
 <RangeField id="size" label="Size" value={mark.sizeRatio*100} min={1} max={20} onchange={value => update({sizeRatio:value/100})} />
 <Field id="color" label="Color"><input id="color" type="color" value={mark.color} oninput={e => update({color:e.currentTarget.value})} /></Field>
 </div>
 <div class="grid min-w-0 grid-cols-1 gap-4 min-[420px]:grid-cols-2">
 <RangeField id="opacity" label="Opacity" value={mark.opacity*100} min={0} max={100} onchange={value => update({opacity:value/100})} />
 <RangeField id="rotation" label="Angle" value={mark.angle} min={-180} max={180} onchange={value => update({angle:value})} />
 </div>
 <fieldset class="grid gap-2"><legend>Layout</legend>
 <div class="flex flex-wrap gap-2" role="group" aria-label="Watermark layout">
  <button type="button" aria-pressed={(mark.mode ?? 'single') === 'single'} class="pos-btn" onclick={() => update({ mode: 'single' })}>Single</button>
  <button type="button" aria-pressed={(mark.mode ?? 'single') === 'tiled'} class="pos-btn" onclick={() => update({ mode: 'tiled' })}>Tiled</button>
 </div>
 {#if mark.mode === 'tiled'}<p class="text-sm text-muted">Tiled covers the whole page. Position does not apply.</p>{/if}
</fieldset>
<fieldset class="grid gap-2" disabled={mark.mode === 'tiled'}><legend>Position</legend>
 <div class="position-grid">
  {#each placed as position (position.label)}
  <button type="button" aria-pressed={selected===position.label} class="pos-btn" onclick={() => update({x:position.x,y:position.y})}>{position.label}</button>
  {/each}
 </div>
 </fieldset>
 <div class="flex flex-wrap gap-3"><Button primary disabled={!ready} onclick={onpreview}>Preview</Button><Button onclick={onreset}>Reset</Button></div>
</section>
