<script lang="ts">
 import type { Snippet } from 'svelte';
 let { children, onclick, disabled = false, primary = false, 'aria-describedby': describedby }: { children: Snippet; onclick?: () => void; disabled?: boolean; primary?: boolean; 'aria-describedby'?: string } = $props();
</script>
<button type="button" class:primary-button={primary} class:secondary-button={!primary} {disabled} {onclick} aria-describedby={describedby}>{@render children()}</button>
