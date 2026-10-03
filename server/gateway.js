// Vercel API gateway: same-origin BFF, httpOnly session, no secrets in browser.
const COOKIE = '__Host-rfund_session';
const STATUS = {UNAUTHORIZED:401,FORBIDDEN:403,VALIDATION:400,NOT_FOUND:404,DUPLICATE:409,CONFLICT:409,RATE_LIMIT:429,SETUP_REQUIRED:503,SCHEMA_ERROR:503};
function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
}
function cookie(req) { return (req.headers.get('Cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) || ''; }
function sessionCookie(value,maxAge=28800) { return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`; }
export async function handleRequest({request,env}) {
  if (request.method!=='POST') return json({ok:false,error:{code:'METHOD_NOT_ALLOWED',message:'ใช้ POST เท่านั้น'}},405);
  const origin=new URL(request.url).origin;
  if (request.headers.get('Origin')!==origin) return json({ok:false,error:{code:'FORBIDDEN',message:'คำขอไม่ได้มาจากเว็บไซต์นี้'}},403);
  if (!env.APPS_SCRIPT_URL || !env.API_SHARED_SECRET) return json({ok:false,error:{code:'SETUP_REQUIRED',message:'ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL และ API_SHARED_SECRET บน Vercel'}},503);
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.APPS_SCRIPT_URL)) return json({ok:false,error:{code:'SETUP_REQUIRED',message:'APPS_SCRIPT_URL ต้องเป็น Web App URL ลงท้าย /exec'}},503);
  let input;
  try {
    const raw=await request.text(); if (raw.length>90000) return json({ok:false,error:{code:'VALIDATION',message:'คำขอมีขนาดเกินกำหนด'}},413);
    input=JSON.parse(raw);
  } catch { return json({ok:false,error:{code:'VALIDATION',message:'รูปแบบ JSON ไม่ถูกต้อง'}},400); }
  const allowed=['login','logout','bootstrap','changePassword','saveFunding','deleteFunding','restoreFunding','adminData','saveFaculty','saveUser','saveSettings'];
  if (!allowed.includes(input.action)) return json({ok:false,error:{code:'VALIDATION',message:'ไม่พบคำสั่ง'}},400);
  // Do not trust incoming token, secret, role, or client IP from browser.
  const payload={...(input.payload || {})}; delete payload.client_ip;
  if (input.action==='login') payload.client_ip='unknown';
  try {
    const response=await fetch(env.APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:input.action,payload,secret:env.API_SHARED_SECRET,token:cookie(request)}),redirect:'follow',signal:AbortSignal.timeout(55000)});
    let data;
    try { data=await response.json(); } catch { return json({ok:false,error:{code:'UPSTREAM_ERROR',message:'Apps Script ไม่ส่ง JSON กลับมา ตรวจสอบสิทธิ์ Web App ว่าเป็น Anyone และใช้ URL /exec'}},502); }
    if (!data || typeof data.ok!=='boolean') throw new Error('Invalid upstream');
    const headers={};
    if (data.ok && input.action==='login') {
      const token=data.data?.token; if (!/^[a-f0-9-]{72}$/.test(token || '')) throw new Error('Invalid session');
      headers['Set-Cookie']=sessionCookie(token); delete data.data.token;
    }
    if ((data.ok && ['logout','changePassword'].includes(input.action)) || (!data.ok && data.error?.code==='UNAUTHORIZED' && input.action!=='login')) headers['Set-Cookie']=sessionCookie('',0);
    return json(data,data.ok?200:STATUS[data.error?.code] || 500,headers);
  } catch {
    // A network error on a write can occur AFTER Sheets was updated; never retry mutations automatically.
    return json({ok:false,error:{code:'NETWORK_UNCERTAIN',message:'ยังยืนยันผลกับฐานข้อมูลไม่ได้ กรุณากดรีเฟรชตรวจข้อมูลก่อนลองบันทึกซ้ำ'}},502);
  }
}
