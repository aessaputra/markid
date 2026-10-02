<script lang="ts">
 let { status = '', error = '' }: { status?: string; error?: string } = $props();
</script>
<p role="status" class="text-sm text-muted">{status}</p>
{#if error}<p role="alert" class="text-sm text-danger">{error}</p>{/if}
