import { expect, test } from 'vitest';
import { composeTiledWatermark, tiledCenters } from '../../src/lib/editor/watermark';

const area = { width: 1200, height: 800 }, tile = { width: 200, height: 40 };
for (const angle of [0, 45, -45, 90]) test(`centered rectangular text-aligned lattice at ${angle}`, () => {
  const centers = tiledCenters(area, tile, angle);
  expect(centers).toContainEqual({ x: 600, y: 400 });
  const theta = angle * Math.PI / 180, cos = Math.cos(theta), sin = Math.sin(theta);
  const local = centers.map(p => ({ x: (p.x-600)*cos+(p.y-400)*sin, y: -(p.x-600)*sin+(p.y-400)*cos }));
  for (const p of local) {
    expect(p.x / 250).toBeCloseTo(Math.round(p.x / 250), 8);
    expect(p.y / 70).toBeCloseTo(Math.round(p.y / 70), 8);
  }
  expect(local.some(p => Math.abs(p.x-250)<1e-8 && Math.abs(p.y)<1e-8)).toBe(true);
  expect(local.some(p => Math.abs(p.x)<1e-8 && Math.abs(p.y-70)<1e-8)).toBe(true);
  const hx = Math.abs(cos)*100+Math.abs(sin)*20, hy = Math.abs(sin)*100+Math.abs(cos)*20;
  for (const p of centers) { expect(p.x+hx).toBeGreaterThanOrEqual(-1e-8); expect(p.x-hx).toBeLessThanOrEqual(1200+1e-8); expect(p.y+hy).toBeGreaterThanOrEqual(-1e-8); expect(p.y-hy).toBeLessThanOrEqual(800+1e-8); }
});

test('rotated extents cull and retain all intersecting tiles', () => {
  const a={width:100,height:80}, t={width:90,height:10}, angle=45;
  const centers=tiledCenters(a,t,angle);
  const cos=Math.SQRT1_2,sin=Math.SQRT1_2,h=(t.width+t.height)*cos/2;
  const expected=[];
  for(let j=-20;j<=20;j++) for(let i=-20;i<=20;i++){
    const x=50+i*112.5*cos-j*17.5*sin,y=40+i*112.5*sin+j*17.5*cos;
    if(x+h>=0 && x-h<=100 && y+h>=0 && y-h<=80) expected.push({x,y});
  }
  expect(centers.length).toBe(expected.length);
  for(const p of expected) expect(centers.some(q=>Math.abs(p.x-q.x)<1e-8 && Math.abs(p.y-q.y)<1e-8)).toBe(true);
  expect(centers.some(p=>p.y<0 || p.y>80)).toBe(true);
});

test('dense pattern remains bounded and symmetric across whole page', () => {
  const centers=tiledCenters(area,{width:.01,height:.01},45);
  expect(centers.length).toBeLessThanOrEqual(4096);
  expect(centers.length).toBeGreaterThan(100);
  for(const p of centers) expect(centers.some(q=>Math.abs(q.x-(1200-p.x))<1e-7 && Math.abs(q.y-(800-p.y))<1e-7)).toBe(true);
  expect(Math.min(...centers.map(p=>p.y))).toBeLessThan(30);
  expect(Math.max(...centers.map(p=>p.y))).toBeGreaterThan(770);
});

for(const value of [0,-1,NaN,Infinity,-Infinity]) for(const field of ['width','height'] as const) test(`rejects ${field}=${value}`,()=>{
  expect(()=>tiledCenters({...area,[field]:value},tile,0)).toThrow(RangeError);
  expect(()=>tiledCenters(area,{...tile,[field]:value},0)).toThrow(RangeError);
});

test('tile draw failure balances each Canvas save',()=>{
  let depth=0;
  const ctx={save(){depth++;},restore(){depth--;},translate(){},rotate(){},drawImage(){throw new Error('draw');},globalAlpha:1};
  expect(()=>composeTiledWatermark(ctx as unknown as CanvasRenderingContext2D,{width:200,height:40} as ImageBitmap,{mode:'tiled',angle:0,opacity:1} as never,area)).toThrow('draw');
  expect(depth).toBe(0);
});
