import {test,expect} from '@playwright/test';
for(const name of ['two-pages','rotated-crop','scan','normalized-boxes'])test(`real PDF ${name}: pixels, preserved text, zero opacity, fresh exports`,async({page})=>{
 await page.goto('/');
 const metrics=await page.evaluate(async(name)=>{
  const {loadPdf,states}=await import(/* @vite-ignore */ String('/src/lib/pdf/load.ts'));
  const {previewPdf}=await import(/* @vite-ignore */ String('/src/lib/pdf/preview.ts'));
  const {exportPdf}=await import(/* @vite-ignore */ String('/src/lib/pdf/export.ts'));
  const {renderWatermark,composeWatermark}=await import(/* @vite-ignore */ String('/src/lib/editor/watermark.ts'));
  const bytes=await (await fetch(`/tests/fixtures/pdf/${name}.pdf`)).arrayBuffer();
  const pdf=await loadPdf(new File([bytes],'test.pdf'));
  const mark={text:'Asymmetric WIDE\nI',sizeRatio:.07,x:.35,y:.4,angle:37,opacity:.5,color:'#f00000'};
  const a=await exportPdf(pdf,mark),b=await exportPdf(pdf,mark),zero=await exportPdf(pdf,{...mark,opacity:0});
  const results=[];
  function pixels(image:any){const c=document.createElement('canvas');c.width=Math.ceil(image.size.width);c.height=Math.ceil(image.size.height);const x=c.getContext('2d')!;x.drawImage(image.source,0,0);return {c,x,data:x.getImageData(0,0,c.width,c.height).data};}
  function centroid(data:Uint8ClampedArray,w:number,src:Uint8ClampedArray){
   let x=0,y=0,n=0,xx=0,yy=0,xy=0,intensity=0,minX=Infinity,minY=Infinity,maxX=0,maxY=0;
   for(let i=0;i<data.length;i+=4){const delta=src[i+1]-data[i+1];if(delta>12 && data[i]>data[i+1]*1.3){const px=(i/4)%w,py=Math.floor(i/4/w);x+=px;y+=py;xx+=px*px;yy+=py*py;xy+=px*py;n++;intensity+=delta;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}}
   return {x:x/n,y:y/n,n,xx:xx/n-(x/n)**2,yy:yy/n-(y/n)**2,xy:xy/n-x*y/n**2,intensity:intensity/n,bounds:[minX,minY,maxX,maxY]};
  }
  for(let i=0;i<pdf.pageCount;i++){
   const source=await previewPdf(pdf,i),output=await previewPdf(a.pdf!,i),again=await previewPdf(b.pdf!,i),invisible=await previewPdf(zero.pdf!,i);
   const original=pixels(source),saved=pixels(output),second=pixels(again),transparent=pixels(invisible);
   const asset=await renderWatermark(mark,source.size);composeWatermark(original.x,asset,mark,source.size);asset.close();
   const overlay=original.x.getImageData(0,0,original.c.width,original.c.height).data;
   const src=pixels(source).data;
   const expected=centroid(overlay,original.c.width,src),actual=centroid(saved.data,saved.c.width,src);
   const text=async(p:any)=>{const page=await states.get(p)!.doc.getPage(i+1);return (await page.getTextContent()).items.map((v:any)=>v.str).join('');};
   results.push({expected,actual,textSame:await text(pdf)===await text(a.pdf!),repeatSame:saved.data.every((v,j)=>v===second.data[j]),repeatDiff:saved.data.reduce((n,v,j)=>n+(v!==second.data[j]?1:0),0),repeatMax:saved.data.reduce((n,v,j)=>Math.max(n,Math.abs(v-second.data[j])),0),zeroSame:src.every((v,j)=>v===transparent.data[j])});
   for(const v of [source,output,again,invisible])v.dispose();
  }
  // Independent saved-stream inspection, not export implementation instrumentation.
  const lib=await import(/* @vite-ignore */ String('/node_modules/.vite/deps/pdf-lib.js'));const structure=await lib.PDFDocument.load(await a.blob.arrayBuffer());
  const originalStructure=await lib.PDFDocument.load(bytes);
  const repeatStructure=await lib.PDFDocument.load(await b.blob.arrayBuffer());
  const images=(doc:any)=>doc.context.enumerateIndirectObjects().filter(([,v]:any)=>v instanceof lib.PDFRawStream && v.dict.get(lib.PDFName.of('Subtype'))?.toString()==='/Image').map(([,v]:any)=>Array.from(v.contents));
  const repeatAssetsSame=JSON.stringify(images(structure))===JSON.stringify(images(repeatStructure));
  const countPlacements=(document:any)=>document.getPages().map((page:any)=>{const contents=page.node.Contents();let operators='';for(let j=0;j<(contents?.size()??0);j++){const stream=document.context.lookup(contents.get(j));operators+=new TextDecoder().decode(lib.decodePDFRawStream(stream).decode());}return (operators.match(/\/Image-[^\s]+\s+Do/g)||[]).length;});
  const originals=countPlacements(originalStructure),placements=countPlacements(structure).map((v:number,i:number)=>v-originals[i]);
  const count=a.pdf!.pageCount;for(const v of [a,b,zero])v.dispose();pdf.dispose();return {count,results,placements,repeatAssetsSame};
 },name);
 expect(metrics.count).toBe(name==='normalized-boxes'?8:name==='rotated-crop'?4:name==='scan'?1:2);expect(metrics.placements).toEqual(Array(metrics.count).fill(1));expect(metrics.repeatAssetsSame).toBe(true);
 for(const m of metrics.results){expect(m.textSame).toBe(true);expect(m.repeatMax,JSON.stringify(m)).toBeLessThanOrEqual(1);expect(m.zeroSame).toBe(true);expect(m.actual.n).toBeGreaterThan(20);expect(Math.abs(m.actual.x-m.expected.x)).toBeLessThan(1.5);expect(Math.abs(m.actual.y-m.expected.y)).toBeLessThan(1.5);
  for(let k=0;k<4;k++)expect(Math.abs(m.actual.bounds[k]-m.expected.bounds[k])).toBeLessThanOrEqual(3);
  for(const key of ['xx','yy','xy'] as const)expect(Math.abs(m.actual[key]-m.expected[key])/Math.max(1,Math.abs(m.expected[key]))).toBeLessThan(.08);
  expect(m.actual.n/m.expected.n).toBeGreaterThan(.85);expect(m.actual.n/m.expected.n).toBeLessThan(1.15);
  expect(m.actual.intensity).toBeGreaterThan(40);expect(Math.abs(m.actual.intensity-m.expected.intensity)).toBeLessThan(8);}
});
test('reject signed/broken and dispose cancelled render jobs',async({page})=>{
 await page.goto('/');
 const values=await page.evaluate(async()=>{
  const {loadPdf,states}=await import(/* @vite-ignore */ String('/src/lib/pdf/load.ts'));const {previewPdf}=await import(/* @vite-ignore */ String('/src/lib/pdf/preview.ts'));
  const messages=[];
  for(const name of ['signed','broken','locked']){try{await loadPdf(new File([await (await fetch(`/tests/fixtures/pdf/${name}.pdf`)).arrayBuffer()],'x.pdf'));}catch(e){messages.push((e as Error).message);}}
  const p=await loadPdf(new File([await (await fetch('/tests/fixtures/pdf/rotated-crop.pdf')).arrayBuffer()],'x.pdf'));
  const first=previewPdf(p,0).then((v:any)=>{v.dispose();return 'resolved';},()=> 'cancelled');
  const next=await previewPdf(p,1);next.dispose();const outcome=await first;p.dispose();p.dispose();return {messages,outcome,disposed:states.get(p)!.disposed,bytes:p.bytes.length};
 });
 expect(values.messages).toEqual(['Signed PDFs are not supported yet.','Could not open this PDF. Try another.','PDF is locked. Unlock it and try again.']);expect(values.outcome).toBe('cancelled');expect(values.disposed).toBe(true);expect(values.bytes).toBe(0);
});
