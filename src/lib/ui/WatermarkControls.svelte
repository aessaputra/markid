<script lang="ts">
 import type { Watermark } from '../editor/types';
 import Field from './Field.svelte';
 import RangeField from './RangeField.svelte';
 import Disclosure from './Disclosure.svelte';
 import Button from './Button.svelte';
 let { mark, onchange, onreset, onpreview, ready }: { mark: Watermark; onchange: (value: Watermark) => void; onreset: () => void; onpreview: () => void; ready: boolean } = $props();
 let purpose = $state('verification');
 const today = new Date();
 let date = $state(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
 function update(patch: Partial<Watermark>) { onchange({ ...mark, ...patch }); }
</script>
<section aria-label="Watermark settings" class="panel grid gap-5">
 <Field id="text" label="Watermark text"><textarea id="text" rows="3" value={mark.text} oninput={e => update({text:e.currentTarget.value})}></textarea></Field>
 <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <Field id="purpose" label="Purpose"><input id="purpose" bind:value={purpose} /></Field>
 <Field id="date" label="Date"><input id="date" type="date" bind:value={date} /></Field>
 </div>
 <Button onclick={() => update({text:`For ${purpose.trim() || 'verification'} only · ${date}`})}>Use preset</Button>
 <RangeField id="size" label="Size" value={mark.sizeRatio*100} min={1} max={20} onchange={value => update({sizeRatio:value/100})} />
 <RangeField id="opacity" label="Opacity" value={mark.opacity*100} min={0} max={100} onchange={value => update({opacity:value/100})} />
 <Disclosure>
 <Field id="font" label="Font"><select id="font" value={mark.fontFamily} onchange={e => update({fontFamily:e.currentTarget.value})}><option>Geist</option></select></Field>
 <Field id="color" label="Color"><input id="color" type="color" value={mark.color} oninput={e => update({color:e.currentTarget.value})} /></Field>
 <fieldset class="grid gap-3"><legend>Position</legend>
 <RangeField id="x" label="Position X" value={mark.x*100} min={0} max={100} onchange={value => update({x:value/100})} />
 <RangeField id="y" label="Position Y" value={mark.y*100} min={0} max={100} onchange={value => update({y:value/100})} />
 <Button onclick={() => update({x:.5,y:.5})}>Center</Button>
 </fieldset>
 <RangeField id="rotation" label="Rotation" value={mark.angle} min={-180} max={180} onchange={value => update({angle:value})} />
 </Disclosure>
 <div class="flex flex-wrap gap-3"><Button primary disabled={!ready} onclick={onpreview}>Preview</Button><Button onclick={onreset}>Reset</Button></div>
</section>
