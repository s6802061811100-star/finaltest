/** R-FUND Insight 1.0.1 — Google Sheets is the only database. */
const SPREADSHEET_ID = '1WhvjrX5mX6DHbqLVrxbt76VLYjuNJR4S_Edb9Rjf2vs';
const SCHEMA = {
  FundingData: ['record_id','academic_year','faculty_id','teacher_count','internal_fund','external_fund','total_fund','average_per_teacher','score','score_mode','note','status','revision','created_by','created_at','updated_by','updated_at'],
  Faculties: ['faculty_id','faculty_name','active'],
  Users: ['username','display_name','role','password_salt','password_hash','active','updated_at'],
  Sessions: ['token_hash','username','expires_at','created_at'],
  Settings: ['key','value'],
  ScoreCriteria: ['academic_year','faculty_id','target_per_teacher'],
  AuditLog: ['event_id','timestamp','username','action','entity_id','before_json','after_json']
};
function book_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function sheet_(name) {
  const s = book_().getSheetByName(name);
  if (!s) fail_('SETUP_REQUIRED', 'กรุณารัน setupSystem ใน Apps Script ก่อน');
  const headers = s.getRange(1,1,1,SCHEMA[name].length).getValues()[0];
  if (JSON.stringify(headers) !== JSON.stringify(SCHEMA[name])) fail_('SCHEMA_ERROR','หัวตาราง '+name+' ไม่ตรงกับโครงสร้าง กรุณาตรวจสอบก่อนใช้งาน');
  return s;
}
function rows_(name) {
  const s = sheet_(name);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2,1,s.getLastRow()-1,SCHEMA[name].length).getValues().map((r,i) => {
    const o = {_row:i+2}; SCHEMA[name].forEach((k,j) => o[k] = r[j] instanceof Date ? r[j].toISOString() : r[j]); return o;
  });
}
function cell_(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'"+v : (v === undefined || v === null ? '' : v); }
function write_(name,obj,row) {
  const s = sheet_(name), vals = SCHEMA[name].map(k => cell_(obj[k]));
  s.getRange(row || s.getLastRow()+1,1,1,vals.length).setValues([vals]);
}
function clean_(o) { const r = Object.assign({},o); delete r._row; return r; }
function truth_(v) { return v === true || String(v).toLowerCase() === 'true'; }
function fail_(code,message) { const e = new Error(message); e.code=code; throw e; }
function text_(v,max) { return String(v == null ? '' : v).trim().slice(0,max || 500); }
function number_(v,label,min,max) {
  if (v === '' || v === null || v === undefined || typeof v === 'boolean') fail_('VALIDATION',label+' ต้องเป็นตัวเลข');
  const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) fail_('VALIDATION',label+' ไม่อยู่ในช่วงที่กำหนด'); return n;
}
function now_() { return new Date().toISOString(); }
function sha_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8).map(b => ('0'+(b & 255).toString(16)).slice(-2)).join(''); }
function secret_() { const s=PropertiesService.getScriptProperties().getProperty('API_SHARED_SECRET'); if (!s) fail_('SETUP_REQUIRED','ยังไม่ได้ตั้งค่า API_SHARED_SECRET'); return s; }
function password_(password,salt) {
  // HMAC with a private server pepper; neither password nor pepper is sent to the frontend.
  const pepper=PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  if (!pepper) fail_('SETUP_REQUIRED','ยังไม่ได้รัน setupSystem');
  return Utilities.computeHmacSha256Signature(salt+':'+password,pepper).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function same_(a,b) { a=String(a); b=String(b); let diff=a.length ^ b.length; for (let i=0;i<Math.max(a.length,b.length);i++) diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return diff===0; }
function safeUser_(u) { return {username:u.username,display_name:u.display_name,role:u.role,active:truth_(u.active)}; }
function audit_(user,action,id,before,after) {
  write_('AuditLog',{event_id:Utilities.getUuid(),timestamp:now_(),username:user,action:action,entity_id:id,before_json:JSON.stringify(before || {}),after_json:JSON.stringify(after || {})});
}
/** Run once from the editor. Safe to run again: no existing row or legacy sheet is removed. */
function setupSystem() {
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const props=PropertiesService.getScriptProperties(); secret_();
    if (!props.getProperty('PASSWORD_PEPPER')) props.setProperty('PASSWORD_PEPPER',Utilities.getUuid()+Utilities.getUuid());
    const b=book_();
    Object.keys(SCHEMA).forEach(name => {
      let s=b.getSheetByName(name);
      if (!s) { s=b.insertSheet(name); s.getRange(1,1,1,SCHEMA[name].length).setValues([SCHEMA[name]]); }
      sheet_(name); s.setFrozenRows(1); s.getRange(1,1,1,SCHEMA[name].length).setFontWeight('bold').setBackground('#e3eafe');
    });
    ['admin','teacher','owner'].forEach((username,i)=> {
      if (rows_('Users').some(u=>u.username===username)) return;
      const salt=Utilities.getUuid();
      write_('Users',{username:username,display_name:['ผู้ดูแลระบบ','อาจารย์','ผู้บริหาร'][i],role:['ADMIN','TEACHER','OWNER'][i],password_salt:salt,password_hash:password_('1234',salt),active:true,updated_at:now_()});
    });
    const existingFac=rows_('Faculties');
    INITIAL_DATA.faculties.forEach(f=> { if (!existingFac.some(x=>x.faculty_id===f.faculty_id)) write_('Faculties',f); });
    // Seed only an entirely empty FundingData; avoid overwriting live data or silently reimporting deleted rows.
    if (sheet_('FundingData').getLastRow()===1) {
      INITIAL_DATA.funding.forEach(r=>write_('FundingData',Object.assign({},r,{created_by:'setup',updated_by:'setup',created_at:now_(),updated_at:now_()})));
      audit_('setup','IMPORT_INITIAL','28_RECORDS',null,{source:'Data เงินทุน2567-2568.xlsx',records:28});
    }
    if (!rows_('Settings').some(x=>x.key==='system_name')) write_('Settings',{key:'system_name',value:'R-FUND Insight'});
    // Empty ScoreCriteria is deliberate: original official thresholds have not been supplied.
    SpreadsheetApp.flush(); return 'พร้อมใช้งาน: บัญชี admin / teacher / owner รหัสเริ่มต้น 1234';
  } finally { lock.releaseLock(); }
}
function doGet() { return output_({ok:true,data:{service:'R-FUND Insight',version:'1.0.1'}}); }
function output_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function doPost(e) {
  let lock;
  try {
    if (!e || !e.postData || e.postData.contents.length>100000) fail_('VALIDATION','คำขอไม่ถูกต้องหรือมีขนาดเกินกำหนด');
    const req=JSON.parse(e.postData.contents);
    if (!same_(req.secret || '',secret_())) fail_('FORBIDDEN','ไม่ได้รับอนุญาตให้เรียก API');
    lock=LockService.getScriptLock(); lock.waitLock(30000);
    return output_({ok:true,data:dispatch_(req)});
  } catch (error) {
    const code=error.code || 'SERVER_ERROR';
    if (!error.code) console.error(error.stack);
    return output_({ok:false,error:{code:code,message:error.code?error.message:'ระบบทำงานไม่สำเร็จ กรุณาตรวจบันทึก Apps Script'}});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
function authenticate_(token) {
  if (!token) fail_('UNAUTHORIZED','กรุณาเข้าสู่ระบบ');
  const hash=sha_(token), session=rows_('Sessions').find(s=>s.token_hash===hash);
  if (!session || new Date(session.expires_at).getTime()<=Date.now()) fail_('UNAUTHORIZED','เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const u=rows_('Users').find(x=>x.username===session.username && truth_(x.active));
  if (!u || !['ADMIN','TEACHER','OWNER'].includes(u.role)) fail_('UNAUTHORIZED','บัญชีถูกปิดใช้งานหรือบทบาทไม่ถูกต้อง'); return u;
}
function admin_(u) { if (u.role!=='ADMIN') fail_('FORBIDDEN','เฉพาะผู้ดูแลระบบเท่านั้น'); }
function revoke_(username) {
  rows_('Sessions').filter(s=>s.username===username || new Date(s.expires_at).getTime()<=Date.now()).sort((a,b)=>b._row-a._row).forEach(s=>sheet_('Sessions').deleteRow(s._row));
}
function login_(p) {
  const username=text_(p.username,60).toLowerCase(), cache=CacheService.getScriptCache(), key='login:'+sha_(username+':'+text_(p.client_ip,80));
  const attempts=Number(cache.get(key)||0);
  if (attempts>=8) fail_('RATE_LIMIT','ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที');
  const u=rows_('Users').find(x=>x.username===username);
  const hash=password_(String(p.password || ''),u?u.password_salt:'invalid');
  if (!u || !truth_(u.active) || !same_(u.password_hash,hash)) { cache.put(key,String(attempts+1),900); fail_('UNAUTHORIZED','ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); }
  cache.remove(key); revoke_(username);
  const token=Utilities.getUuid()+Utilities.getUuid(), expires=new Date(Date.now()+8*60*60*1000).toISOString();
  write_('Sessions',{token_hash:sha_(token),username:username,expires_at:expires,created_at:now_()});
  audit_(username,'LOGIN',username,null,null); return {user:safeUser_(u),token:token,expires_at:expires};
}
function fundingList_(includeDeleted) {
  const names={}; rows_('Faculties').forEach(f=>names[f.faculty_id]=f.faculty_name);
  return rows_('FundingData').filter(r=>includeDeleted || r.status==='ACTIVE').map(r=>Object.assign(clean_(r),{faculty_name:names[r.faculty_id] || r.faculty_id}));
}
function dispatch_(req) {
  const p=req.payload || {}, action=req.action;
  if (action==='login') return login_(p);
  const u=authenticate_(req.token);
  if (action==='logout') { revoke_(u.username); return {logged_out:true}; }
  if (action==='bootstrap') return {user:safeUser_(u),funding:fundingList_(false),faculties:rows_('Faculties').map(clean_),criteria:rows_('ScoreCriteria').map(clean_),settings:rows_('Settings').map(clean_),synced_at:now_()};
  if (action==='changePassword') {
    if (!same_(password_(String(p.current_password || ''),u.password_salt),u.password_hash)) fail_('VALIDATION','รหัสผ่านปัจจุบันไม่ถูกต้อง');
    if (String(p.password || '').length<8 || String(p.password).length>128) fail_('VALIDATION','รหัสผ่านใหม่ต้องมี 8–128 ตัวอักษร');
    const salt=Utilities.getUuid(); write_('Users',Object.assign({},u,{password_salt:salt,password_hash:password_(p.password,salt),updated_at:now_()}),u._row);
    revoke_(u.username); audit_(u.username,'CHANGE_PASSWORD',u.username,null,null); return {changed:true};
  }
  if (action==='saveFunding' && ['ADMIN','TEACHER'].includes(u.role)) return saveFunding_(u,p);
  admin_(u);
  switch(action) {
    case 'saveFunding': return saveFunding_(u,p);
    case 'deleteFunding': return statusFunding_(u,p,'DELETED');
    case 'restoreFunding': return statusFunding_(u,p,'ACTIVE');
    case 'adminData': return {users:rows_('Users').map(safeUser_),audit:rows_('AuditLog').slice(-500).reverse().map(clean_),deleted:fundingList_(true).filter(r=>r.status==='DELETED')};
    case 'saveFaculty': return saveFaculty_(u,p);
    case 'saveUser': return saveUser_(u,p);
    case 'saveSettings': return saveSettings_(u,p);
    default: fail_('VALIDATION','ไม่พบคำสั่ง API');
  }
}
function saveFunding_(u,p) {
  const year=number_(p.academic_year,'ปีการศึกษา',2500,2700); if (!Number.isInteger(year)) fail_('VALIDATION','ปีต้องเป็นจำนวนเต็ม');
  const fac=rows_('Faculties').find(f=>f.faculty_id===p.faculty_id && truth_(f.active)); if (!fac) fail_('VALIDATION','กรุณาเลือกคณะที่เปิดใช้งาน');
  const all=rows_('FundingData'), old=p.record_id?all.find(x=>x.record_id===p.record_id):null;
  if (p.record_id && (!old || old.status!=='ACTIVE')) fail_('NOT_FOUND','ไม่พบรายการ');
  if (old && Number(p.revision)!==Number(old.revision)) fail_('CONFLICT','ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่');
  if (all.some(r=>r.status==='ACTIVE' && Number(r.academic_year)===year && r.faculty_id===fac.faculty_id && (!old || r.record_id!==old.record_id))) fail_('DUPLICATE','คณะนี้มีข้อมูลในปีที่เลือกแล้ว');
  const count=number_(p.teacher_count,'จำนวนอาจารย์/FTE',0.01,100000), internal=Math.round(number_(p.internal_fund,'ทุนภายใน',0,1e13)*100)/100, external=Math.round(number_(p.external_fund,'ทุนภายนอก',0,1e13)*100)/100;
  const total=Math.round((internal+external)*100)/100, avg=total/count, mode=p.score_mode==='AUTO'?'AUTO':'MANUAL'; let score;
  if (mode==='AUTO') {
    const criterion=rows_('ScoreCriteria').find(c=>Number(c.academic_year)===year && c.faculty_id===fac.faculty_id);
    if (!criterion || Number(criterion.target_per_teacher)<=0) fail_('VALIDATION','ยังไม่มีเกณฑ์คะแนนของคณะนี้ในปีที่เลือก');
    score=Math.min(5,avg/Number(criterion.target_per_teacher)*5);
  } else score=number_(p.score,'คะแนน',0,5);
  const r={record_id:old?old.record_id:'RF-'+Utilities.getUuid(),academic_year:year,faculty_id:fac.faculty_id,teacher_count:count,internal_fund:internal,external_fund:external,total_fund:total,average_per_teacher:avg,score:score,score_mode:mode,note:text_(p.note,2000),status:'ACTIVE',revision:old?Number(old.revision)+1:1,created_by:old?old.created_by:u.username,created_at:old?old.created_at:now_(),updated_by:u.username,updated_at:now_()};
  write_('FundingData',r,old?old._row:null); audit_(u.username,old?'UPDATE_FUNDING':'ADD_FUNDING',r.record_id,old?clean_(old):null,r); return r;
}
function statusFunding_(u,p,status) {
  const old=rows_('FundingData').find(r=>r.record_id===p.record_id); if (!old) fail_('NOT_FOUND','ไม่พบรายการ');
  if (Number(old.revision)!==Number(p.revision)) fail_('CONFLICT','ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่');
  if (status==='ACTIVE' && rows_('FundingData').some(r=>r.status==='ACTIVE' && r.faculty_id===old.faculty_id && Number(r.academic_year)===Number(old.academic_year) && r.record_id!==old.record_id)) fail_('DUPLICATE','มีข้อมูลคณะและปีนี้แล้ว กู้คืนไม่ได้');
  const next=Object.assign({},clean_(old),{status:status,revision:Number(old.revision)+1,updated_at:now_(),updated_by:u.username}); write_('FundingData',next,old._row); audit_(u.username,status==='DELETED'?'DELETE_FUNDING':'RESTORE_FUNDING',p.record_id,clean_(old),next); return next;
}
function saveFaculty_(u,p) {
  const name=text_(p.faculty_name,200); if (!name) fail_('VALIDATION','กรุณากรอกชื่อคณะ');
  const all=rows_('Faculties'), old=p.faculty_id?all.find(f=>f.faculty_id===p.faculty_id):null;
  if (p.faculty_id && !old) fail_('NOT_FOUND','ไม่พบคณะ');
  if (all.some(f=>f.faculty_name===name && (!old || old.faculty_id!==f.faculty_id))) fail_('DUPLICATE','ชื่อคณะซ้ำ');
  const r={faculty_id:old?old.faculty_id:'FAC-'+Utilities.getUuid(),faculty_name:name,active:p.active!==false}; write_('Faculties',r,old?old._row:null); audit_(u.username,'SAVE_FACULTY',r.faculty_id,old?clean_(old):null,r); return r;
}
function saveUser_(u,p) {
  const username=text_(p.username,60).toLowerCase(); if (!/^[a-z0-9._-]{3,60}$/.test(username)) fail_('VALIDATION','ชื่อผู้ใช้ต้องเป็น a-z 0-9 . _ - จำนวน 3–60 ตัว');
  if (!['ADMIN','TEACHER','OWNER'].includes(p.role)) fail_('VALIDATION','บทบาทไม่ถูกต้อง');
  const all=rows_('Users'), old=all.find(x=>x.username===username), active=p.active!==false;
  if (username===u.username && (!active || p.role!=='ADMIN')) fail_('VALIDATION','ไม่สามารถปิดหรือลดสิทธิ์บัญชีตัวเอง');
  if (old && old.role==='ADMIN' && truth_(old.active) && (!active || p.role!=='ADMIN') && all.filter(x=>x.role==='ADMIN' && truth_(x.active)).length<=1) fail_('VALIDATION','ต้องมี Admin ที่เปิดใช้งานอย่างน้อยหนึ่งคน');
  if ((!old || p.password) && (String(p.password || '').length<8 || String(p.password).length>128)) fail_('VALIDATION','รหัสผ่านใหม่ต้องมี 8–128 ตัวอักษร');
  const display=text_(p.display_name,200); if (!display) fail_('VALIDATION','กรุณากรอกชื่อแสดง');
  const salt=(!old || p.password)?Utilities.getUuid():old.password_salt;
  const r={username:username,display_name:display,role:p.role,active:active,password_salt:salt,password_hash:(!old || p.password)?password_(p.password,salt):old.password_hash,updated_at:now_()};
  write_('Users',r,old?old._row:null); if (old && (p.password || !active || old.role!==p.role)) revoke_(username);
  audit_(u.username,'SAVE_USER',username,old?safeUser_(old):null,safeUser_(r)); return safeUser_(r);
}
function saveSettings_(u,p) {
  if (p.system_name!==undefined) {
    const name=text_(p.system_name,100); if (!name) fail_('VALIDATION','กรุณากรอกชื่อระบบ');
    const old=rows_('Settings').find(x=>x.key==='system_name'); write_('Settings',{key:'system_name',value:name},old?old._row:null); audit_(u.username,'SETTINGS','system_name',old?clean_(old):null,{value:name});
  }
  if (p.criterion) {
    const c=p.criterion, year=number_(c.academic_year,'ปีการศึกษา',2500,2700); if (!Number.isInteger(year)) fail_('VALIDATION','ปีต้องเป็นจำนวนเต็ม');
    if (!rows_('Faculties').some(f=>f.faculty_id===c.faculty_id)) fail_('VALIDATION','ไม่พบคณะ');
    const target=number_(c.target_per_teacher,'เป้าหมายบาทต่อ FTE',0.01,1e13), old=rows_('ScoreCriteria').find(r=>Number(r.academic_year)===year && r.faculty_id===c.faculty_id);
    const next={academic_year:year,faculty_id:c.faculty_id,target_per_teacher:target}; write_('ScoreCriteria',next,old?old._row:null);
    rows_('FundingData').filter(r=>r.status==='ACTIVE' && Number(r.academic_year)===year && r.faculty_id===c.faculty_id && r.score_mode==='AUTO').forEach(r=>{
      const updated=Object.assign({},r,{score:Math.min(5,Number(r.average_per_teacher)/target*5),revision:Number(r.revision)+1,updated_by:u.username,updated_at:now_()});
      write_('FundingData',updated,r._row); audit_(u.username,'RECALCULATE_SCORE',r.record_id,clean_(r),clean_(updated));
    }); audit_(u.username,'SAVE_CRITERION',year+':'+c.faculty_id,old?clean_(old):null,next);
  } return {saved:true};
}


// ข้อมูลตรวจเทียบกับไฟล์ Excel ที่แนบมา 28 รายการ
const INITIAL_DATA = {
  "faculties": [
    {
      "faculty_id": "FAC001",
      "faculty_name": "บริหารธุรกิจ",
      "active": true
    },
    {
      "faculty_id": "FAC002",
      "faculty_name": "วิศวกรรมศาสตร์และเทคโนโลยี",
      "active": true
    },
    {
      "faculty_id": "FAC003",
      "faculty_name": "ศิลปศาสตร์",
      "active": true
    },
    {
      "faculty_id": "FAC004",
      "faculty_name": "นิเทศศาสตร์",
      "active": true
    },
    {
      "faculty_id": "FAC005",
      "faculty_name": "วิทยาการจัดการ",
      "active": true
    },
    {
      "faculty_id": "FAC006",
      "faculty_name": "เกษตรนวัตและการจัดการ",
      "active": true
    },
    {
      "faculty_id": "FAC007",
      "faculty_name": "การจัดการการศึกษาเชิงสร้างสรรค์",
      "active": true
    },
    {
      "faculty_id": "FAC008",
      "faculty_name": "การจัดการธุรกิจอาหาร",
      "active": true
    },
    {
      "faculty_id": "FAC009",
      "faculty_name": "อุตสาหกรรมเกษตร",
      "active": true
    },
    {
      "faculty_id": "FAC010",
      "faculty_name": "การจัดการโลจิสติกส์และการคมนาคมขนส่ง",
      "active": true
    },
    {
      "faculty_id": "FAC011",
      "faculty_name": "วิทยาลัยนานาชาติ",
      "active": true
    },
    {
      "faculty_id": "FAC012",
      "faculty_name": "วิทยาลัยบัณฑิตศึกษาจีน",
      "active": true
    },
    {
      "faculty_id": "FAC013",
      "faculty_name": "สำนักการศึกษาทั่วไป",
      "active": true
    },
    {
      "faculty_id": "FAC014",
      "faculty_name": "คณะพยาบาลศาสตร์",
      "active": true
    }
  ],
  "funding": [
    {
      "record_id": "RF-2567-001",
      "academic_year": 2567,
      "faculty_id": "FAC001",
      "faculty_name": "บริหารธุรกิจ",
      "teacher_count": 78.5,
      "internal_fund": 197800,
      "external_fund": 1815000,
      "total_fund": 2012800,
      "average_per_teacher": 25640.76433121019,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-002",
      "academic_year": 2567,
      "faculty_id": "FAC002",
      "faculty_name": "วิศวกรรมศาสตร์และเทคโนโลยี",
      "teacher_count": 46,
      "internal_fund": 141800,
      "external_fund": 2893126,
      "total_fund": 3034926,
      "average_per_teacher": 65976.65217391304,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-003",
      "academic_year": 2567,
      "faculty_id": "FAC003",
      "faculty_name": "ศิลปศาสตร์",
      "teacher_count": 28,
      "internal_fund": 57378.75,
      "external_fund": 646600,
      "total_fund": 703978.75,
      "average_per_teacher": 25142.098214285714,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-004",
      "academic_year": 2567,
      "faculty_id": "FAC004",
      "faculty_name": "นิเทศศาสตร์",
      "teacher_count": 10,
      "internal_fund": 0,
      "external_fund": 1946383.5,
      "total_fund": 1946383.5,
      "average_per_teacher": 194638.35,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-005",
      "academic_year": 2567,
      "faculty_id": "FAC005",
      "faculty_name": "วิทยาการจัดการ",
      "teacher_count": 36.5,
      "internal_fund": 0,
      "external_fund": 4585655,
      "total_fund": 4585655,
      "average_per_teacher": 125634.38356164383,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-006",
      "academic_year": 2567,
      "faculty_id": "FAC006",
      "faculty_name": "เกษตรนวัตและการจัดการ",
      "teacher_count": 7,
      "internal_fund": 227900,
      "external_fund": 455000,
      "total_fund": 682900,
      "average_per_teacher": 97557.14285714286,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-007",
      "academic_year": 2567,
      "faculty_id": "FAC007",
      "faculty_name": "การจัดการการศึกษาเชิงสร้างสรรค์",
      "teacher_count": 29,
      "internal_fund": 552871.25,
      "external_fund": 225000,
      "total_fund": 777871.25,
      "average_per_teacher": 26823.146551724138,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-008",
      "academic_year": 2567,
      "faculty_id": "FAC008",
      "faculty_name": "การจัดการธุรกิจอาหาร",
      "teacher_count": 33,
      "internal_fund": 351200,
      "external_fund": 2113805.33,
      "total_fund": 2465005.33,
      "average_per_teacher": 74697.13121212121,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-009",
      "academic_year": 2567,
      "faculty_id": "FAC009",
      "faculty_name": "อุตสาหกรรมเกษตร",
      "teacher_count": 10,
      "internal_fund": 697092,
      "external_fund": 427500,
      "total_fund": 1124592,
      "average_per_teacher": 112459.2,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-010",
      "academic_year": 2567,
      "faculty_id": "FAC010",
      "faculty_name": "การจัดการโลจิสติกส์และการคมนาคมขนส่ง",
      "teacher_count": 16.5,
      "internal_fund": 391200,
      "external_fund": 25000,
      "total_fund": 416200,
      "average_per_teacher": 25224.242424242424,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-011",
      "academic_year": 2567,
      "faculty_id": "FAC011",
      "faculty_name": "วิทยาลัยนานาชาติ",
      "teacher_count": 15.5,
      "internal_fund": 0,
      "external_fund": 799920,
      "total_fund": 799920,
      "average_per_teacher": 51607.74193548387,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-012",
      "academic_year": 2567,
      "faculty_id": "FAC012",
      "faculty_name": "วิทยาลัยบัณฑิตศึกษาจีน",
      "teacher_count": 67,
      "internal_fund": 251800,
      "external_fund": 2052500,
      "total_fund": 2304300,
      "average_per_teacher": 34392.53731343283,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-013",
      "academic_year": 2567,
      "faculty_id": "FAC013",
      "faculty_name": "สำนักการศึกษาทั่วไป",
      "teacher_count": 59,
      "internal_fund": 66000,
      "external_fund": 1571235,
      "total_fund": 1637235,
      "average_per_teacher": 27749.745762711864,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2567-014",
      "academic_year": 2567,
      "faculty_id": "FAC014",
      "faculty_name": "คณะพยาบาลศาสตร์",
      "teacher_count": 20,
      "internal_fund": 0,
      "external_fund": 2849730.8,
      "total_fund": 2849730.8,
      "average_per_teacher": 142486.53999999998,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2567",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-001",
      "academic_year": 2568,
      "faculty_id": "FAC001",
      "faculty_name": "บริหารธุรกิจ",
      "teacher_count": 72,
      "internal_fund": 185975,
      "external_fund": 16785483,
      "total_fund": 16971458,
      "average_per_teacher": 235714.69444444444,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-002",
      "academic_year": 2568,
      "faculty_id": "FAC002",
      "faculty_name": "วิศวกรรมศาสตร์และเทคโนโลยี",
      "teacher_count": 45,
      "internal_fund": 120548,
      "external_fund": 2548756,
      "total_fund": 2669304,
      "average_per_teacher": 59317.86666666667,
      "score": 4.943155555555556,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-003",
      "academic_year": 2568,
      "faculty_id": "FAC003",
      "faculty_name": "ศิลปศาสตร์",
      "teacher_count": 27,
      "internal_fund": 98457,
      "external_fund": 548761,
      "total_fund": 647218,
      "average_per_teacher": 23971.037037037036,
      "score": 4.7942074074074075,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-004",
      "academic_year": 2568,
      "faculty_id": "FAC004",
      "faculty_name": "นิเทศศาสตร์",
      "teacher_count": 11,
      "internal_fund": 54876,
      "external_fund": 325487,
      "total_fund": 380363,
      "average_per_teacher": 34578.454545454544,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-005",
      "academic_year": 2568,
      "faculty_id": "FAC005",
      "faculty_name": "วิทยาการจัดการ",
      "teacher_count": 37,
      "internal_fund": 87548,
      "external_fund": 6584752,
      "total_fund": 6672300,
      "average_per_teacher": 180332.43243243243,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-006",
      "academic_year": 2568,
      "faculty_id": "FAC006",
      "faculty_name": "เกษตรนวัตและการจัดการ",
      "teacher_count": 6,
      "internal_fund": 65847,
      "external_fund": 325478,
      "total_fund": 391325,
      "average_per_teacher": 65220.833333333336,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-007",
      "academic_year": 2568,
      "faculty_id": "FAC007",
      "faculty_name": "การจัดการการศึกษาเชิงสร้างสรรค์",
      "teacher_count": 25,
      "internal_fund": 236320,
      "external_fund": 658478,
      "total_fund": 894798,
      "average_per_teacher": 35791.92,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-008",
      "academic_year": 2568,
      "faculty_id": "FAC008",
      "faculty_name": "การจัดการธุรกิจอาหาร",
      "teacher_count": 36,
      "internal_fund": 351200,
      "external_fund": 2113805.33,
      "total_fund": 2465005.33,
      "average_per_teacher": 68472.37027777778,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-009",
      "academic_year": 2568,
      "faculty_id": "FAC009",
      "faculty_name": "อุตสาหกรรมเกษตร",
      "teacher_count": 9,
      "internal_fund": 22025,
      "external_fund": 427500,
      "total_fund": 449525,
      "average_per_teacher": 49947.22222222222,
      "score": 4.162268518518518,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-010",
      "academic_year": 2568,
      "faculty_id": "FAC010",
      "faculty_name": "การจัดการโลจิสติกส์และการคมนาคมขนส่ง",
      "teacher_count": 15,
      "internal_fund": 45367,
      "external_fund": 3625480,
      "total_fund": 3670847,
      "average_per_teacher": 244723.13333333333,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-011",
      "academic_year": 2568,
      "faculty_id": "FAC011",
      "faculty_name": "วิทยาลัยนานาชาติ",
      "teacher_count": 14,
      "internal_fund": 56785,
      "external_fund": 6584972,
      "total_fund": 6641757,
      "average_per_teacher": 474411.21428571426,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-012",
      "academic_year": 2568,
      "faculty_id": "FAC012",
      "faculty_name": "วิทยาลัยบัณฑิตศึกษาจีน",
      "teacher_count": 65,
      "internal_fund": 256485,
      "external_fund": 3256485,
      "total_fund": 3512970,
      "average_per_teacher": 54045.692307692305,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-013",
      "academic_year": 2568,
      "faculty_id": "FAC013",
      "faculty_name": "สำนักการศึกษาทั่วไป",
      "teacher_count": 57,
      "internal_fund": 52412,
      "external_fund": 2365366,
      "total_fund": 2417778,
      "average_per_teacher": 42417.15789473684,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    },
    {
      "record_id": "RF-2568-014",
      "academic_year": 2568,
      "faculty_id": "FAC014",
      "faculty_name": "คณะพยาบาลศาสตร์",
      "teacher_count": 18,
      "internal_fund": 36548,
      "external_fund": 3564875,
      "total_fund": 3601423,
      "average_per_teacher": 200079.05555555556,
      "score": 5.0,
      "score_mode": "MANUAL",
      "note": "ข้อมูลตั้งต้นจาก Excel ปี 2568",
      "revision": 1,
      "status": "ACTIVE"
    }
  ]
};
