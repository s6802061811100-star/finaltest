# คู่มือติดตั้ง R-FUND Insight 1.0.0

ใช้ Google Sheet ไฟล์นี้เป็นฐานข้อมูล: https://docs.google.com/spreadsheets/d/1WhvjrX5mX6DHbqLVrxbt76VLYjuNJR4S_Edb9Rjf2vs/edit

ระบบนี้ต้องสร้างเป็น **Cloudflare Pages** ที่เชื่อม GitHub เพื่อให้ `/functions` ทำงาน อย่าใช้เฉพาะการอัปโหลดไฟล์ HTML บน Static Hosting

## 1. เตรียม Google Apps Script

1. เปิด Google Sheet ด้วยบัญชีที่มีสิทธิ์แก้ไข → **ส่วนขยาย (Extensions) → Apps Script**
2. ตั้งชื่อโปรเจกต์ `R-FUND Insight API`
3. เปิดไฟล์ `Code.gs` ในหน้า Apps Script ลบโค้ดตัวอย่างทั้งหมด แล้วคัดลอกเนื้อหาทั้งไฟล์ `apps-script/Code.gs` จากชุดนี้ไปวางทับ และบันทึก ไม่ต้องแยกไฟล์ Seed
4. เข้า **Project Settings → Script Properties → Add script property**
5. เพิ่มชื่อ `API_SHARED_SECRET` โดยค่าต้องเป็นรหัสสุ่มเฉพาะระบบอย่างน้อย 32 ตัวอักษร เก็บค่านี้ไว้เพื่อนำไปใส่ Cloudflare ค่าเดียวกัน ไม่ใช้ `1234` เป็น secret
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
4. **Who has access: Anyone** เพราะ Cloudflare ต้องเรียกจากฝั่ง Server; ทุกคำขอยังต้องผ่าน API_SHARED_SECRET และสิทธิ์ผู้ใช้อีกชั้น
5. กด Deploy และคัดลอก **Web app URL** ที่ลงท้าย `/exec`
6. ลองเปิด URL ใน Browser จะเห็น JSON ชื่อบริการและเวอร์ชันเท่านั้น

ถ้าไม่มีตัวเลือก Anyone แสดงว่านโยบาย Google Workspace จำกัด Web App ให้ผู้ดูแลตรวจสอบก่อน ขั้นตอนนี้จำเป็นสำหรับสถาปัตยกรรมที่ให้ Cloudflare เป็นตัวกลาง

## 3. อัปโหลดโค้ดขึ้น GitHub

1. แตก ZIP ที่ได้รับ เปิดโฟลเดอร์ `r-fund-insight`
2. สร้าง Repository ของตัวเอง แนะนำเลือก **Private** เพราะ `apps-script/Code.gs` มีข้อมูลตั้งต้นจาก Excel อยู่ด้วย
3. อัปโหลดไฟล์และโฟลเดอร์ทั้งหมดภายใน `r-fund-insight` เข้าระดับบนสุดของ Repository โดยเฉพาะ `package.json`, `scripts`, `public`, `functions`, `apps-script`
4. ต้องเห็น `package.json` และ `functions` ที่หน้าแรก Repository ถ้าอยู่ในโฟลเดอร์ซ้อน ให้ตั้ง Root directory บน Cloudflare เป็นโฟลเดอร์นั้น
5. ไม่ต้องอัปโหลด `dist`, `node_modules`, `test-results` หรือไฟล์ค่าลับ `*.env` / `.dev.vars`

## 4. เชื่อม Cloudflare Pages กับ GitHub

1. ไปที่ Cloudflare Dashboard → **Workers & Pages** → สร้างแอป → เลือก **Pages** และ **Import an existing Git repository / Connect to Git** ตามเมนูที่แสดงในบัญชี
2. อนุญาต GitHub เฉพาะ Repository ที่สร้าง แล้วเลือก Repository นั้น
3. ตั้งค่าดังนี้

| รายการ | ค่า |
|---|---|
| Production branch | main หรือ branch หลักที่ใช้ |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | เว้นว่าง ถ้า package.json อยู่ระดับบนสุด |
| NODE_VERSION | `22` (ถ้าต้องระบุเวอร์ชัน) |

4. เพิ่ม Environment Variables/Secrets สำหรับ **Production**

| ชื่อ | ค่าที่ใส่ |
|---|---|
| `APPS_SCRIPT_URL` | Web app URL ของคุณจากข้อ 2 ลงท้าย `/exec` |
| `API_SHARED_SECRET` | ค่าเดียวกับ Script Properties ในข้อ 1 |

5. `API_SHARED_SECRET` ให้เก็บเป็น **Secret/Encrypted** ของ Cloudflare ห้ามใส่ค่าในไฟล์ JavaScript หน้าเว็บ
6. ถ้าจะใช้ Preview deployments ให้ตั้งสองค่านี้ใน Environment ของ Preview ด้วย หรือปล่อย Preview ไม่เชื่อมฐานจริงตามที่ต้องการ
7. กด Save and Deploy รอ Build เสร็จ แล้วเปิด URL `https://ชื่อโปรเจกต์.pages.dev`
8. ถ้าเพิ่ม/แก้ Environment Variables หลัง Deploy ต้อง **Redeploy** ให้ deployment ใหม่รับค่าที่ตั้ง

ไม่มีขั้นตอนให้แก้ API URL ใน HTML: หน้าเว็บเรียก `/api/dispatch` ของโดเมนตัวเอง ตัวกลางอ่านค่า APPS_SCRIPT_URL จาก Cloudflare

## 5. ตรวจระบบจริงหลังติดตั้ง

1. เข้าด้วย `admin / 1234` ดู Dashboard ปี 2568: ยอดรวม **51,386,071.33 บาท**, FTE **437**; ปี 2567: **25,341,497.63 บาท**, FTE **456** ถ้ายังไม่ได้เพิ่มหรือแก้ข้อมูล
2. กดชื่อผู้ใช้มุมขวาบนเพื่อเปลี่ยนรหัสผ่าน จากนั้น Login ใหม่
3. หน้า **ข้อมูลเงินทุน → เพิ่มข้อมูล** เลือกปีใหม่ เช่น 2569 และคณะที่มีอยู่ กรอก FTE และทุน แล้วบันทึก
4. เปิด Google Sheet `FundingData` ตรวจว่ามีแถวใหม่จริง แล้วแก้รายการจากเว็บและตรวจแถวเดิมอีกครั้ง
5. เข้าด้วย `teacher / 1234` ตรวจว่ามี **เพิ่มข้อมูล** และ **แก้ไข** แต่ไม่มี **ลบ**; ทดลองเพิ่ม/แก้รายการทดสอบ
6. เข้าด้วย `owner / 1234` ตรวจว่าไม่มีเพิ่ม แก้ไข หรือลบ และเปิดรายงานได้
7. กลับเข้า Admin ลบรายการทดสอบ ตรวจว่า `status` เป็น `DELETED` และหน้าเว็บไม่แสดงรายการ แล้วไปหน้าประวัติ กู้คืนและตรวจกลับมาได้
8. หน้ารายงาน กรองปีและคณะ → ส่งออก Excel/CSV ตรวจรายการที่ได้; พิมพ์ / PDF → เลือก Save as PDF ตั้งเป็นแนวนอน
9. เปลี่ยนรหัสผ่าน teacher และ owner ด้วย หากมีผู้ใช้หลายคน ให้ Admin สร้างบัญชีเฉพาะบุคคล ไม่ใช้บัญชี teacher ร่วมกัน เพราะ Login ใหม่จะยกเลิกเซสชันเดิมของบัญชีนั้น

## 6. อัปเดตระบบครั้งถัดไป

- หน้าเว็บ: แก้โค้ดและ Push GitHub ให้ Pages Build/Deploy ใหม่
- Apps Script: วาง Code.gs ฉบับใหม่ทั้งไฟล์ → Save → Deploy → Manage deployments → Edit → New version → Deploy เพื่อคง URL เดิม
- ไม่ต้องรัน setupSystem ทุกครั้ง; หากรันซ้ำจะไม่ลบหรือเขียนทับข้อมูลทุนที่มีอยู่
- ก่อนเปลี่ยนโครงสร้างฐานข้อมูล ให้สำเนา Google Sheet ไว้เป็น backup

## แก้ปัญหาที่พบบ่อย

| อาการ | วิธีตรวจ |
|---|---|
| แจ้งยังไม่ตั้งค่า URL/secret | ตรวจชื่อ Environment Variables ใน Production และ Redeploy |
| Apps Script ไม่ส่ง JSON | ใช้ URL `/exec`, ตั้ง Anyone, Deploy เวอร์ชันใหม่ และทดลองเปิด URL |
| ไม่ได้รับอนุญาตให้เรียก API | ตรวจ API_SHARED_SECRET ให้ตรงกันทุกตัวทั้ง Apps Script และ Cloudflare |
| กรุณารัน setupSystem | รันฟังก์ชันใน Apps Script ด้วยบัญชีที่แก้ไข Sheet ได้ |
| หัวตารางไม่ตรง | ห้ามแก้ชื่อหรือย้ายคอลัมน์ฐานข้อมูล; ตรวจหัวตารางตาม docs/API.md |
| Login แล้วกลับหน้า Login | ใช้ HTTPS URL จริงของ Pages ตรวจ Cookie ไม่ถูกบล็อก และตรวจเซสชัน/บัญชี |
| ข้อมูลคณะ–ปีซ้ำ | แก้รายการเดิม หรือกู้คืนรายการที่ลบ ห้ามเพิ่มรายการคณะ–ปีเดียวกันซ้ำ |
| ข้อมูลเปลี่ยนโดยผู้ใช้อื่น | กดรีเฟรช เปิดรายการใหม่ แล้วแก้อีกครั้ง |
| ยังยืนยันผลบันทึกไม่ได้ | กดรีเฟรชตรวจว่าข้อมูลถูกบันทึกแล้วหรือยัง ก่อนกดบันทึกซ้ำ |
| คะแนนอัตโนมัติไม่มีเกณฑ์ | Admin ต้องตั้งเกณฑ์คณะและปีนั้นก่อน หรือใช้คะแนนจากต้นทาง |
| เปิด index.html ตรงในเครื่องไม่ทำงาน | ใช้ npm run preview; ES Modules ต้องเปิดผ่าน HTTP |
| แก้ตัวเลขใน Sheet แล้วค่ารวมไม่เปลี่ยน | การคำนวณอยู่ที่ API ให้แก้ผ่านหน้าเว็บ; อย่าแก้ derived columns โดยตรง |

## เอกสารทางการที่ตรวจประกอบการติดตั้ง

- Cloudflare Git integration: https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Environment bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Google Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Content Service และการตาม Redirect: https://developers.google.com/apps-script/guides/content

ชื่อเมนู Dashboard อาจเปลี่ยนตามรุ่น แต่ค่าของ Build และ Environment Variables ด้านบนเป็นค่าที่โค้ดชุดนี้ใช้
