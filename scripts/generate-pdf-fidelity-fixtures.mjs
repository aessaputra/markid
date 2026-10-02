import {PDFDocument,PDFName,PDFString} from 'pdf-lib';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const doc=await PDFDocument.create();const page=doc.addPage([400,600]);
const descriptor=doc.context.register(doc.context.obj({Type:'FontDescriptor',FontName:'HeiseiMin-W3',Flags:6,FontBBox:[0,-200,1000,900],ItalicAngle:0,Ascent:900,Descent:-200,CapHeight:700,StemV:80}));
const descendant=doc.context.register(doc.context.obj({Type:'Font',Subtype:'CIDFontType0',BaseFont:'HeiseiMin-W3',FontDescriptor:descriptor,CIDSystemInfo:{Registry:PDFString.of('Adobe'),Ordering:PDFString.of('Japan1'),Supplement:2},DW:1000}));
const font=doc.context.register(doc.context.obj({Type:'Font',Subtype:'Type0',BaseFont:'HeiseiMin-W3',Encoding:'90ms-RKSJ-H',DescendantFonts:[descendant]}));
page.node.setFontDictionary(PDFName.of('CJK'),font);page.node.addContentStream(doc.context.register(doc.context.stream('BT /CJK 24 Tf 40 400 Td <82A082A2> Tj ET')));
await writeFile('tests/fixtures/pdf/cmap.pdf',await doc.save());
const boxes=await PDFDocument.create();
for(const [crop,rotation] of [[[600,800,900,1000],0],[[20,30,20,30],90],[[20,30,80],180],[[20,'invalid',400,600],270],[[-50,30,400,800],45],[[20,30,400,600],-90],[[20,30,400,600],450],[[20,30,400,600],0]]){
 const p=boxes.addPage([500,700]);p.node.set(PDFName.of('CropBox'),boxes.context.obj(crop));p.node.set(PDFName.of('Rotate'),boxes.context.obj(rotation));p.node.set(PDFName.of('UserUnit'),boxes.context.obj(2));
}
await writeFile('tests/fixtures/pdf/normalized-boxes.pdf',await boxes.save());
const entries={};for(const dir of ['standard_fonts','cmaps'])for(const name of await readdir(`public/pdf-assets/${dir}`)){if(!/\.(pfb|ttf|bcmap)$/.test(name))continue;const b=await readFile(`public/pdf-assets/${dir}/${name}`);entries[`${dir}/${name}`]={size:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
await writeFile('src/lib/pdf/resource-manifest.json',JSON.stringify(entries,null,2)+'\n');
const b=await readFile('tests/fixtures/pdf/cmap.pdf');const boxBytes=await readFile('tests/fixtures/pdf/normalized-boxes.pdf');await writeFile('tests/fixtures/pdf/fidelity-manifest.json',JSON.stringify({generator:'scripts/generate-pdf-fidelity-fixtures.mjs; pdf-lib 1.17.1',license:'CC0-1.0',normalizedBoxes:{file:'normalized-boxes.pdf',bytes:boxBytes.length,sha256:createHash('sha256').update(boxBytes).digest('hex'),description:'Eight genuine malformed/empty/nonoverlap/intersected CropBoxes, Rotate 45/-90/450/quarter turns, UserUnit 2'},file:'cmap.pdf',description:'Genuine Type0 Japan1 predefined 90ms-RKSJ-H CMap requirement, synthetic Japanese codes',bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},null,2)+'\n');
