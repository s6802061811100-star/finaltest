import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import * as model from '../public/assets/model.js';import * as charts from '../public/assets/charts.js';import * as exports from '../public/assets/export.js';
function screen(role){
 const handlers={},app={innerHTML:'',addEventListener(){}},modal={innerHTML:'',open:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}},toast={},formError={textContent:''};
 class FormDataMock{constructor(form){this.values=form.values;}*[Symbol.iterator](){yield* Object.entries(this.values);}}
 const context=vm.createContext({...model,...charts,...exports,console,URLSearchParams,FormData:FormDataMock,setTimeout:(cb,ms)=>{const t=setTimeout(cb,ms);t.unref();return t;},clearTimeout,document:{querySelector:s=>({'#app':app,'#modal':modal,'#toast':toast,'#modal-error':formError}[s]),addEventListener(type,fn){handlers[type]=fn;}}});
 let script=readFileSync('public/assets/app.js','utf8').replace(/^import .*;\n/gm,'');script=script.replace(/start\(\);\s*$/,'globalThis.screenTest={state,render,load,fundingDialog,facultyDialog,pageCsvRows};');vm.runInContext(script,context);
 const api=context.screenTest;api.state.user={role,display_name:role};api.state.data={...JSON.parse(readFileSync('public/assets/demo-data.json')),settings:[],criteria:[],synced_at:new Date().toISOString()};api.state.year='2568';api.state.compareA='2567';api.state.compareB='2568';api.state.admin={users:[],audit:[],deleted:[]};return {...api,app,modal,context,handlers,formError};
}
test('Teacher funding screen offers add and edit, omits delete and admin menus',()=>{const s=screen('TEACHER');s.state.page='funding';s.render();assert.ok(s.app.innerHTML.includes('data-action="add-funding"'));assert.ok(s.app.innerHTML.includes('data-action="edit-funding"'));assert.ok(!s.app.innerHTML.includes('data-action="delete-funding"'));assert.ok(!s.app.innerHTML.includes('data-page="users"'));});
test('Owner read only, admin includes delete and system pages',()=>{const owner=screen('OWNER');owner.state.page='funding';owner.render();assert.ok(!owner.app.innerHTML.includes('data-action="add-funding"'));assert.ok(!owner.app.innerHTML.includes('data-action="edit-funding"'));const admin=screen('ADMIN');admin.state.page='funding';admin.render();assert.ok(admin.app.innerHTML.includes('data-action="delete-funding"'));assert.ok(admin.app.innerHTML.includes('data-page="users"'));});
test('every page renders against real seed; inaccessible page redirects to overview',()=>{const s=screen('ADMIN');for(const page of ['dashboard','funding','compare','faculty','reports','manage','faculties','users','settings','audit']){s.state.page=page;s.render();assert.ok(s.app.innerHTML.includes('R-FUND'));assert.ok(!s.app.innerHTML.includes('undefined'));assert.ok(!s.app.innerHTML.includes('NaN'));}const teacher=screen('TEACHER');teacher.state.page='users';teacher.render();assert.equal(teacher.state.page,'dashboard');});
test('all-years filter survives reload instead of silently reverting to latest',async()=>{const s=screen('TEACHER');s.state.year='';s.context.fetch=async()=>({json:async()=>({ok:true,data:s.state.data})});await s.load();assert.equal(s.state.year,'');});

test('every data page offers page-specific CSV and print/PDF controls',()=>{const s=screen('ADMIN');for(const page of ['dashboard','funding','compare','faculty','reports','manage','faculties','users','settings','audit']){s.state.page=page;s.render();assert.ok(s.app.innerHTML.includes('data-action="page-csv"'));assert.ok(s.app.innerHTML.includes('data-action="print"'));assert.ok(s.app.innerHTML.includes('class="print-context"'));assert.ok(Array.isArray(s.pageCsvRows()));}});
test('CSV respects faculty/year scope and exports only safe user fields',()=>{const s=screen('ADMIN');s.state.page='dashboard';assert.equal(s.pageCsvRows().length,15);s.state.faculty='FAC001';assert.equal(s.pageCsvRows().length,2);s.state.page='faculty';assert.equal(s.pageCsvRows().length,3);s.state.page='compare';assert.equal(s.pageCsvRows().length,2);s.state.page='users';s.state.admin.users=[{username:'admin',display_name:'Admin',role:'ADMIN',active:true,password_hash:'secret',password_salt:'private'}];assert.equal(s.pageCsvRows().length,2);assert.ok(!JSON.stringify(s.pageCsvRows()).includes('secret'));assert.ok(!JSON.stringify(s.pageCsvRows()).includes('private'));});
test('Admin has a visible management page, grouped funding headings and edit controls at start of each row',()=>{
 const s=screen('ADMIN');s.render();assert.ok(s.app.innerHTML.includes('data-page="manage"'));assert.ok(s.app.innerHTML.includes('แก้ไขข้อมูลเงินทุน'));
 s.state.page='manage';s.render();assert.ok(s.app.innerHTML.includes('data-action="new-faculty-funding"'));
 assert.match(s.app.innerHTML,/<th colspan="3" scope="colgroup" class="funding-group">เงินสนับสนุน \(บาท\)/);
 assert.match(s.app.innerHTML,/<tbody><tr><td class="manage-cell">/);assert.equal(s.pageCsvRows().length,15);
 for(const role of ['TEACHER','OWNER']){const other=screen(role);other.render();assert.ok(!other.app.innerHTML.includes('data-page="manage"'));other.state.page='manage';other.render();assert.equal(other.state.page,'dashboard');}
});
test('new faculty saves first, opens funding with the returned faculty selected, then saves and reveals its new year',async()=>{
 const s=screen('ADMIN'),calls=[],faculty={faculty_id:'FAC-NEW',faculty_name:'คณะใหม่',active:true};s.state.page='manage';s.state.search='คำค้นเก่า';
 s.context.fetch=async(url,options)=>{const req=JSON.parse(options.body);calls.push(req);let data;
  if(req.action==='saveFaculty'){s.state.data.faculties.push(faculty);data=faculty;}
  else if(req.action==='saveFunding'){data={...req.payload,record_id:'RF-NEW',revision:1,faculty_name:faculty.faculty_name,total_fund:450.75,average_per_teacher:450.75/10.5};s.state.data.funding.push(data);}
  else if(req.action==='bootstrap')data={...s.state.data,user:{username:'admin',display_name:'Admin',role:'ADMIN'}};
  return {json:async()=>({ok:true,data})};
 };
 const submit=async(id,values)=>{const button={dataset:{},isConnected:false};await s.handlers.submit({target:{id,values,querySelector:()=>button},preventDefault(){}});};
 s.facultyDialog(undefined,true);assert.match(s.modal.innerHTML,/ขั้นตอน 1 จาก 2/);
 await submit('faculty-form',{faculty_id:'',faculty_name:'คณะใหม่',active:'true',after_save:'funding'});
 assert.equal(calls[0].action,'saveFaculty');assert.ok(!('after_save' in calls[0].payload));assert.equal(s.state.faculty,'FAC-NEW');assert.equal(s.state.search,'');
 assert.match(s.modal.innerHTML,/<option value="FAC-NEW" selected>คณะใหม่/);assert.match(s.modal.innerHTML,/ขั้นตอน 2 จาก 2/);assert.ok(s.modal.open);
 await submit('funding-form',{record_id:'',revision:'',academic_year:'2569',faculty_id:'FAC-NEW',teacher_count:'10.5',internal_fund:'100.25',external_fund:'350.5',score:'4.25',score_mode:'MANUAL',note:''});
 const save=calls.find(x=>x.action==='saveFunding');assert.equal(save.payload.teacher_count,10.5);assert.equal(save.payload.internal_fund,100.25);
 assert.equal(s.state.year,'2569');assert.equal(s.state.faculty,'FAC-NEW');assert.equal(s.modal.open,false);assert.equal(s.pageCsvRows().length,2);assert.equal(s.pageCsvRows()[1][5],450.75);
});
test('failed faculty save keeps the form and never opens the funding step',async()=>{
 const s=screen('ADMIN');s.state.page='manage';s.facultyDialog(undefined,true);const before=s.modal.innerHTML;
 s.context.fetch=async()=>({json:async()=>({ok:false,error:{code:'DUPLICATE',message:'ชื่อคณะซ้ำ'}})});
 await s.handlers.submit({target:{id:'faculty-form',values:{faculty_id:'',faculty_name:'ซ้ำ',active:'true',after_save:'funding'},querySelector:()=>({dataset:{},isConnected:false})},preventDefault(){}});
 assert.equal(s.modal.innerHTML,before);assert.ok(s.modal.open);assert.equal(s.formError.textContent,'ชื่อคณะซ้ำ');
});
