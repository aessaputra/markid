import {expect,test} from '@playwright/test';
test('result view awaits a real result without a fake download',async ({page}) => {
 await page.goto('/');
 await page.evaluate(async () => {
 const {mount}=await import(String('/node_modules/.vite/deps/svelte.js'));
 const {default: ResultView}=await import(String('/src/lib/ui/ResultView.svelte'));
 mount(ResultView,{target:document.body,props:{result:null,onback:()=>{}}});
 });
 await expect(page.getByText('No result yet.',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Download',exact:true})).toHaveCount(0);
});
