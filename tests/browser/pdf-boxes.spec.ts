import {test,expect} from '@playwright/test';
test('saved pixels agree with PDF.js normalized malformed boxes, intersection, rotations and UserUnit',async({page})=>{
 await page.goto('/');const values=await page.evaluate(async()=>{
 const {loadPdf,states}=await import(/* @vite-ignore */ String('/src/lib/pdf/load.ts'));const {exportPdf}=await import(/* @vite-ignore */ String('/src/lib/pdf/export.ts'));const {previewPdf}=await import(/* @vite-ignore */ String('/src/lib/pdf/preview.ts'));
 const p=await loadPdf(new File([await (await fetch('/tests/fixtures/pdf/normalized-boxes.pdf')).arrayBuffer()],'boxes.pdf'));
 const a=await exportPdf(p,{text:'Asymmetric\nShort',fontFamily:'Geist',sizeRatio:.07,x:.32,y:.41,angle:37,opacity:.5,color:'#f00000'});const values=[];
 for(let i=0;i<p.pageCount;i++){const pg=await states.get(p)!.doc.getPage(i+1);const image=await previewPdf(a.pdf!,i);values.push({view:pg.view,rotate:pg.rotate,width:image.size.width,height:image.size.height});image.dispose();}a.dispose();p.dispose();return values;
 });expect(values).toHaveLength(8);expect(values.slice(0,4).map(v=>v.view)).toEqual(Array(4).fill([0,0,500,700]));expect(values.map(v=>v.rotate)).toEqual([0,90,180,270,0,270,90,0]);expect(values[4].view).toEqual([0,30,400,700]);for(const v of values){expect(v.width).toBeGreaterThan(0);expect(v.height).toBeGreaterThan(0);}
});
