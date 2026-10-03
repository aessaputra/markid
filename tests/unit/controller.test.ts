import { expect, test, vi } from 'vitest';
import { ImageController } from '../../src/lib/editor/controller';
import type { LoadedImage } from '../../src/lib/editor/types';
const image = (): LoadedImage => ({kind:'image',size:{width:1,height:1},source:{} as CanvasImageSource,dispose:vi.fn()});
function deferred() { let resolve!: (x:LoadedImage)=>void; let reject!: (x:Error)=>void; const promise = new Promise<LoadedImage>((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; }
test('failed replacement retains current; successful replacement releases it once', async () => {
  const a=deferred(), b=deferred(), c=deferred(); const queue=[a,b,c];
  const ctl=new ImageController(()=>queue.shift()!.promise); const old=image(), next=image();
  const first=ctl.replace(new File(['a'],'a')); a.resolve(old); await first;
  const failed=ctl.replace(new File(['b'],'b')); b.reject(new Error('decode')); await failed;
  expect(ctl.current).toBe(old); expect(old.dispose).not.toHaveBeenCalled();
  const success=ctl.replace(new File(['c'],'c')); c.resolve(next); await success;
  expect(ctl.current).toBe(next); expect(old.dispose).toHaveBeenCalledTimes(1);
  ctl.dispose(); ctl.dispose(); expect(next.dispose).toHaveBeenCalledTimes(1);
});
test('stale rejection cannot erase latest loading status or error', async () => {
  const a=deferred(), b=deferred();const queue=[a,b];const ctl=new ImageController(()=>queue.shift()!.promise);
  const first=ctl.replace(new File(['a'],'a'));const second=ctl.replace(new File(['b'],'b'));
  a.reject(new Error('stale'));await first;expect(ctl.loading).toBe(true);expect(ctl.error).toBe('');
  b.reject(new Error('latest'));await second;expect(ctl.loading).toBe(false);expect(ctl.error).toBe('latest');
});
test('late completion and completion after disposal never acquire ownership', async () => {
  const a=deferred(), b=deferred(), c=deferred(); const queue=[a,b,c]; const ctl=new ImageController(()=>queue.shift()!.promise);
  const stale=image(), latest=image(), after=image();
  const first=ctl.replace(new File(['a'],'a')); const second=ctl.replace(new File(['b'],'b'));
  b.resolve(latest); await second; a.resolve(stale); await first;
  expect(ctl.current).toBe(latest); expect(stale.dispose).toHaveBeenCalledTimes(1);
  const pending=ctl.replace(new File(['c'],'c')); ctl.dispose(); c.resolve(after); await pending;
  expect(after.dispose).toHaveBeenCalledTimes(1); expect(ctl.current).toBeNull();
});
