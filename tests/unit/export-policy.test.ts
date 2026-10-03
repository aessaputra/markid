import {expect,test,vi} from 'vitest';
import {assertJpeg,encodeJpeg} from '../../src/lib/image/export-policy';
test('single JPEG encode preserves original dimensions at .92 even above 1MiB',async()=>{
 const blob=new Blob([new Uint8Array(1048577)],{type:'image/jpeg'}),encode=vi.fn(async()=>blob);
 const size={width:8000,height:6000};expect(await encodeJpeg(size,encode)).toEqual({blob,size});
 expect(encode).toHaveBeenCalledExactlyOnceWith(size,.92);
});
test('null, empty and wrong MIME remain errors without retries',async()=>{
 for(const blob of [null,new Blob([],{type:'image/jpeg'}),new Blob(['x'],{type:'image/png'})]) {
 expect(()=>assertJpeg(blob)).toThrow('Export failed. Try again.');const encode=vi.fn(async()=>blob);
 await expect(encodeJpeg({width:10,height:10},encode)).rejects.toThrow('Export failed. Try again.');expect(encode).toHaveBeenCalledTimes(1);
 }
});
