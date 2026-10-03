import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = (name:string) => `tests/fixtures/images/${name}`;
for (const format of ['jpg','png']) {
for (const fallback of [false,true]) {
  for (let orientation=1;orientation<=8;orientation++) {
    test(`${format} EXIF ${orientation} normalized exactly once (${fallback ? 'HTML fallback' : 'bitmap'})`, async ({page}) => {
      await page.goto('/');
      const bytes = [...readFileSync(fixture(`exif-${orientation}.${format}`))];
      const result = await page.evaluate(async ({bytes,fallback}) => {
        if (fallback) Object.defineProperty(window,'createImageBitmap',{value:undefined,configurable:true});
        const {loadImage} = await import(/* @vite-ignore */ String('/src/lib/image/load.ts')) as typeof import('../../src/lib/image/load');
        const loaded = await loadImage(new File([new Uint8Array(bytes)],'false.png',{type:'image/png'}));
        const canvas = document.createElement('canvas'); canvas.width=loaded.size.width; canvas.height=loaded.size.height;
        const ctx=canvas.getContext('2d')!; ctx.drawImage(loaded.source,0,0);
        const corners = [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>{
          const p=ctx.getImageData(Math.floor(x*canvas.width),Math.floor(y*canvas.height),1,1).data;
          return p[0]>180 ? (p[1]>180 ? 'Y':'R') : p[1]>180 ? 'G':'B';
        });
        const size=loaded.size; const sourceKind=loaded.source instanceof ImageBitmap ? 'bitmap':'canvas';
        const source=loaded.source as ImageBitmap | HTMLCanvasElement;
        const sourceSize={width:source.width,height:source.height};
        loaded.dispose(); loaded.dispose(); return {size,corners,sourceKind,sourceSize};
      },{bytes,fallback});
      const scale=1;
      expect(result.size).toEqual(orientation>=5 ? {width:80*scale,height:120*scale}:{width:120*scale,height:80*scale});
      const expected=[['R','G','B','Y'],['G','R','Y','B'],['Y','B','G','R'],['B','Y','R','G'],['R','B','G','Y'],['B','R','Y','G'],['Y','G','B','R'],['G','Y','R','B']];
      expect(result.corners).toEqual(expected[orientation-1]);
      expect(result.sourceKind).toBe(fallback ? 'canvas':'bitmap');
      expect(result.sourceSize).toEqual(result.size);
    });
  }
}
}
test('12MP/48MP inputs preserve original dimensions', async ({page}) => {
  await page.goto('/');
  for (const name of ['12mp.jpg','48mp.jpg']) {
    const bytes=[...readFileSync(fixture(name))]; expect(bytes.length).toBeLessThan(10_000_000);
    const result=await page.evaluate(async bytes=>{
      const {loadImage}=await import(/* @vite-ignore */ String('/src/lib/image/load.ts')) as typeof import('../../src/lib/image/load');
      const image=await loadImage(new File([new Uint8Array(bytes)],'large.jpg'));
      const result={size:image.size,resized:image.resized};image.dispose();return result;
    },bytes);
    expect(result).toEqual({size:name==='12mp.jpg'?{width:4000,height:3000}:{width:8000,height:6000},resized:false});
  }
});
test('bitmap rejection falls back; URL cleanup and PNG alpha survive', async ({page}) => {
  await page.goto('/');
  const result=await page.evaluate(async bytes=>{
    const original = URL.createObjectURL.bind(URL), revoke=URL.revokeObjectURL.bind(URL);
    let created=0,revoked=0;
    URL.createObjectURL=blob=>{created++;return original(blob);};
    URL.revokeObjectURL=url=>{revoked++;revoke(url);};
    window.createImageBitmap=async()=>{throw new Error('forced unsupported options');};
    const {loadImage}=await import(String('/src/lib/image/load.ts')) as typeof import('../../src/lib/image/load');
    const image=await loadImage(new File([new Uint8Array(bytes)],'alpha.png'));
    const c=image.source as HTMLCanvasElement;const alpha=c.getContext('2d')!.getImageData(0,0,1,1).data[3];
    image.dispose();image.dispose();
    // Complete IHDR + IEND with no IDAT: metadata parser succeeds, real decoder fails.
    const corrupt=new Uint8Array(45);
    corrupt.set(bytes.slice(0,33)); corrupt.set(bytes.slice(-12),33);
    let rejected=false;
    try {await loadImage(new File([corrupt],'corrupt.png'));} catch { rejected=true; }
    return {created,revoked,alpha,width:c.width,height:c.height,rejected};
  },[...readFileSync(fixture('alpha.png'))]);
  expect(result).toEqual({created:2,revoked:2,alpha:128,width:0,height:0,rejected:true});
});
test('file picker loads PNG and retains preview on corrupt replacement', async ({page}) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(fixture('alpha.png'));
  await expect(page.getByLabel('Watermark text')).toBeVisible();
  await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','32');
  await page.locator('input[type=file]').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:readFileSync(fixture('exif-1.jpg')).subarray(0,200)});
  await expect(page.getByRole('alert')).toContainText('Could not open this file. Try a JPG or PNG.');
  await expect(page.getByLabel('Image preview')).toHaveAttribute('data-image-width','32');
});
