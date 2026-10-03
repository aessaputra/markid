import {expect,test,vi} from 'vitest';
import {ExportController} from '../../src/lib/editor/controller';
import type {ExportResult,LoadedImage,LoadedSource,Watermark} from '../../src/lib/editor/types';
const image={kind:'image',size:{width:1,height:1},source:{},dispose(){},resized:false} as LoadedImage;
const mark:Watermark={text:'before',sizeRatio:.05,x:.5,y:.5,angle:0,opacity:0,color:'#000',mode:'single'};
function pending(){let resolve!:(r:ExportResult)=>void;let reject!:(e:Error)=>void;return {promise:new Promise<ExportResult>((a,b)=>{resolve=a;reject=b;}),resolve:(r:ExportResult)=>resolve(r),reject:(e:Error)=>reject(e)};}
const result=():ExportResult=>({kind:'image',blob:new Blob(['x']),dispose:vi.fn()});
for(const outcome of ['resolve','reject'] as const) test(`invalidation retains single in-flight lock until stale ${outcome} settles`,async()=>{
 const a=pending(),b=pending(),queue=[a,b];let active=0,maxActive=0;
 const codec=vi.fn(async(_image:LoadedSource,_mark:typeof mark)=>{
  active++;maxActive=Math.max(maxActive,active);
  try{return await queue.shift()!.promise;}finally{active--;}
 });
 const changed=vi.fn();const c=new ExportController(codec,changed);
 const snapshot={...mark};const first=c.prepare(image,snapshot);snapshot.text='after';
 c.invalidate();await c.prepare(image,snapshot);
 expect(codec).toHaveBeenCalledTimes(1);expect(c.processing).toBe(true);
 expect(codec.mock.calls[0][1].text).toBe('before');
 const stale=result();if(outcome==='resolve')a.resolve(stale);else a.reject(new Error('old'));
 const notifications=changed.mock.calls.length;await first;
 expect(c.processing).toBe(false);expect(changed.mock.calls.length).toBeGreaterThan(notifications);
 expect(c.error).toBe('');expect(c.result).toBeNull();
 if(outcome==='resolve')expect(stale.dispose).toHaveBeenCalledTimes(1);
 const second=c.prepare(image,snapshot);expect(codec).toHaveBeenCalledTimes(2);
 const latest=result();b.resolve(latest);await second;
 expect(maxActive).toBe(1);expect(active).toBe(0);expect(c.result).toBe(latest);
 c.invalidate();expect(latest.dispose).toHaveBeenCalledTimes(1);expect(c.result).toBeNull();
});
test('disposal invalidates pending work but retains lock until settlement and never accepts replacement',async()=>{
 const a=pending();const codec=vi.fn(()=>a.promise);const c=new ExportController(codec);
 const first=c.prepare(image,mark);c.dispose();c.dispose();
 expect(c.processing).toBe(true);await c.prepare(image,mark);expect(codec).toHaveBeenCalledTimes(1);
 const late=result();a.resolve(late);await first;
 expect(c.processing).toBe(false);expect(late.dispose).toHaveBeenCalledTimes(1);expect(c.result).toBeNull();expect(c.error).toBe('');
});
