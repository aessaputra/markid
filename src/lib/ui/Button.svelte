<script lang="ts">
 import type { Snippet } from 'svelte';
 let { children, onclick, disabled = false, primary = false }: { children: Snippet; onclick?: () => void; disabled?: boolean; primary?: boolean } = $props();
</script>
<button type="button" class:primary-button={primary} class:secondary-button={!primary} {disabled} {onclick}>{@render children()}</button>
