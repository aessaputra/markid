import type {Size} from '../../src/lib/editor/types';
import type {ExportRequest,ExportResponse} from '../../src/lib/image/export.worker';
type WorkerResponseEvidence={id:number;revision:number;error?:string;unsupported?:boolean;type?:string;size?:Size;bytes:number[]};
type WorkerEvidence={url:string;requests:Array<Pick<ExportRequest,'id'|'revision'>>;responses:WorkerResponseEvidence[]};
type JpegEvidence={workers:WorkerEvidence[];encodes:string[];violations:string[];pending:Promise<void>[]};
type EvidenceWindow=Window & {jpegWorkerEvidence:JpegEvidence;violations:string[]};
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
test.skip(({baseURL})=>!baseURL?.endsWith(':5174'),'Production HTTP headers only');
test('actual HTTP security headers, immutable hashed assets and HTML conditional revalidation',async({request})=>{
 const html=await request.get('/');expect(html.status()).toBe(200);
 const headers=html.headers();
 expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
 expect(headers['content-security-policy']).toContain("form-action 'none'");
 expect(headers['content-security-policy']).not.toContain('unsafe-eval');
 expect(headers['x-content-type-options']).toBe('nosniff');
 expect(headers['cache-control']).toBe('no-cache');
 expect(headers.etag).toMatch(/^"[a-f0-9]+"$/);
 const revalidated=await request.get('/',{headers:{'If-None-Match':headers.etag}});
 expect(revalidated.status()).toBe(304);expect(await revalidated.body()).toHaveLength(0);
 expect(revalidated.headers()['cache-control']).toBe('no-cache');
 const script=(await html.text()).match(/src="([^"]+\.js)"/)![1];
 const asset=await request.get(script);expect(asset.status()).toBe(200);
 expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
 expect(asset.headers()['content-type']).toBe('text/javascript');
 const cached=await request.get(script,{headers:{'If-None-Match':asset.headers().etag}});
 expect(cached.status()).toBe(304);
});
test('production hashed JPEG worker returns the downloaded bytes without main Canvas encoding',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const workers:string[]=[];page.on('worker',w=>workers.push(w.url()));
 await page.addInitScript(()=>{
  const evidence={workers:[] as WorkerEvidence[],encodes:[] as string[],violations:[] as string[],pending:[] as Promise<void>[]};
  (window as unknown as EvidenceWindow).jpegWorkerEvidence=evidence;
  document.addEventListener('securitypolicyviolation',e=>evidence.violations.push(e.violatedDirective));
  const NativeWorker=window.Worker;
  window.Worker=new Proxy(NativeWorker,{construct(Target,args){
   const worker=Reflect.construct(Target,args) as Worker;
   const record={url:new URL(String(args[0]),location.href).href,requests:[] as Array<Pick<ExportRequest,'id'|'revision'>>,responses:[] as WorkerResponseEvidence[]};
   evidence.workers.push(record);
   const post=worker.postMessage;
   worker.postMessage=function(...args:[ExportRequest, (Transferable[] | StructuredSerializeOptions)?]){
    const data=args[0];record.requests.push({id:data.id,revision:data.revision});
    return Reflect.apply(post,this,args);
   };
   worker.addEventListener('message',({data}:MessageEvent<ExportResponse>)=>{
    const response:WorkerResponseEvidence={id:data.id,revision:data.revision,error:'error' in data?data.error:undefined,unsupported:'error' in data?data.unsupported:undefined,type:'blob' in data?data.blob.type:undefined,size:'size' in data?data.size:undefined,bytes:[]};
    record.responses.push(response);
    if('blob' in data && data.blob instanceof Blob) evidence.pending.push(data.blob.arrayBuffer().then((buffer:ArrayBuffer)=>{response.bytes=Array.from(new Uint8Array(buffer));}));
   });
   return worker;
  }});
  for(const method of ['toBlob','toDataURL'] as const){
   const native=HTMLCanvasElement.prototype[method];
   Object.assign(HTMLCanvasElement.prototype,{[method]:function(this:HTMLCanvasElement,...args:unknown[]){evidence.encodes.push(method);return Reflect.apply(native,this,args);}});
  }
 });
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/images/exif-6.png');
 await page.getByLabel('Watermark text').fill('Real production JPEG worker');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 const file=info.outputPath('worker-final.jpg');await (await event).saveAs(file);
 const bytes=await readFile(file);
 expect(bytes.length).toBeGreaterThan(100);
 expect([...bytes.subarray(0,3)]).toEqual([255,216,255]);
 const evidence=await page.evaluate(async()=>{const e=(window as unknown as EvidenceWindow).jpegWorkerEvidence;await Promise.all(e.pending);return {workers:e.workers,encodes:e.encodes,violations:e.violations};});
 expect(evidence.workers).toHaveLength(1);
 const worker=evidence.workers[0];
 expect(new URL(worker.url).origin).toBe(new URL(page.url()).origin);
 expect(new URL(worker.url).pathname).toMatch(/^\/assets\/export\.worker-[\w-]+\.js$/);
 expect(workers).toEqual([worker.url]);
 expect(worker.requests).toHaveLength(1);expect(worker.responses).toHaveLength(1);
 const response=worker.responses[0];
 expect({id:response.id,revision:response.revision}).toEqual(worker.requests[0]);
 expect(response.error).toBeUndefined();expect(response.unsupported).toBeUndefined();expect(response.type).toBe('image/jpeg');
 expect(Buffer.from(response.bytes)).toEqual(bytes); // Actual worker result is used, not just received.
 const decoded=await page.evaluate(async bytes=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/jpeg'}));const size={width:bitmap.width,height:bitmap.height};bitmap.close();return size;},[...bytes]);
 expect(decoded).toEqual(response.size);expect(decoded.width).toBeGreaterThan(0);expect(decoded.height).toBeGreaterThan(0);
 expect(evidence.encodes).toEqual([]);expect(evidence.violations).toEqual([]);expect(errors).toEqual([]);
 const summary=JSON.stringify({...evidence,workers:evidence.workers.map(w=>({...w,responses:w.responses.map(r=>({...r,bytes:r.bytes.length}))})),decoded,downloadBytes:bytes.length},null,2);
 await import('node:fs/promises').then(fs=>fs.writeFile(info.outputPath('jpeg-worker-evidence.json'),summary));
 await info.attach('jpeg-worker-evidence',{body:summary,contentType:'application/json'});
});
test('production main Canvas fallback exports under real CSP',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'OffscreenCanvas',{value:undefined});});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{(window as unknown as EvidenceWindow).violations=[];document.addEventListener('securitypolicyviolation',e=>(window as unknown as EvidenceWindow).violations.push(e.violatedDirective));});
 await page.goto('/');await page.getByLabel('Choose file').setInputFiles('tests/fixtures/images/exif-6.png');
 await page.getByLabel('Watermark text').fill('Canvas fallback');await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 expect(await (await event).failure()).toBeNull();
 expect(errors).toEqual([]);expect(await page.evaluate(()=>(window as unknown as EvidenceWindow).violations)).toEqual([]);
});
test('downloaded synthetic small text JPEG and final PDF zoom artifact',async({page},info)=>{
 await page.goto('/');
 const png=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1600;c.height=1000;
  const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,1600,1000);
  ctx.fillStyle='#111';ctx.font='32px system-ui';ctx.fillText('SYNTHETIC TEST CARD — NOT A REAL ID',80,90);
  for(const [i,size] of [12,16,20,24,32].entries()) {ctx.font=`${size}px system-ui`;ctx.fillText(`Sample ${size}px: ABCDEFGH 0123456789 / Local readability check`,80,180+i*120);}
  return c.toDataURL('image/png').split(',')[1];
 });
 const source=Buffer.from(png,'base64');await import('node:fs/promises').then(fs=>fs.writeFile(info.outputPath('small-text-source.png'),source));
 await page.getByLabel('Choose file').setInputFiles({name:'synthetic-small-text.png',mimeType:'image/png',buffer:source});
 await page.getByLabel('Watermark text').fill('For local testing only\n2026-10-02');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 const file=info.outputPath('small-text-final.jpg');await (await event).saveAs(file);

await page.getByRole('button',{name:'Back to edit'}).click();
 await page.getByLabel('Choose file').setInputFiles('tests/fixtures/pdf/two-pages.pdf');
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
 await (await pdfEvent).saveAs(info.outputPath('watermark-final.pdf'));
 // Independent Poppler renders actual downloaded bytes at 216dpi (3x 72dpi).
 execFileSync('pdftoppm',['-f','1','-singlefile','-r','216','-png',info.outputPath('watermark-final.pdf'),info.outputPath('pdf-watermark-3x')]);
});
