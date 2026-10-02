import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {bmffSize} from '../../src/lib/input/containers';
const box=(type:string,payload:number[]=[])=>{const b=new Uint8Array(8+payload.length);new DataView(b.buffer).setUint32(0,b.length);b.set(new TextEncoder().encode(type),4);b.set(payload,8);return b;};
const join=(...parts:Uint8Array[])=>new Blob(parts.map(p=>new Uint8Array(p)));
const valid=new Uint8Array(readFileSync('tests/fixtures/codecs/still.avif'));
for(const [name,b] of [
 ['empty meta',box('meta')],['short meta',box('meta',[0,0,0])],
 ['short iinf',box('iinf',[0,0,0,0])],
 ['iinf count without entries',box('iinf',[0,0,0,0,0,1])],
 ['short infe',box('infe',[2,0,0,1])],
 ['parent crossing header',box('iprp',[0,0,0,8])],
] as const) test(`reject ${name} even with valid sibling metadata`,async()=>{await expect(bmffSize(join(valid,b))).rejects.toThrow();});
test('reject iinf entry count mismatch',async()=>{const b=valid.slice();const i=Buffer.from(b).indexOf('iinf');new DataView(b.buffer).setUint16(i+8,2);await expect(bmffSize(new Blob([b]))).rejects.toThrow();});
