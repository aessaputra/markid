import type {LoadedPdf} from '../editor/types';
import {checkFileSize} from '../input/policy';
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist';
export const LOCKED='PDF is locked. Unlock it and try again.';
export const BROKEN='Could not open this PDF. Try another.';
export const SIGNED='Signed PDFs are not supported yet.';
type State={doc:PDFDocumentProxy;render?:RenderTask;revision:number;disposed:boolean};
export const states=new WeakMap<LoadedPdf,State>();
export async function openPdf(bytes:Uint8Array):Promise<LoadedPdf>{
 const lib=await import('pdf-lib');
 try {
  const doc=await lib.PDFDocument.load(bytes.slice(),{updateMetadata:false});
  // Conservative recognized-object check, not a guarantee of exhaustive signature detection.
  for(const [,object] of doc.context.enumerateIndirectObjects()){
   if(object instanceof lib.PDFDict && (object.get(lib.PDFName.of('Type'))===lib.PDFName.of('Sig') || object.get(lib.PDFName.of('FT'))===lib.PDFName.of('Sig') || object.has(lib.PDFName.of('ByteRange')))) throw new Error(SIGNED);
  }
 }catch(error){if(error instanceof lib.EncryptedPDFError || (error instanceof Error && /encrypted/i.test(error.message)))throw new Error(LOCKED);if(error instanceof Error && error.message===SIGNED)throw error;throw new Error(BROKEN,{cause:error});}
 const js=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const {default:worker}=await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
 js.GlobalWorkerOptions.workerSrc=worker;
 const task=js.getDocument({data:bytes.slice(),isEvalSupported:false,useSystemFonts:false,
  cMapUrl:'/pdf-assets/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf-assets/standard_fonts/'});
 try{
  const doc=await task.promise;
  const state:State={doc,revision:0,disposed:false};
  const pdf:LoadedPdf={kind:'pdf',bytes:bytes.slice(),pageCount:doc.numPages,dispose(){if(state.disposed)return;state.disposed=true;++state.revision;state.render?.cancel();void task.destroy();pdf.bytes=new Uint8Array();}};
  states.set(pdf,state);return pdf;
 }catch(error){await task.destroy();throw new Error(BROKEN,{cause:error});}
}
export async function loadPdf(file:File):Promise<LoadedPdf>{checkFileSize(file.size);return openPdf(new Uint8Array(await file.arrayBuffer()));}
