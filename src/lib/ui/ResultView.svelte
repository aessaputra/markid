<script lang="ts">
 import type { ExportResult } from '../editor/types';
 import Button from './Button.svelte';
 // Task 5 owns final preview/URL/download lifecycle. No URL or download is invented here.
 let { result = null, onback }: { result?: ExportResult | null; onback: () => void } = $props();
</script>
<section aria-label="Result preview" class="panel grid gap-4">
 <p>{result ? 'Result rendering is not available yet.' : 'No result yet.'}</p>
 <Button onclick={onback}>Back to edit</Button>
</section>
