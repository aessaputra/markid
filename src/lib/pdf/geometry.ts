import type {Point,Size} from '../editor/types';
export type Box={x:number;y:number;width:number;height:number};
export function displaySize(box:Box,rotation:number):Size {
 if(![0,90,180,270].includes(rotation)) throw new Error('Unsupported PDF page rotation.');
 return rotation%180 ? {width:box.height,height:box.width}:{width:box.width,height:box.height};
}
export function displayToPdf(p:Point,b:Box,rotation:number):Point {
 displaySize(b,rotation);
 switch(rotation){
 case 90:return {x:b.x+p.y,y:b.y+p.x};
 case 180:return {x:b.x+b.width-p.x,y:b.y+p.y};
 case 270:return {x:b.x+b.width-p.y,y:b.y+b.height-p.x};
 default:return {x:b.x+p.x,y:b.y+b.height-p.y};
 }
}
/** PDF image origin is its rotated lower-left, not its center. */
export function imagePlacement(b:Box,rotation:number,mark:{x:number;y:number;angle:number},width:number,height:number){
 const size=displaySize(b,rotation), center=displayToPdf({x:mark.x*size.width,y:mark.y*size.height},b,rotation);
 const angle=rotation-mark.angle,r=angle*Math.PI/180;
 return {x:center.x-width/2*Math.cos(r)+height/2*Math.sin(r),y:center.y-width/2*Math.sin(r)-height/2*Math.cos(r),angle};
}
