import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,randomUUID} from 'node:crypto';
function makeBackend(){
 const sheets=new Map(),props=new Map([['API_SHARED_SECRET','test-secret']]),cache=new Map();
 class Sheet {
  constructor(){this.cells=[];}getLastRow(){return this.cells.length;}
  getRange(row,col,n=1,m=1){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.cells[row-1+i]?.[col-1+j]??'')),setValues:values=>{values.forEach((r,i)=>{this.cells[row-1+i]??=[];r.forEach((v,j)=>this.cells[row-1+i][col-1+j]=v);});return this.getRange(row,col,n,m);},setFontWeight:()=>this.getRange(row,col,n,m),setBackground:()=>this.getRange(row,col,n,m)};}
  setFrozenRows(){} deleteRow(row){this.cells.splice(row-1,1);}
 }
 const book={getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet();sheets.set(n,s);return s;}};
 const ctx=vm.createContext({console,Date,JSON,Math,Number,String,Object,Array,Error,SpreadsheetApp:{openById:()=>book,flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(type,value)=>[...createHash('sha256').update(value).digest()],computeHmacSha256Signature:(value,key)=>[...createHmac('sha256',key).update(value).digest()]},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>({body:s})})}});
 vm.runInContext(readFileSync('apps-script/Code.gs','utf8'),ctx);
 ctx.setupSystem();
 const call=(action,payload={},token='')=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({secret:'test-secret',action,payload,token})}}).body);
 const login=name=>{const r=call('login',{username:name,password:'1234',client_ip:'127.0.0.1'});assert.equal(r.ok,true);return r.data.token;};
 return {ctx,call,login,sheets};
}
test('setup seeds exact original data and rerun preserves rows',()=>{const b=makeBackend();const t=b.login('admin');const data=b.call('bootstrap',{},t).data;assert.equal(data.funding.length,28);const total=y=>data.funding.filter(r=>r.academic_year===y).reduce((s,r)=>s+r.total_fund,0);assert.equal(total(2567),25341497.63);assert.equal(total(2568),51386071.33);b.ctx.setupSystem();assert.equal(b.call('bootstrap',{},t).data.funding.length,28);});
test('Teacher adds and updates funding, cannot delete/restore/manage system; Owner read only',()=>{
 const b=makeBackend(),t=b.login('teacher'),o=b.login('owner'),a=b.login('admin');
 const payload={academic_year:2569,faculty_id:'FAC001',teacher_count:78.5,internal_fund:100.25,external_fund:200,score:4.3,score_mode:'MANUAL',note:'new'};
 const added=b.call('saveFunding',payload,t);assert.equal(added.ok,true);assert.equal(added.data.total_fund,300.25);assert.equal(added.data.average_per_teacher,300.25/78.5);
 const edited=b.call('saveFunding',{...added.data,internal_fund:500.25},t);assert.equal(edited.ok,true);assert.equal(edited.data.total_fund,700.25);
 for(const action of ['deleteFunding','restoreFunding','adminData','saveFaculty','saveUser','saveSettings'])assert.equal(b.call(action,{record_id:edited.data.record_id,revision:edited.data.revision},t).error.code,'FORBIDDEN',action);
 assert.equal(b.call('bootstrap',{},o).ok,true);assert.equal(b.call('saveFunding',payload,o).error.code,'FORBIDDEN');
 const deleted=b.call('deleteFunding',{record_id:edited.data.record_id,revision:edited.data.revision},a);assert.equal(deleted.ok,true);
 assert.equal(b.call('bootstrap',{},t).data.funding.length,28);
 assert.equal(b.call('restoreFunding',{record_id:deleted.data.record_id,revision:deleted.data.revision},a).ok,true);
 assert.equal(b.call('bootstrap',{},t).data.funding.length,29);
});
test('duplicate, invalid values, stale edits, and automatic criteria checked at server',()=>{
 const b=makeBackend(),a=b.login('admin'),base={academic_year:2569,faculty_id:'FAC001',teacher_count:10,internal_fund:1000,external_fund:2000,score:2,score_mode:'MANUAL'};
 const added=b.call('saveFunding',base,a).data;
 assert.equal(b.call('saveFunding',base,a).error.code,'DUPLICATE');
 assert.equal(b.call('saveFunding',{...base,academic_year:2570,teacher_count:0},a).error.code,'VALIDATION');
 assert.equal(b.call('saveFunding',{...base,academic_year:2570,external_fund:-1},a).error.code,'VALIDATION');
 assert.equal(b.call('saveFunding',{...base,academic_year:2570,score:6},a).error.code,'VALIDATION');
 assert.equal(b.call('saveFunding',{...added,revision:0},a).error.code,'CONFLICT');
 assert.equal(b.call('saveFunding',{...base,academic_year:2570,score_mode:'AUTO'},a).error.code,'VALIDATION');
 assert.equal(b.call('saveSettings',{criterion:{academic_year:2569,faculty_id:'FAC001',target_per_teacher:600}},a).ok,true);
 const auto=b.call('saveFunding',{...added,score_mode:'AUTO'},a);assert.equal(auto.data.score,2.5);
 b.call('saveSettings',{criterion:{academic_year:2569,faculty_id:'FAC001',target_per_teacher:300}},a);
 assert.equal(b.call('bootstrap',{},a).data.funding.find(r=>r.record_id===added.record_id).score,5);
});
test('passwords hidden, session revoked on reset/disable and secret required',()=>{
 const b=makeBackend(),a=b.login('admin'),t=b.login('teacher');
 const data=b.call('adminData',{},a).data;assert.ok(data.users.every(u=>!('password_hash'in u)&&!('password_salt'in u)));
 const req=b.ctx.doPost({postData:{contents:JSON.stringify({secret:'wrong',action:'bootstrap',token:a})}});assert.equal(JSON.parse(req.body).error.code,'FORBIDDEN');
 assert.equal(b.call('saveUser',{username:'teacher',display_name:'Teacher',role:'TEACHER',active:false},a).ok,true);
 assert.equal(b.call('bootstrap',{},t).error.code,'UNAUTHORIZED');
 assert.equal(b.call('saveUser',{username:'admin',display_name:'Admin',role:'OWNER',active:true},a).error.code,'VALIDATION');
 assert.equal(b.call('changePassword',{current_password:'1234',password:'newpassword'},a).ok,true);
 assert.equal(b.call('bootstrap',{},a).error.code,'UNAUTHORIZED');
 assert.equal(b.call('login',{username:'admin',password:'newpassword'}).ok,true);
});
test('rate limiting, formula injection prevention, and expired sessions',()=>{
 const b=makeBackend();for(let i=0;i<8;i++)assert.equal(b.call('login',{username:'owner',password:'bad'}).error.code,'UNAUTHORIZED');assert.equal(b.call('login',{username:'owner',password:'bad'}).error.code,'RATE_LIMIT');
 const a=b.login('admin'),r=b.call('saveFunding',{academic_year:2569,faculty_id:'FAC001',teacher_count:5,internal_fund:5,external_fund:0,score:0,note:'=IMPORTXML("url")'},a);assert.equal(r.ok,true);assert.ok(b.sheets.get('FundingData').cells.at(-1)[10].startsWith("'="));
 b.sheets.get('Sessions').cells[1][2]='2000-01-01T00:00:00.000Z';assert.equal(b.call('bootstrap',{},a).error.code,'UNAUTHORIZED');
});
test('Admin creates a new faculty, adds and edits funding, and renamed faculty appears with recalculated values and audit history',()=>{
 const b=makeBackend(),a=b.login('admin');
 const faculty=b.call('saveFaculty',{faculty_name:'คณะใหม่สำหรับทดสอบ',active:true},a);assert.equal(faculty.ok,true);const id=faculty.data.faculty_id;
 assert.equal(b.call('saveFaculty',{faculty_name:'คณะใหม่สำหรับทดสอบ',active:true},a).error.code,'DUPLICATE');
 const added=b.call('saveFunding',{academic_year:2569,faculty_id:id,teacher_count:10.5,internal_fund:100.25,external_fund:350.5,score:4.25,score_mode:'MANUAL'},a);assert.equal(added.ok,true);
 const edited=b.call('saveFunding',{...added.data,teacher_count:12.5,internal_fund:200.25,external_fund:1000.5,score:4.75},a);assert.equal(edited.ok,true);assert.equal(edited.data.total_fund,1200.75);assert.equal(edited.data.average_per_teacher,1200.75/12.5);assert.equal(edited.data.score,4.75);assert.equal(edited.data.revision,2);
 assert.equal(b.call('saveFaculty',{faculty_id:id,faculty_name:'คณะใหม่ที่แก้ชื่อแล้ว',active:true},a).ok,true);
 const rows=b.call('bootstrap',{},a).data.funding;assert.equal(rows.length,29);const result=rows.find(r=>r.record_id===edited.data.record_id);assert.equal(result.faculty_name,'คณะใหม่ที่แก้ชื่อแล้ว');assert.equal(result.total_fund,1200.75);
 const audit=b.call('adminData',{},a).data.audit;assert.ok(audit.some(r=>r.action==='UPDATE_FUNDING'&&r.entity_id===edited.data.record_id));assert.ok(audit.some(r=>r.action==='SAVE_FACULTY'&&r.entity_id===id));
});
