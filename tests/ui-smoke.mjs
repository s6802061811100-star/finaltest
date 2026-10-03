import {createRequire} from 'node:module';import {mkdir,readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const browser=await chromium.launch({headless:true});
const seed=JSON.parse(await readFile('public/assets/demo-data.json','utf8'));
await mkdir('test-results',{recursive:true});
const errors=[];const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:4173/?demo=1');await page.getByRole('heading',{name:'ภาพรวมเงินทุน',exact:true}).waitFor();
assert.ok((await page.locator('.kpi-value').first().textContent()).includes('51.39'));
await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true});
for(const name of ['ข้อมูลเงินทุน','เปรียบเทียบรายปี','วิเคราะห์รายคณะ','รายงาน']){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();}
await page.getByRole('button',{name:'CSV',exact:true}).click();
const excelWait=page.waitForEvent('download');await page.getByRole('button',{name:'Excel .xlsx'}).click();const excel=await excelWait;await excel.saveAs('test-results/report.xlsx');
await page.getByRole('button',{name:'ภาพรวมเงินทุน',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile page must not overflow horizontally');
// Mock the transport only; the real Apps Script permission and CRUD logic is independently exercised in backend tests.
await page.setViewportSize({width:1440,height:1000});
let role='TEACHER',calls=[];
await page.route('**/api/dispatch',async route=>{
 const input=route.request().postDataJSON();calls.push(input);let data;
 if(input.action==='bootstrap')data={...seed,user:{username:'test',display_name:role,role},settings:[],criteria:[],synced_at:new Date().toISOString()};
 else if(input.action==='saveFunding')data={...input.payload,record_id:input.payload.record_id||'RF-NEW',revision:1};
 else if(input.action==='adminData')data={users:[{username:'admin',display_name:'Admin',role:'ADMIN',active:true}],deleted:[],audit:[]};
 else data={saved:true};
 await route.fulfill({json:{ok:true,data}});
});
await page.goto('http://localhost:4173/');await page.getByRole('button',{name:'ข้อมูลเงินทุน',exact:true}).click();
assert.equal(await page.getByRole('button',{name:'เพิ่มข้อมูล',exact:true}).count(),1);
assert.equal(await page.getByRole('button',{name:'ลบ',exact:true}).count(),0);
assert.equal(await page.getByRole('button',{name:'จัดการผู้ใช้',exact:true}).count(),0);
await page.getByRole('button',{name:'แก้ไข',exact:true}).first().click();await page.locator('#modal').waitFor({state:'visible'});
assert.equal(await page.locator('[name="teacher_count"]').inputValue(),'72');
await page.locator('[name="internal_fund"]').fill('100.50');await page.locator('[name="external_fund"]').fill('200.75');
assert.equal(await page.locator('#calculated-total').textContent(),'301.25');
await page.screenshot({path:'test-results/teacher-edit.png'});
await page.getByRole('button',{name:'บันทึก',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});
assert.equal(calls.findLast(c=>c.action==='saveFunding').payload.internal_fund,100.5);
role='OWNER';await page.goto('http://localhost:4173/');await page.getByRole('button',{name:'ข้อมูลเงินทุน',exact:true}).click();assert.equal(await page.getByRole('button',{name:'เพิ่มข้อมูล',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'แก้ไข',exact:true}).count(),0);
role='ADMIN';await page.goto('http://localhost:4173/');await page.getByRole('button',{name:'ข้อมูลเงินทุน',exact:true}).click();assert.equal(await page.getByRole('button',{name:'ลบ',exact:true}).count(),14);
await page.getByRole('button',{name:'เพิ่มข้อมูล',exact:true}).click();await page.locator('[name="academic_year"]').fill('2569');await page.locator('[name="faculty_id"]').selectOption('FAC001');await page.locator('[name="teacher_count"]').fill('10.5');await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
for(const name of ['จัดการข้อมูลเงินทุน','จัดการคณะ','จัดการผู้ใช้','ตั้งค่าระบบ','ประวัติการเปลี่ยนแปลง']){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();}
// Run this matrix when Chromium is available; these are browser checks, not CSS string assertions.
const responsivePages=['ภาพรวมเงินทุน','ข้อมูลเงินทุน','เปรียบเทียบรายปี','วิเคราะห์รายคณะ','รายงาน','จัดการข้อมูลเงินทุน','จัดการคณะ','จัดการผู้ใช้','ตั้งค่าระบบ','ประวัติการเปลี่ยนแปลง'];
const widths=[320,390,600,768,820,1024,1366,1920];
for(const width of widths){
 await page.setViewportSize({width,height:900});
 for(const name of responsivePages){
  await page.getByRole('button',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,smallText:[...document.querySelectorAll('.nav-item,.caption,.field,.filters label,th,td,.table-note,.page-tools button')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.slice(0,40),size:parseFloat(getComputedStyle(e).fontSize)}))}));
  assert.ok(layout.scroll<=layout.width+1,`${name} overflows at ${width}px: ${layout.scroll}`);
  assert.ok(layout.smallText.every(e=>e.size>=13.9),`${name} has unreadable text at ${width}px`);
 }
 await page.getByRole('button',{name:'จัดการข้อมูลเงินทุน',exact:true}).click();await page.getByRole('button',{name:'แก้ไข',exact:true}).first().click();
 const modalLayout=await page.locator('#modal').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,inputSizes:[...e.querySelectorAll('input,select')].map(i=>parseFloat(getComputedStyle(i).fontSize))};});
 assert.ok(modalLayout.left>=0&&modalLayout.right<=modalLayout.width+1&&modalLayout.top>=0&&modalLayout.bottom<=modalLayout.height+1,`dialog does not fit ${width}px`);
 assert.ok(modalLayout.scrollWidth<=modalLayout.clientWidth+1&&modalLayout.inputSizes.every(n=>n>=16),`form overflows or text is too small at ${width}px`);
 await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.screenshot({path:`test-results/admin-management-${width}.png`,fullPage:true});
}
await page.setViewportSize({width:768,height:1024});await page.evaluate(()=>document.documentElement.style.fontSize='125%');
for(const name of responsivePages){await page.getByRole('button',{name,exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} overflows with enlarged text`);}
await page.evaluate(()=>document.documentElement.style.fontSize='');
await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true}).waitFor();await page.screenshot({path:'test-results/login-desktop.png'});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
assert.deepEqual(errors,[]);await writeFile('test-results/ui-summary.json',JSON.stringify({passed:true,roles:['ADMIN','TEACHER','OWNER'],screens:['desktop','mobile'],consoleErrors:errors},null,2));
await browser.close();console.log('UI smoke passed: navigation, filters, exports, roles, funding form, desktop and mobile.');
