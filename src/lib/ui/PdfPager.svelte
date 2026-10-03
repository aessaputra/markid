<script lang="ts">
 import Button from './Button.svelte';
 let {pageIndex,pageCount,disabled=false,onchange}:{pageIndex:number;pageCount:number;disabled?:boolean;onchange:(index:number)=>void}=$props();
</script>
{#if pageCount > 1}
<nav aria-label="PDF pages" class="flex flex-wrap items-center gap-2">
 <Button disabled={disabled || pageIndex===0} onclick={()=>onchange(pageIndex-1)}>Previous page</Button>
 <span>Page {pageIndex+1} of {pageCount}</span>
 <Button disabled={disabled || pageIndex===pageCount-1} onclick={()=>onchange(pageIndex+1)}>Next page</Button>
</nav>
{/if}
