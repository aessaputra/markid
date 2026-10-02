<script lang="ts">
 import Field from './Field.svelte';
 let { id, label, value, min, max, step = 1, onchange }: { id: string; label: string; value: number; min: number; max: number; step?: number; onchange: (value: number) => void } = $props();
</script>
<Field {id} {label}><div class="range-row"><input {id} type="range" {min} {max} {step} {value} oninput={e => onchange(e.currentTarget.valueAsNumber)} /><output for={id}>{Math.round(value)}{label === 'Rotation' ? '°' : '%'}</output></div></Field>
