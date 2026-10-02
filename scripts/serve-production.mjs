import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('dist');
export const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; worker-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'";
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain'};
http.createServer(async(req,res)=>{
 try {const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!path.startsWith(root+'/')&&path!==root)throw Error();const file=path===root?resolve(root,'index.html'):path;const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Cache-Control':file.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache'});res.end(data);}
 catch {res.writeHead(404);res.end();}
}).listen(5174,'127.0.0.1');
