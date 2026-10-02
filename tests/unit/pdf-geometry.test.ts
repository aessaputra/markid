import {test,expect} from 'vitest';
import {displayToPdf, imagePlacement, displaySize} from '../../src/lib/pdf/geometry';
const box={x:20,y:30,width:400,height:600};
for(const rotation of [0,90,180,270]) test(`CropBox ${rotation} center and image basis`,()=>{
 const size=displaySize(box,rotation);
 expect(displayToPdf({x:size.width/2,y:size.height/2},box,rotation)).toEqual({x:220,y:330});
 const p=imagePlacement(box,rotation,{x:.25,y:.3,angle:37},80,20);
 const r=p.angle*Math.PI/180;
 const center={x:p.x+40*Math.cos(r)-10*Math.sin(r),y:p.y+40*Math.sin(r)+10*Math.cos(r)};
 const expected=displayToPdf({x:size.width*.25,y:size.height*.3},box,rotation);
 expect(center.x).toBeCloseTo(expected.x);expect(center.y).toBeCloseTo(expected.y);
 expect(p.angle).toBe(rotation-37);
});
test('all rotated corners include CropBox origin',()=>{
 expect(displayToPdf({x:0,y:0},box,0)).toEqual({x:20,y:630});
 expect(displayToPdf({x:0,y:0},box,90)).toEqual({x:20,y:30});
 expect(displayToPdf({x:0,y:0},box,180)).toEqual({x:420,y:30});
 expect(displayToPdf({x:0,y:0},box,270)).toEqual({x:420,y:630});
});
