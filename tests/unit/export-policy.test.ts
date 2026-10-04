import {expect,test,vi,afterEach} from 'vitest';
import {assertJpeg} from '../../src/lib/image/export-policy';
import {renderJpeg} from '../../src/lib/image/export-render';
import {composeWatermark,renderWatermark} from '../../src/lib/editor/watermark';
import type {Watermark} from '../../src/lib/editor/types';
vi.mock('../../src/lib/editor/watermark',()=>({composeWatermark:vi.fn(),renderWatermark:vi.fn()}));
const mark:Watermark={text:'Only',sizeRatio:.05,x:.5,y:.5,angle:0,opacity:.3,color:'#888888',mode:'single'};
const source={} as ImageBitmap;
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
function canvasMock(offscreen:boolean,blob:Blob|null) {
 const ctx={fillStyle:'',fillRect:vi.fn(),drawImage:vi.fn()};
 const encode=vi.fn<(...args:unknown[])=>Promise<Blob|null>>(()=>Promise.resolve(blob));
 const canvas={width:0,height:0,getContext:()=>ctx,...(offscreen
  ? {convertToBlob:encode}
  : {toBlob:(callback:(blob:Blob|null)=>void,type:string,quality:number)=>{void encode(type,quality).then(callback);}})};
 const allocate=vi.fn(function(){return canvas;});
 vi.stubGlobal('OffscreenCanvas',allocate);vi.stubGlobal('document',{createElement:allocate});
 const bitmap={close:vi.fn()} as unknown as ImageBitmap;
 vi.mocked(renderWatermark).mockResolvedValue(bitmap);
 return {canvas,ctx,encode,allocate,bitmap};
}
for(const offscreen of [false,true]) {
 test(`renderer ${offscreen?'worker':'main'} encodes original dimensions once at .92 above 1MiB`,async()=>{
  const blob=new Blob([new Uint8Array(1048577)],{type:'image/jpeg'}),mock=canvasMock(offscreen,blob);
  const size={width:8000,height:6000};const pending=renderJpeg(source,size,mark,offscreen);
  if(!offscreen)expect(mock.allocate).not.toHaveBeenCalled();
  const result=await pending;expect(result).toEqual({blob,size});expect(result.size).not.toBe(size);
  expect(mock.encode).toHaveBeenCalledExactlyOnceWith(...(offscreen?[{type:'image/jpeg',quality:.92}]:['image/jpeg',.92]));
  expect(mock.ctx.fillRect).toHaveBeenCalledExactlyOnceWith(0,0,8000,6000);
  expect(mock.ctx.drawImage).toHaveBeenCalledExactlyOnceWith(source,0,0,8000,6000);
  expect(renderWatermark).toHaveBeenCalledExactlyOnceWith(mark,size);
  expect(composeWatermark).toHaveBeenCalledExactlyOnceWith(mock.ctx,mock.bitmap,mark,size);
  expect(mock.bitmap.close).toHaveBeenCalledTimes(1);expect(mock.canvas.width).toBe(0);expect(mock.canvas.height).toBe(0);
 });
 test(`renderer ${offscreen?'worker':'main'} rejects null, empty and wrong MIME without retries`,async()=>{
  for(const blob of [null,new Blob([],{type:'image/jpeg'}),new Blob(['x'],{type:'image/png'})]) {
   const mock=canvasMock(offscreen,blob);
   expect(()=>assertJpeg(blob)).toThrow('Export failed. Try again.');
   await expect(renderJpeg(source,{width:10,height:10},mark,offscreen)).rejects.toThrow('Export failed. Try again.');
   expect(mock.encode).toHaveBeenCalledTimes(1);expect(mock.bitmap.close).toHaveBeenCalledTimes(1);
   expect(mock.canvas.width).toBe(0);expect(mock.canvas.height).toBe(0);vi.clearAllMocks();
  }
 });
 test(`renderer ${offscreen?'worker':'main'} releases bitmap and canvas on composition failure`,async()=>{
  const mock=canvasMock(offscreen,new Blob(['x'],{type:'image/jpeg'}));
  vi.mocked(composeWatermark).mockImplementationOnce(()=>{throw new Error('compose failed');});
  await expect(renderJpeg(source,{width:10,height:10},mark,offscreen)).rejects.toThrow('compose failed');
  expect(mock.encode).not.toHaveBeenCalled();expect(mock.bitmap.close).toHaveBeenCalledTimes(1);
  expect(mock.canvas.width).toBe(0);expect(mock.canvas.height).toBe(0);
 });
 test(`renderer ${offscreen?'worker':'main'} rejects unsafe dimensions before allocation or encode`,async()=>{
  const mock=canvasMock(offscreen,new Blob(['x'],{type:'image/jpeg'}));
  for(const size of [{width:2**32,height:2**32},...[0,-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1].flatMap(value=>[{width:value,height:1},{width:1,height:value}])])
   await expect(renderJpeg(source,size,mark,offscreen)).rejects.toThrow('Could not open this file. Try a JPG or PNG.');
  expect(mock.allocate).not.toHaveBeenCalled();expect(mock.encode).not.toHaveBeenCalled();expect(renderWatermark).not.toHaveBeenCalled();
 });
}
