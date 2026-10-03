<script lang="ts">
 import Field from './Field.svelte';
 let { id, label, value, min, max, sliderStep = 1, onchange }: { id: string; label: string; value: number; min: number; max: number; sliderStep?: number; onchange: (value: number) => void } = $props();
 const unit = $derived(label === 'Angle' ? '°' : '%');
 // Local text so typing multi-digit numbers (e.g. "12") is not clamped per keystroke.
 // Commit only on blur/Enter; slider stays immediate.
 let text = $state('');
 let editing = $state(false);
 $effect(() => { if (!editing) text = String(Math.round(value)); });
 function commitText() { editing = false; const raw = Number(text); if (!Number.isFinite(raw)) { text = String(Math.round(value)); return; } const next = Math.min(max, Math.max(min, Math.round(raw))); text = String(next); if (next !== Math.round(value)) onchange(next); }
</script>
<Field {id} {label}><div class="range-row"><input {id} type="range" {min} {max} step={sliderStep} value={Math.round(value / sliderStep) * sliderStep} oninput={e => onchange(e.currentTarget.valueAsNumber)} /><div class="range-number"><input id={`${id}-number`} type="number" step="1" aria-label={`${label} value`} {min} {max} value={text} onfocus={() => editing = true} oninput={e => { editing = true; text = e.currentTarget.value; }} onchange={commitText} onblur={commitText} onkeydown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }} /><span class="range-unit" aria-hidden="true">{unit}</span></div></div></Field>
