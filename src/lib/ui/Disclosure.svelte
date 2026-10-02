<script lang="ts">
 import type { Snippet } from 'svelte';
 let { children }: { children: Snippet } = $props();
</script>
<details><summary>More options</summary><div class="grid gap-5 pt-4">{@render children()}</div></details>
