import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Observe every request, including lazy workers/assets; a GET or same hostname is not safe.
for (const [kind, path] of [
 ['image', 'tests/fixtures/images/exif-6.png'],
 ['HEIC fallback', 'tests/fixtures/codecs/encoded.heic'],
 ['PDF', 'tests/fixtures/pdf/two-pages.pdf'],
] as const) test(`${kind}: source, filename and watermark never leave memory during actual download`, async ({ page, context, baseURL }, testInfo) => {
 const secret = 'PRIVATE-FIXTURE-TEXT-8b3c';
 const filename = `PRIVATE-FILENAME-8b3c.${path.split('.').pop()}`;
 const source = await readFile(path);
 const requests: { url: string; method: string; body: Buffer | null }[] = [];
 const logs: string[] = [];
 const sockets: string[] = [];
 context.on('request', r => requests.push({url:r.url(),method:r.method(),body:r.postDataBuffer()}));
 page.on('console', m => logs.push(m.text()));
 page.on('websocket', s => sockets.push(s.url()));
 await page.addInitScript(() => {
  const state = window as unknown as { persistence: string[] };
  state.persistence = [];
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k,v) { state.persistence.push(`storage:${k}:${v}`); return set.call(this,k,v); };
  const open = indexedDB.open.bind(indexedDB);
  indexedDB.open = (...args) => { state.persistence.push(`indexedDB:${args[0]}`); return open(...args); };
  const put = Cache.prototype.put;
  Cache.prototype.put = function(...args) {state.persistence.push('cache.put');return put.apply(this,args);};
 });
 await page.goto('/');
 await page.evaluate(() => document.fonts.ready);
 await page.waitForLoadState('networkidle');
 const initialRequests = requests.length;
 await page.getByLabel('Choose file').setInputFiles({name:filename,mimeType:kind==='PDF'?'application/pdf':kind==='image'?'image/png':'image/heic',buffer:source});
 await page.getByLabel('Watermark text').fill(secret);
 await page.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download',exact:true})).toBeEnabled({timeout:30000});
 const pending=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download',exact:true}).click();
 const download=await pending;
 await download.saveAs(testInfo.outputPath(kind==='PDF'?'privacy.pdf':'privacy.jpg'));
 expect(await download.failure()).toBeNull();
 const exported=await readFile(testInfo.outputPath(kind==='PDF'?'privacy.pdf':'privacy.jpg'));
 expect(exported.length).toBeGreaterThan(100);
 expect(exported.subarray(0,kind==='PDF'?4:2).toString('hex')).toBe(kind==='PDF'?'25504446':'ffd8');
 await page.getByRole('button',{name:'Back to edit'}).click();
 await page.getByLabel('Watermark text').fill('Changed');
 await page.waitForLoadState('networkidle');
 for (const request of requests) {
  // Blob/data are local virtual URLs, never HTTP egress. No arbitrary origins/ports.
  const url = new URL(request.url);
  if (['http:','https:'].includes(url.protocol)) expect(url.origin).toBe(new URL(baseURL!).origin);
  else expect(['blob:','data:']).toContain(url.protocol);
  expect(request.method).toBe('GET');
  expect(decodeURIComponent(request.url)).not.toContain(secret);
  expect(decodeURIComponent(request.url)).not.toContain(filename);
  expect(request.url).not.toContain(source.toString('base64'));
  expect(request.url).not.toContain(source.toString('hex'));
  if(baseURL?.endsWith(':5174') && ['http:','https:'].includes(url.protocol)) {
   expect(url.search).toBe('');
   expect(url.pathname === '/' || /^\/(assets|pdf-assets)\/[A-Za-z0-9_./-]+$/.test(url.pathname)).toBe(true);
  }
  expect(request.body).toBeNull();
 }
 expect(logs.join('\n')).not.toContain(secret);
 expect(logs.join('\n')).not.toContain(filename);
 expect(logs.join('\n')).not.toContain(source.toString('base64'));
 expect(await context.cookies()).toEqual([]);
 const stored=await page.evaluate(async () => ({
  local:{...localStorage},session:{...sessionStorage},databases:await indexedDB.databases(),
  caches:await caches.keys(),workers:(await navigator.serviceWorker.getRegistrations()).length,
  writes:(window as unknown as {persistence:string[]}).persistence,
 }));
 expect(stored).toEqual({local:{},session:{},databases:[],caches:[],workers:0,writes:[]});
 // Vite's development HMR is not part of production; production must open no socket.
 if(baseURL?.endsWith(':5174')) expect(sockets).toEqual([]);
 else expect(sockets.every(u=>new URL(u).host===new URL(baseURL!).host)).toBe(true);
 if(kind==='HEIC fallback') expect(requests.slice(initialRequests).some(r=>/heic|csp/.test(r.url))).toBe(true);
 if(kind==='PDF') expect(requests.slice(initialRequests).some(r=>/pdf.worker/.test(r.url))).toBe(true);
 await testInfo.attach('privacy-observation',{body:JSON.stringify({requests:requests.map(({url,method})=>({url,method})),stored,logs,sockets},null,2),contentType:'application/json'});
});
