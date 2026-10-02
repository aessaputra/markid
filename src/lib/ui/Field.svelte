<script lang="ts">
 import type { Snippet } from 'svelte';
 let { id, label, children }: { id: string; label: string; children: Snippet } = $props();
</script>
<div class="field"><label for={id}>{label}</label>{@render children()}</div>
