import {test,expect} from '@playwright/test';
test('page cleanup and canvas release on context/render construction failures and stale fetch',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
 const {loadPdf,states}=await import(/* @vite-ignore */ String('/src/lib/pdf/load.ts'));const {previewPdf}=await import(/* @vite-ignore */ String('/src/lib/pdf/preview.ts'));
 const p=await loadPdf(new File([await (await fetch('/tests/fixtures/pdf/two-pages.pdf')).arrayBuffer()],'a.pdf'));const state=states.get(p)!;const pg=await state.doc.getPage(1);let cleaned=0;const cleanup=pg.cleanup.bind(pg);pg.cleanup=()=>{cleaned++;return cleanup();};
 const getPage=state.doc.getPage.bind(state.doc);state.doc.getPage=async()=>pg;
 const create=document.createElement.bind(document);const canvases:HTMLCanvasElement[]=[];document.createElement=((tag:string,...args:any[])=>{const node=create(tag,...args);if(tag==='canvas')canvases.push(node as HTMLCanvasElement);return node;}) as typeof document.createElement;
 const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=(()=>null) as any;
 await previewPdf(p,0).catch(()=>{});HTMLCanvasElement.prototype.getContext=context;
 const render=pg.render;pg.render=()=>{throw new Error('construction failure');};await previewPdf(p,0).catch(()=>{});pg.render=()=>({promise:Promise.reject(new Error('render failure')),cancel(){}}) as any;await previewPdf(p,0).catch(()=>{});pg.render=render;
 state.doc.getPage=async()=>{state.revision++;return pg;};await previewPdf(p,0).catch(()=>{});
 document.createElement=create;state.doc.getPage=getPage;p.dispose();return {cleaned,released:canvases.every(c=>c.width===0&&c.height===0),count:canvases.length};
 });expect(result).toEqual({cleaned:4,released:true,count:3});
});
test('valid predefined CMap is actually requested',async({page})=>{
 let requested=false;page.on('request',r=>{if(r.url().includes('/cmaps/90ms-RKSJ-H.bcmap'))requested=true;});await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/cmap.pdf');await expect(page.getByLabel('Image preview')).toBeVisible();expect(requested).toBe(true);
});
