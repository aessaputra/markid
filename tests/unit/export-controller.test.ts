import {expect,test,vi} from 'vitest';
import {ExportController} from '../../src/lib/editor/controller';
import type {ExportResult,LoadedImage} from '../../src/lib/editor/types';
const image={kind:'image',size:{width:1,height:1},source:{},dispose(){},resized:false} as LoadedImage;
const mark={text:'before',fontFamily:'Geist',sizeRatio:.05,x:.5,y:.5,angle:0,opacity:0,color:'#000'};
function pending(){let resolve!:(r:ExportResult)=>void;let reject!:(e:Error)=>void;return {promise:new Promise<ExportResult>((a,b)=>{resolve=a;reject=b;}),resolve:(r:ExportResult)=>resolve(r),reject:(e:Error)=>reject(e)};}
const result=():ExportResult=>({kind:'image',blob:new Blob(['x']),dispose:vi.fn()});
test('single active snapshot, invalidation releases stale result without changing newer state',async()=>{
 const a=pending(),b=pending();const queue=[a,b];const codec=vi.fn((_image:LoadedImage,_mark:typeof mark)=>queue.shift()!.promise);
 const c=new ExportController(codec);const first=c.prepare(image,mark);mark.text='after';
 await c.prepare(image,mark);expect(codec).toHaveBeenCalledTimes(1);expect(codec.mock.calls[0][1].text).toBe('before');
 c.invalidate();const second=c.prepare(image,mark);const stale=result();a.resolve(stale);await first;
 expect(stale.dispose).toHaveBeenCalledTimes(1);expect(c.processing).toBe(true);expect(c.result).toBeNull();
 const latest=result();b.resolve(latest);await second;expect(c.result).toBe(latest);
 c.invalidate();expect(latest.dispose).toHaveBeenCalledTimes(1);expect(c.result).toBeNull();
});
test('stale failures and disposal cannot overwrite newer job status',async()=>{
 const a=pending(),b=pending();const queue=[a,b];const c=new ExportController(()=>queue.shift()!.promise);
 const first=c.prepare(image,mark);c.invalidate();const second=c.prepare(image,mark);
 a.reject(new Error('old'));await first;expect(c.error).toBe('');expect(c.processing).toBe(true);
 c.dispose();const late=result();b.resolve(late);await second;expect(late.dispose).toHaveBeenCalledTimes(1);expect(c.result).toBeNull();
});
