import test from 'node:test';import assert from 'node:assert/strict';
import endpoint from '../api/dispatch.js';
test('Vercel entry routes request to gateway with private environment and sets HttpOnly cookie',async()=>{
 const oldFetch=globalThis.fetch,oldURL=process.env.APPS_SCRIPT_URL,oldSecret=process.env.API_SHARED_SECRET;
 process.env.APPS_SCRIPT_URL='https://script.google.com/macros/s/test-deploy/exec';process.env.API_SHARED_SECRET='server-secret';
 try{
 globalThis.fetch=async(url,init)=>{const p=JSON.parse(init.body);assert.equal(p.secret,'server-secret');assert.equal(p.action,'login');return Response.json({ok:true,data:{token:'12345678-1234-1234-1234-123456789012'.repeat(2),user:{role:'TEACHER'}}});};
 const req=new Request('https://r-fund.vercel.app/api/dispatch',{method:'POST',headers:{Origin:'https://r-fund.vercel.app'},body:JSON.stringify({action:'login',payload:{username:'teacher',password:'1234'}})});
 const res=await endpoint.fetch(req);assert.equal(res.status,200);assert.ok(res.headers.get('Set-Cookie').includes('HttpOnly'));assert.ok(!('token'in(await res.json()).data));
 }finally{globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.APPS_SCRIPT_URL;else process.env.APPS_SCRIPT_URL=oldURL;if(oldSecret===undefined)delete process.env.API_SHARED_SECRET;else process.env.API_SHARED_SECRET=oldSecret;}
});
