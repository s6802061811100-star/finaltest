# คู่มือติดตั้ง R-FUND Insight 1.0.1

ใช้ Google Sheet ไฟล์นี้เป็นฐานข้อมูล: https://docs.google.com/spreadsheets/d/1WhvjrX5mX6DHbqLVrxbt76VLYjuNJR4S_Edb9Rjf2vs/edit

ระบบนี้ใช้ **GitHub → Vercel → Google Apps Script → Google Sheet** และมี API `/api/dispatch` สำหรับ Login และ CRUD

## 1. เตรียม Google Apps Script

1. เปิด Google Sheet ด้วยบัญชีที่มีสิทธิ์แก้ไข → **ส่วนขยาย (Extensions) → Apps Script**
2. ตั้งชื่อโปรเจกต์ `R-FUND Insight API`
3. เปิดไฟล์ `Code.gs` ในหน้า Apps Script ลบโค้ดตัวอย่างทั้งหมด แล้วคัดลอกเนื้อหาทั้งไฟล์ `apps-script/Code.gs` จากชุดนี้ไปวางทับ และบันทึก ไม่ต้องแยกไฟล์ Seed
4. เข้า **Project Settings → Script Properties → Add script property**
5. เพิ่มชื่อ `API_SHARED_SECRET` โดยค่าต้องเป็นรหัสสุ่มเฉพาะระบบอย่างน้อย 32 ตัวอักษร เก็บค่านี้ไว้เพื่อนำไปใส่ Vercel ค่าเดียวกัน ไม่ใช้ `1234` เป็น secret
6. หากใช้ Node.js ในเครื่อง สร้างค่าได้ด้วย `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` หรือใช้เครื่องมือสร้างรหัสผ่านที่คุณใช้อยู่ ห้ามใส่ค่า secret นี้ในไฟล์เว็บหรือ GitHub
7. เลือกฟังก์ชัน **setupSystem** ที่แถบด้านบน แล้วกด **Run**
8. อนุญาตให้สคริปต์เข้าถึง Spreadsheet ตามขั้นตอนของ Google ถ้านโยบายองค์กรไม่อนุญาต ให้ผู้ดูแล Google Workspace ตรวจสิทธิ์ก่อน
9. กลับไปดู Google Sheet จะมี `FundingData`, `Faculties`, `Users`, `Sessions`, `Settings`, `ScoreCriteria`, `AuditLog` เพิ่มขึ้น โดยชีตปีเดิมยังอยู่
10. ตรวจว่า `FundingData` มีข้อมูล 28 รายการ: ปี 2567 จำนวน 14 รายการ และปี 2568 จำนวน 14 รายการ

`PASSWORD_PEPPER` ถูกสร้างใน Script Properties โดย setupSystem เก็บค่านี้ไว้ ห้ามลบหรือเปลี่ยนโดยตรง เพราะรหัสผ่านเดิมจะตรวจสอบไม่ได้ ถ้าต้องย้ายโปรเจกต์ ให้คงค่าเดิมด้วย

ไฟล์ `appsscript.json` ที่แนบเป็น manifest สำหรับ V8, Asia/Bangkok และสิทธิ์ spreadsheets หากต้องการใช้ เปิดตัวเลือกแสดง manifest ใน Project Settings แล้ววางเนื้อหาทั้งไฟล์ไปแทนของเดิม

## 2. เผยแพร่ Apps Script เป็น Web App

1. กด **Deploy → New deployment**
2. เลือกชนิด **Web app**
3. **Execute as: Me** เพื่อให้สคริปต์อ่าน/เขียน Sheet ด้วยสิทธิ์เจ้าของโปรเจกต์
4. **Who has access: Anyone** เพราะ Vercel ต้องเรียกจากฝั่ง Server; ทุกคำขอยังต้องผ่าน API_SHARED_SECRET และสิทธิ์ผู้ใช้อีกชั้น
5. กด Deploy และคัดลอก **Web app URL** ที่ลงท้าย `/exec`
6. ลองเปิด URL ใน Browser จะเห็น JSON ชื่อบริการและเวอร์ชันเท่านั้น

ถ้าไม่มีตัวเลือก Anyone แสดงว่านโยบาย Google Workspace จำกัด Web App ให้ผู้ดูแลตรวจสอบก่อน ขั้นตอนนี้จำเป็นสำหรับสถาปัตยกรรมที่ให้ Vercel เป็นตัวกลาง

## 3. อัปเดตไฟล์ใน GitHub

1. ดาวน์โหลดและแตก ZIP ชุด Vercel 1.0.1
2. เปิด Repository `finaltest` ที่เลือกไว้ หรือ Repository ที่คุณต้องการใช้
3. เลือก **Add file → Upload files**
4. เปิดโฟลเดอร์ `r-fund-insight-vercel` ในเครื่อง แล้วลาก **ไฟล์และโฟลเดอร์ภายในทั้งหมด** ไปอัปโหลด โดย package.json และ vercel.json ต้องอยู่ระดับบนสุด ไม่อัปโหลดโฟลเดอร์ครอบซ้อนอีกชั้น
5. กด Commit changes ใช้ข้อความ `Update R-FUND Insight v1.0.1 Vercel Hosting`
6. ตรวจหน้าแรก Repository ต้องเห็น `api`, `server`, `public`, `scripts`, `apps-script`, `package.json`, `vercel.json`

หากมีโฟลเดอร์ `functions` ของชุด Cloudflare เดิมอยู่ Vercel รุ่นนี้ไม่ได้เรียกใช้งานโฟลเดอร์นั้น

## 4. สร้างโปรเจกต์ใน Vercel

1. Vercel → **Create New → Project**
2. Import Repository ที่อัปโหลด เช่น `finaltest`
3. หน้า New Project ตั้งค่าดังนี้

| รายการ | ค่า |
|---|---|
| Vercel Team | บัญชี/ทีมที่คุณใช้ |
| Project Name | `r-fund-insight` หรือชื่อที่คุณเลือก |
| Root Directory | `./` หากไฟล์อยู่ระดับบนสุด |
| Application / Framework Preset | `Other` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | ค่าเริ่มต้น หรือ `npm install` |
| Node.js | `22.x` กำหนดใน package.json แล้ว |

ไฟล์ `vercel.json` ตั้ง Build command และ Output directory ให้แล้ว หากหน้าเว็บเปิด Override ไว้ให้ตรวจว่าค่าตรงตาราง

4. เปิด **Environment Variables** เพิ่มสองรายการ

| ชื่อ | ค่า |
|---|---|
| `APPS_SCRIPT_URL` | Web app URL จาก Google Apps Script ลงท้าย `/exec` |
| `API_SHARED_SECRET` | ค่าเดียวกับ Script Properties ของ Apps Script |

5. อย่าใส่ secret ใน Source code หรือ GitHub และไม่ใช้ชื่อขึ้นต้น `NEXT_PUBLIC_` เพราะค่านี้ต้องอยู่ฝั่ง Server
6. กด Deploy เมื่ออัปเดต GitHub และเพิ่มสองค่าเรียบร้อย
7. หลังเสร็จให้เปิด Production URL ของโปรเจกต์

หากเคยติดตั้ง Apps Script รุ่น 1.0.0 ไว้แล้ว ให้ใช้ URL /exec และ secret เดิม ไม่จำเป็นต้องติดตั้ง Apps Script ใหม่ การเปลี่ยนโฮสต์นี้ไม่ได้เปลี่ยนฐานข้อมูล

## 5. ตรวจการใช้งานจริง

1. Login `admin / 1234` หากยังไม่เปลี่ยนรหัส
2. Dashboard ปี 2568 ควรมีเงินทุนรวม 51,386,071.33 บาท และ FTE 437 หากข้อมูลตั้งต้นยังไม่ได้แก้
3. กดชื่อผู้ใช้มุมขวาบนเพื่อเปลี่ยนรหัสผ่านของตนเอง แล้ว Login ใหม่
4. เพิ่มรายการทดสอบในปีใหม่ เช่น 2569 และตรวจแถวใหม่ใน FundingData ของ Google Sheet
5. ทดลองแก้จากเว็บ แล้วตรวจแถวเดิมใน Sheet
6. Teacher เพิ่ม/แก้ทุนได้ แต่ไม่มีปุ่มลบ; Owner ไม่มีเพิ่ม/แก้/ลบ
7. Admin ลบรายการทดสอบ แล้วกู้คืนผ่านหน้าประวัติ
8. รายงานส่งออก Excel / CSV และพิมพ์ PDF ผ่าน Browser
9. หากผู้ใช้หลายคน ให้ Admin สร้างบัญชีเฉพาะบุคคล เพราะ Login ของชื่อผู้ใช้เดียวกันยกเลิกเซสชันเดิม

## 6. การอัปเดตและแก้ปัญหา

- แก้หน้าเว็บ → Push GitHub → Vercel Deploy อัตโนมัติ
- แก้ Environment Variables → Redeploy ให้ Deployment ใหม่รับค่าที่ตั้ง
- แก้ Apps Script → Save → Deploy → Manage deployments → Edit → New version → Deploy เพื่อคง URL เดิม
- ห้ามเปลี่ยน PASSWORD_PEPPER หรือรหัสข้อมูลภายใน Sheet เอง

| อาการ | วิธีตรวจ |
|---|---|
| API 404 | ต้องมี api/dispatch.js และ vercel.json อยู่ใน Root ของโปรเจกต์ ไม่ใช่ใช้ชุด Cloudflare |
| ยังไม่ได้ตั้งค่า URL/secret | ตรวจสองค่าใน Vercel Project Settings → Environment Variables แล้ว Redeploy |
| Apps Script ไม่ส่ง JSON | ตรวจ URL /exec, ตั้ง Anyone และ Deploy Apps Script เวอร์ชันล่าสุด |
| ไม่ได้รับอนุญาตให้เรียก API | API_SHARED_SECRET ต้องตรงกันทั้งสองฝั่ง |
| กรุณารัน setupSystem | รันจาก Apps Script ด้วยบัญชีที่แก้ไข Sheet ได้ |
| ข้อมูลคณะ–ปีซ้ำ | ใช้แก้รายการเดิมหรือกู้คืน ห้ามเพิ่มคณะและปีเดียวกันซ้ำ |
| เซสชันหมดอายุ | Login ใหม่ และตรวจบัญชีว่าเปิดใช้งานอยู่ |
| ยังยืนยันผลบันทึกไม่ได้ | กดรีเฟรชตรวจฐานจริงก่อนลองบันทึกอีกครั้ง |
| คะแนน AUTO ไม่มีเกณฑ์ | Admin ต้องตั้งเกณฑ์คณะและปีนั้น หรือใช้คะแนนเดิม |

## เอกสารทางการ

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration/vercel-json
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/content

## พิมพ์ / PDF / CSV ทุกหน้าข้อมูล

1. เปิดหน้าที่ต้องการและเลือกตัวกรองให้เรียบร้อย
2. กด “พิมพ์ / บันทึก PDF” ที่ด้านบนของข้อมูล
3. เลือกเครื่องพิมพ์เพื่อพิมพ์กระดาษ หรือ Destination → Save as PDF เพื่อดาวน์โหลดไฟล์ PDF (Chrome บน Mac อาจมีเมนู Save as PDF หรือ PDF → Save as PDF)
4. ตั้งแนวนอน Landscape และเปิด Background graphics หากต้องการเก็บสีกราฟ
5. กด “ดาวน์โหลด CSV” เพื่อรับข้อมูลของหน้านั้น ไม่จำเป็นต้องไปหน้ารายงาน

หน้าที่รองรับ: ภาพรวม ข้อมูลทุน เปรียบเทียบ รายคณะ รายงาน ฐานคณะ ผู้ใช้ เกณฑ์/ตั้งค่า และประวัติ โดยผู้ใช้เห็นและส่งออกได้ตามสิทธิ์ของตนเอง
