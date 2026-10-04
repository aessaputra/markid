import {test,expect} from 'vitest';
import {displayToPdf, imagePlacement, displaySize} from '../../src/lib/pdf/geometry';
const box={x:20,y:30,width:400,height:600};
for(const {rotation,corners,anchor} of [
 {rotation:0,corners:[[20,630],[420,630],[420,30],[20,30]],anchor:[120,450]},
 {rotation:90,corners:[[20,30],[20,630],[420,630],[420,30]],anchor:[140,180]},
 {rotation:180,corners:[[420,30],[20,30],[20,630],[420,630]],anchor:[320,210]},
 {rotation:270,corners:[[420,630],[420,30],[20,30],[20,630]],anchor:[300,480]},
]) test(`CropBox ${rotation} corners, center and off-center image basis`,()=>{
 const size=displaySize(box,rotation);
 expect(displayToPdf({x:size.width/2,y:size.height/2},box,rotation)).toEqual({x:220,y:330});
 for(const [i,p] of [{x:0,y:0},{x:size.width,y:0},{x:size.width,y:size.height},{x:0,y:size.height}].entries())expect(displayToPdf(p,box,rotation)).toEqual({x:corners[i][0],y:corners[i][1]});
 const p=imagePlacement(box,rotation,{x:.25,y:.3,angle:37},80,20),r=(rotation-37)*Math.PI/180;
 expect(p.angle).toBe(rotation-37);
 const center={x:p.x+40*Math.cos(r)-10*Math.sin(r),y:p.y+40*Math.sin(r)+10*Math.cos(r)};
 expect(center.x).toBeCloseTo(anchor[0]);expect(center.y).toBeCloseTo(anchor[1]);
 const expected=displayToPdf({x:size.width*.25,y:size.height*.3},box,rotation);
 expect(center.x).toBeCloseTo(expected.x);expect(center.y).toBeCloseTo(expected.y);
});
