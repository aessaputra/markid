import {expect,test} from 'vitest';
import {assertJpeg, candidates, encodeBounded} from '../../src/lib/image/export-policy';
test('experimental schedule is bounded to 16 proportional candidates',()=>{
 const schedule=candidates({width:2400,height:3200});
 expect(schedule).toHaveLength(16);
 expect(schedule[0]).toEqual({size:{width:2400,height:3200},quality:.92});
 expect(schedule[15]).toEqual({size:{width:1320,height:1760},quality:.70});
});
test('null, empty and wrong MIME are errors; oversize is never a success',async()=>{
 for(const b of [null,new Blob([],{type:'image/jpeg'}),new Blob(['x'],{type:'image/png'}),new Blob([new Uint8Array(1048577)],{type:'image/jpeg'})]) expect(()=>assertJpeg(b)).toThrow('Export failed. Try again.');
 assertJpeg(new Blob([new Uint8Array(1048576)],{type:'image/jpeg'}));
 let attempts=0;
 await expect(encodeBounded({width:10,height:10},async()=>{attempts++;return new Blob([new Uint8Array(1048577)],{type:'image/jpeg'});})).rejects.toThrow('Export failed. Try again.');
 expect(attempts).toBe(16);
});
