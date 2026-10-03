import {expect,test} from '@playwright/test';
test('result mounts only for output, gates download on decode and releases its URL',async ({page}) => {
 await page.goto('/');
 await expect(page.getByRole('region',{name:'Result preview'})).toHaveCount(0);
 const initiallyDisabled=await page.evaluate(async () => {
  const {mount,unmount,flushSync}=await import(String('/node_modules/.vite/deps/svelte.js'));
  const {default: ResultView}=await import(String('/src/lib/ui/ResultView.svelte'));
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=3;
  const blob=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!), 'image/jpeg'));
  const revoked:string[]=[];const revoke=URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
  const target=document.createElement('div');document.body.append(target);
  const component=mount(ResultView,{target,props:{result:{kind:'image',blob,size:{width:2,height:3},dispose(){}},onback:()=>{}}});
  flushSync();
  Object.assign(window,{removeResult:()=>unmount(component),revokedResultUrls:revoked});
  return target.querySelector<HTMLButtonElement>('button')!.disabled;
 });
 expect(initiallyDisabled).toBe(true);
 const region=page.getByRole('region',{name:'Result preview'});
 await expect(region.getByRole('button',{name:'Download',exact:true})).toBeEnabled();
 const url=await region.getByRole('img').getAttribute('src');
 const download=page.waitForEvent('download');await region.getByRole('button',{name:'Download',exact:true}).click();
 expect((await download).suggestedFilename()).toBe('markid.jpg');
 const revoked=await page.evaluate(async()=>{
  const state=window as typeof window & {removeResult:()=>Promise<void>;revokedResultUrls:string[]};
  await state.removeResult();return state.revokedResultUrls;
 });
 expect(revoked).toEqual([url]);
 await expect(region).toHaveCount(0);
});
