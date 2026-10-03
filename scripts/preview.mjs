import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api')) {res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:{code:'SETUP_REQUIRED',message:'ตัวอย่างในเครื่อง: เปิด /?demo=1 เพื่อดู UI หรือใช้ Vercel สำหรับฐานข้อมูลจริง'}}));return;}
 const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const bytes=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'0.0.0.0',()=>console.log('Preview: http://localhost:4173/?demo=1'));
