import test from 'node:test';import assert from 'node:assert/strict';
import {handleRequest as onRequest} from '../server/gateway.js';
const env={APPS_SCRIPT_URL:'https://script.google.com/macros/s/test-deploy/exec',API_SHARED_SECRET:'private'};
const req=(body,headers={Origin:'https://fund.example.com'})=>new Request('https://fund.example.com/api/dispatch',{method:'POST',headers,body:JSON.stringify(body)});
test('proxy rejects cross-origin, missing configuration and invalid actions',async()=>{
 assert.equal((await onRequest({request:req({action:'login'},{Origin:'https://evil.example'}),env})).status,403);
 assert.equal((await onRequest({request:req({action:'login'}),env:{}})).status,503);
 assert.equal((await onRequest({request:req({action:'arbitrary'}),env})).status,400);
});
test('httpOnly cookie and token redaction; browser cannot supply shared secret/token/IP',async()=>{
 const original=globalThis.fetch;let forwarded;
 try{
 globalThis.fetch=async(url,init)=>{forwarded=JSON.parse(init.body);return new Response(JSON.stringify({ok:true,data:{token:'12345678-1234-1234-1234-123456789012'.repeat(2),user:{role:'TEACHER'}}}));};
 const response=await onRequest({request:req({action:'login',token:'forged',secret:'forged',payload:{username:'teacher',client_ip:'forged'}},{Origin:'https://fund.example.com','CF-Connecting-IP':'1.2.3.4'}),env});
 assert.equal(response.status,200);assert.ok(response.headers.get('Set-Cookie').includes('Secure; HttpOnly; SameSite=Strict'));assert.ok(!('token'in(await response.json()).data));assert.equal(forwarded.token,'');assert.equal(forwarded.secret,'private');assert.equal(forwarded.payload.client_ip,'unknown');
 }finally{globalThis.fetch=original;}
});
test('uncertain write has no automatic retry, sends cached cookie instead of client token',async()=>{
 const original=globalThis.fetch;let count=0;
 try{globalThis.fetch=async(url,init)=>{count++;assert.equal(JSON.parse(init.body).token,'cookie-value');throw new Error('timeout');};const response=await onRequest({request:req({action:'saveFunding',token:'forged'},{Origin:'https://fund.example.com',Cookie:'__Host-rfund_session=cookie-value'}),env});assert.equal(response.status,502);assert.equal(count,1);assert.equal((await response.json()).error.code,'NETWORK_UNCERTAIN');}finally{globalThis.fetch=original;}
});
