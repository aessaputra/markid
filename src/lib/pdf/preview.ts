import type {LoadedPdf,LoadedImage} from '../editor/types';
import type {RenderTask} from 'pdfjs-dist';
import {states} from './load';
/** Only one active render per document; older pending page fetches cannot start a render. */
export async function previewPdf(pdf:LoadedPdf,pageIndex:number):Promise<LoadedImage>{
 const state=states.get(pdf);if(!state || state.disposed)throw new Error('PDF is closed.');
 if(!Number.isInteger(pageIndex)||pageIndex<0||pageIndex>=pdf.pageCount)throw new RangeError('Invalid PDF page.');
 const revision=++state.revision;state.render?.cancel();
 const page=await state.doc.getPage(pageIndex+1);
 let canvas:HTMLCanvasElement|undefined,render:RenderTask|undefined;
 try{
  if(state.disposed || revision!==state.revision)throw new Error('PDF preview cancelled.');
  state.resources.assert();
  const base=page.getViewport({scale:1});
  const scale=Math.min(2,1600/base.width,1600/base.height,Math.sqrt(2_000_000/(base.width*base.height)));
  const viewport=page.getViewport({scale});canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas renderer is unavailable.');
  render=page.render({canvasContext:ctx,viewport,annotationMode:0});state.render=render;
  await render.promise;state.resources.assert();
  if(state.disposed||revision!==state.revision)throw new Error('PDF preview cancelled.');
  const owned=canvas;
  return {kind:'image',size:{width:viewport.width,height:viewport.height},source:owned,resized:false,dispose(){owned.width=owned.height=0;}};
 }catch(error){if(canvas)canvas.width=canvas.height=0;throw error;}
 finally{if(state.render===render)state.render=undefined;page.cleanup();}
}
