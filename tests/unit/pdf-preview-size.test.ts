import {test,expect} from 'vitest';
import {pdfPreviewScale} from '../../src/lib/pdf/preview';
test('PDF raster fits the displayed page at twice CSS dimensions without legacy caps',()=>{
 expect(pdfPreviewScale({width:600,height:800},{width:1800,height:2000})).toBe(5);
 expect(pdfPreviewScale({width:800,height:600},{width:300,height:500})).toBe(.75);
 expect(()=>pdfPreviewScale({width:600,height:800},{width:0,height:500})).toThrow();
});
