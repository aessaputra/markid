import {PDFDocument,StandardFonts,degrees,PDFName} from 'pdf-lib';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='tests/fixtures/pdf';await mkdir(dir,{recursive:true});
const manifest=[];
async function save(name,doc,description){const b=await doc.save();await writeFile(`${dir}/${name}.pdf`,b);manifest.push({file:`${name}.pdf`,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),description});}
const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);
for(const [i,size] of [[0,[400,600]],[1,[800,400]]]){const p=doc.addPage(size);p.drawText(`Original page ${i+1}`,{x:45,y:100,font,size:18});}
await save('two-pages',doc,'Original synthetic text/vector mixed-size pages, Helvetica.');
const rotated=await PDFDocument.create();const f=await rotated.embedFont(StandardFonts.Helvetica);
for(const rotation of [0,90,180,270]){const p=rotated.addPage([500,700]);p.setCropBox(20,30,400,600);p.setRotation(degrees(rotation));p.drawText(`Rotation ${rotation}`,{x:50,y:100,font:f});}
await save('rotated-crop',rotated,'Four true page rotations and nonzero CropBox.');
const scan=await PDFDocument.create();const png=await scan.embedPng(await readFile('tests/fixtures/images/alpha.png'));const p=scan.addPage([400,600]);p.drawImage(png,{x:0,y:0,width:400,height:600});await save('scan',scan,'Synthetic geometric portrait artwork embedded as scan.');
const signed=await PDFDocument.create();signed.addPage();signed.context.register(signed.context.obj({Type:'Sig',ByteRange:[0,1,2,3]}));await save('signed',signed,'Recognized signature dictionary sentinel, not a cryptographic signature.');
const large=await PDFDocument.create();const raw=new Uint8Array(700*700*3);let seed=42;for(let i=0;i<raw.length;i++){seed=(seed*1664525+1013904223)>>>0;raw[i]=seed>>>24;}
const imageRef=large.context.register(large.context.stream(raw,{Type:'XObject',Subtype:'Image',Width:700,Height:700,ColorSpace:'DeviceRGB',BitsPerComponent:8}));
const big=large.addPage([700,700]);big.node.setXObject(PDFName.of('Scan'),imageRef);const contents=large.context.register(large.context.stream('q 700 0 0 700 0 0 cm /Scan Do Q'));big.node.addContentStream(contents);
await save('large-scan',large,'Deterministic synthetic random RGB scan, uncompressed image stream; >1MiB PDF, below 10MB.');
await writeFile(`${dir}/broken.pdf`,'%PDF-1.7\ninvalid');
await writeFile(`${dir}/manifest.json`,JSON.stringify({license:'CC0-1.0; original synthetic fixtures, no personal data',generator:'scripts/generate-pdf-fixtures.mjs; pdf-lib 1.17.1',files:manifest},null,2));
