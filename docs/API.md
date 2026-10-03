# ฐานข้อมูลและสิทธิ์ API

Browser ส่ง JSON `{ action, payload }` แบบ POST ไป `/api/dispatch` บน Cloudflare โดเมนเดียวกัน ตัวกลางเพิ่ม shared secret และ session จาก HttpOnly cookie ให้ Apps Script ตรวจ ก่อนอ่านหรือเขียน Spreadsheet

| Action | Admin | Teacher | Owner |
|---|:---:|:---:|:---:|
| login / logout | ✓ | ✓ | ✓ |
| bootstrap (ทุน คณะ ตั้งค่า เกณฑ์) | ✓ | ✓ | ✓ |
| changePassword (ของตนเอง) | ✓ | ✓ | ✓ |
| saveFunding (เพิ่ม/แก้) | ✓ | ✓ | — |
| deleteFunding / restoreFunding | ✓ | — | — |
| adminData (ผู้ใช้/ประวัติ/รายการลบ) | ✓ | — | — |
| saveFaculty / saveUser / saveSettings | ✓ | — | — |

Teacher เพิ่มและแก้ไขข้อมูลทุนได้ตามคำสั่งล่าสุดของผู้ใช้; หน้าบริหารฐานคณะ ผู้ใช้ เกณฑ์ และ Audit ยังเป็น Admin เท่านั้น

## หัวตาราง

- FundingData: `record_id, academic_year, faculty_id, teacher_count, internal_fund, external_fund, total_fund, average_per_teacher, score, score_mode, note, status, revision, created_by, created_at, updated_by, updated_at`
- Faculties: `faculty_id, faculty_name, active`
- Users: `username, display_name, role, password_salt, password_hash, active, updated_at`
- Sessions: `token_hash, username, expires_at, created_at`
- Settings: `key, value`
- ScoreCriteria: `academic_year, faculty_id, target_per_teacher`
- AuditLog: `event_id, timestamp, username, action, entity_id, before_json, after_json`

อย่าเปลี่ยนชื่อหรือสลับคอลัมน์เอง ระบบตรวจ Schema และจะหยุดเมื่อหัวตารางไม่ตรง

## พฤติกรรมข้อมูล

- หนึ่งรายการ ACTIVE ต่อหนึ่งคณะต่อหนึ่งปี ห้ามซ้ำ
- FTE มากกว่าศูนย์ ทุนไม่ติดลบ คะแนน 0–5 ปี พ.ศ. 2500–2700
- เงินทุนรวมและค่าเฉลี่ยคำนวณที่ Server ไม่รับค่าที่ Browser คำนวณมาเป็นค่าจริง
- คะแนน MANUAL เก็บตามต้นทาง; AUTO ต้องมีเกณฑ์คณะ–ปี และคำนวณ `min(5, average_per_teacher / target_per_teacher * 5)`
- แก้ข้อมูลผ่านเว็บเป็นหลัก หากแก้โดยตรงใน Sheet ต้องรักษา derived fields และ revision เอง เวอร์ชันนี้ไม่มี onEdit trigger
- ลบทุนเป็น Soft delete → `DELETED`; กู้คืนได้เมื่อไม่มีรายการ ACTIVE ซ้ำ
- คณะใช้การเปิด/ปิดใช้งาน ไม่ลบประวัติ; บัญชีผู้ใช้เปิด/ปิดได้และรีเซ็ตรหัสผ่านได้
- การแก้ทุนต้องส่ง revision ปัจจุบัน ถ้าไม่ตรงจะตอบ CONFLICT
- ป้องกันการเขียนสูตรจากข้อความที่ขึ้นต้นด้วย `= + - @` ด้วยการบันทึกเป็นข้อความ
- ใช้ ScriptLock เพื่อเรียงการเขียนและป้องกันการตรวจซ้ำพร้อมกัน ไม่มี Google Sheets transaction หลายชีต หากบริการ Google ล้มเหลวกลางทาง ให้รีเฟรชตรวจผลจริงก่อนลองอีกครั้ง

## Authentication

- Seed สร้าง admin / teacher / owner รหัสเริ่มต้น 1234 ที่ฝั่ง Apps Script เท่านั้น
- Salt รายผู้ใช้ + HMAC-SHA256 กับ PASSWORD_PEPPER ที่เก็บเฉพาะ Script Properties ค่า pepper ไม่อยู่ใน Sheet และไม่ได้ส่งให้ Browser
- Token แบบ UUID สองชุด เก็บ SHA256 ใน Sessions และส่ง token ผ่าน Secure / HttpOnly / SameSite=Strict cookie บน Cloudflare
- เซสชัน 8 ชั่วโมง Login ใหม่ยกเลิกเซสชันเดิมของชื่อผู้ใช้นั้น
- ตรวจ Users ปัจจุบันทุกคำขอ การปิดบัญชีหรือเปลี่ยนสิทธิ์มีผลทันที
- เปลี่ยนหรือรีเซ็ตรหัสผ่านยกเลิกเซสชันเก่า
- Login ผิด 8 ครั้งต่อ username และ IP จะจำกัด 15 นาทีใน Apps Script Cache; Cache เป็นการป้องกันเบื้องต้น ไม่ใช่ระบบ WAF และอาจถูก eviction โดย Google
- Proxy ตรวจ Origin และไม่รับ token, secret หรือ IP จาก Browser โดยตรง
- Shared secret ไม่ใช่ password ผู้ใช้; ใช้ค่าที่สุ่มยาวและเหมือนกันทั้งสองฝั่ง
- Spreadsheet ต้องให้สิทธิ์แก้ไขเฉพาะผู้ดูแลที่ไว้ใจได้ ผู้ที่แก้ไขฐานข้อมูลเองได้ถือเป็นผู้ดูแลฐานข้อมูล

## Error codes

`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `DUPLICATE`, `CONFLICT`, `RATE_LIMIT`, `SETUP_REQUIRED`, `SCHEMA_ERROR`, `NETWORK_UNCERTAIN`

Apps Script ContentService ไม่กำหนด HTTP status เอง จึงส่ง `{ok:false,error}` แล้ว Cloudflare แปลงเป็น HTTP 4xx/5xx ที่ถูกต้องให้ Browser และตาม Redirect ของ ContentService ฝั่ง Server

ไม่ใช้ JSONP, no-cors หรือฝังข้อมูลฐานทุนทั้งหมดในหน้าเว็บ Production
