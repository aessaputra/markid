import type {LoadedSource} from '../editor/types';
import {identify} from './identify';
import {checkFileSize} from './policy';
import {loadImage} from '../image/load';
export async function loadSource(file:File):Promise<LoadedSource>{
 checkFileSize(file.size);
 if(await identify(file)==='pdf'){const {loadPdf}=await import('../pdf/load');return loadPdf(file);}
 return loadImage(file);
}
