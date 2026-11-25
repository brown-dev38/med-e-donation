# ฐานข้อมูลและระบบผู้ดูแล MED UP e-Donation

ใช้ Prisma ORM 7 กับ MySQL 8 ขึ้นไป เครื่องพัฒนาปัจจุบันใช้ MySQL 9.7

## เริ่มใช้งาน

1. คัดลอก `.env.example` เป็น `.env` แล้วตั้ง `DATABASE_URL` ให้ตรงกับ MySQL ต้อง URL-encode อักขระพิเศษในชื่อผู้ใช้และรหัสผ่าน
2. ตั้ง `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_USERNAME` และ `BOOTSTRAP_ADMIN_PASSWORD` สำหรับบัญชีเริ่มต้น
3. รันคำสั่งต่อไปนี้:

```sh
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

เปิด `/login` เพื่อเข้าสู่ระบบ เมื่อสำเร็จจะไปที่ `/admin` มีลิงก์เข้าสู่ระบบเจ้าหน้าที่ที่ส่วนท้ายหน้าแรก

Seed เพิ่มบัญชีเฉพาะเมื่อยังไม่มีอีเมลนั้น การรันซ้ำไม่เปลี่ยนรหัสผ่านหรือข้อมูลบัญชีเดิม รหัสผ่านอ่านจาก environment และเก็บเป็นแฮช scrypt ไม่มีรหัสผ่านเริ่มต้นใน source code

Seed สร้างวัตถุประสงค์กองทุนสองประเภทในสถานะปิดใช้งาน ต้องตั้งเลขบัญชีรับบริจาคจริงก่อนเปลี่ยน `is_active` เป็น `true`

## โครงสร้างและ migration

- `prisma/schema.prisma` แปลง 12 ตารางจากเอกสาร PostgreSQL ให้ใช้ MySQL คงชื่อตารางและคอลัมน์เดิมผ่าน `@map` / `@@map`
- เพิ่ม `admin_users.password_hash`, ฟิลด์ติดตามการล็อกอินผิด และ `admin_sessions` รวมเป็น 13 ตารางของแอป
- UUID เป็น `CHAR(36)`, JSON ใช้ MySQL JSON, สถานะ/บทบาทใช้ ENUM และเวลาเก็บเป็น `DATETIME(3)` ใน UTC
- SQL migration กำหนด `edonation_sla_due_date` เป็น STORED generated column จากวันที่โอน + 14 วัน พร้อม CHECK ยอดบริจาคมากกว่าศูนย์และเงื่อนไขชื่อนิสิตของ `fund_id = 2` ตามเอกสารเดิม Prisma แทน generated column ด้วย `dbgenerated()` ให้คง SQL ส่วนนี้ไว้ใน migration ต่อไป
- ค่าเริ่มต้น `hero_badge_text` กำหนดผ่าน SQL expression เพื่อเก็บอีโมจิและข้อความไทยครบ เนื่องจาก MySQL metadata ไม่สามารถส่งค่าที่มีอีโมจิกลับมาได้ตรงกัน จึงแทนด้วย `dbgenerated()` ใน Prisma เช่นกัน
- View ส่งออกจากเอกสาร PostgreSQL ยังไม่ได้สร้างใน migration นี้
- `contact_inquiries.reference_no` และ `audit_logs.target_id` คงเป็นการอ้างอิงเชิงตรรกะตามเอกสาร
- แผนภาพ Draw.io ใน `docs` แสดงแบบเดิมก่อนเพิ่ม authentication ให้ใช้ Prisma schema เป็นโครงสร้างที่ใช้งานจริง

```sh
npm run db:migrate -- --name change_description
npm run db:deploy
npm run db:status
npm run db:studio
```

ใช้ `db:migrate` สำหรับฐานข้อมูลพัฒนาเท่านั้น คำสั่งนี้ต้องมีสิทธิ์สร้าง shadow database ส่วน `db:deploy` ไม่ใช้ shadow database

## การเข้าสู่ระบบ

หน้า `/admin` ตรวจบัญชี สถานะใช้งาน บทบาท `ADMIN` และอายุ session ในฐานข้อมูลบน server การอ่าน session อยู่ภายใน Suspense ตามข้อกำหนด Cache Components ของ Next.js เวอร์ชันที่ติดตั้ง

Session อายุ 8 ชั่วโมง ใช้ token สุ่ม 256 บิตใน cookie แบบ HttpOnly / SameSite=Lax เก็บเฉพาะ SHA-256 ของ token ในฐานข้อมูล Production ใช้ Secure cookie จึงต้องเปิดผ่าน HTTPS การออกจากระบบลบ session ในฐานข้อมูล การกรอกรหัสผ่านผิด 5 ครั้งภายในช่วง 15 นาทีจะระงับบัญชี 15 นาที และบันทึก login/logout ใน `audit_logs`

## แบบฟอร์มบริจาค (`/donate`)

- แสดงเฉพาะกองทุนที่ `is_active = true` ถ้าไม่มีจะแสดงข้อความว่ายังไม่เปิดรับบริจาค ลิงก์ `/donate?fund=<fund_code>` เลือกทุนไว้ให้ล่วงหน้า
- ต้องตั้ง `TAX_ID_ENCRYPTION_KEY` (32 ไบต์ base64) เลขผู้เสียภาษีเก็บแบบ AES-256-GCM ใน `tax_id_encrypted` ส่วน `tax_id_hash` เป็น HMAC-SHA256 จากคีย์ที่ derive จากคีย์เดียวกัน ห้ามเปลี่ยนหรือทำคีย์หายหลังมีข้อมูลจริง
- สลิปรับเฉพาะ JPG/PNG ไม่เกิน 5 MB ตรวจชนิดไฟล์จากเนื้อไฟล์ เก็บที่ `SLIP_STORAGE_DIR` (ค่าเริ่มต้น `./storage`) นอก `public/` และ `slip_file_path` เก็บพาธสัมพัทธ์ เช่น `slips/2026/11/<uuid>.jpg` ต้องสำรองโฟลเดอร์นี้ร่วมกับฐานข้อมูล
- เลขอ้างอิงรูปแบบ `MEDUP-YYYYMMDD-NNN` ตามวันที่เวลาไทย ทุกรายการสร้าง `admin_notifications` หากสลิป hash ซ้ำ หรือวันเวลาและยอดตรงกับรายการเดิม จะเป็นประเภท `POSSIBLE_DUPLICATE_SLIP`
- เงื่อนไขชื่อนิสิตใช้ `requires_student_name` ของกองทุน (CHECK เดิมใน SQL ยังผูกกับ `fund_id = 2`)
- ยังไม่ส่งอีเมลและยังไม่มี rate limit

## ตรวจสลิปและอนุมัติครั้งที่ 1 (`/admin/donations`)

- รายการแยกตามสถานะ ค่าเริ่มต้นคือ "รอตรวจสลิป" เรียงจากเก่าไปใหม่ ค้นหาได้ด้วยเลขอ้างอิง เลขใบอนุโมทนาบัตร ชื่อ หรืออีเมล
- ภาพสลิปเปิดผ่าน `/admin/slips/<donation_id>` ซึ่งต้องมี session ผู้ดูแลและส่ง `Cache-Control: private, no-store`
- เลขผู้เสียภาษีแสดงแบบปกปิด การกด "แสดงเลขเต็ม" บันทึก `VIEW_TAX_ID` ใน `audit_logs`
- อนุมัติได้เมื่อติ๊กยืนยันครบ 3 ข้อ ระบบจะ
  - เปลี่ยนสถานะเป็น `WAITING_TREASURY_RD` และบันทึก `slip_verified_by` / `slip_verified_at`
  - ออกเลขใบอนุโมทนาบัตร `MEDUP-YY/NNNN` รันใหม่ทุกปีงบประมาณ พ.ศ. ซึ่งเริ่ม 1 ตุลาคม
  - อ่านการแจ้งเตือนของรายการนั้น และบันทึก `APPROVE_SLIP`
- ไม่อนุมัติต้องระบุเหตุผล ระบบเปลี่ยนเป็น `REJECTED` และบันทึก `REJECT_SLIP`
- ทั้งสองปุ่มทำงานเฉพาะรายการที่ยังรอตรวจ ถ้ามีผู้ดูแลอีกคนดำเนินการไปก่อน จะแจ้งว่าดำเนินการแล้ว
- เมื่ออนุมัติ ระบบสร้าง PDF เก็บที่ `storage/certificates/<ปีงบ>/` และส่งอีเมลฉบับที่ 1 พร้อมแนบ PDF แล้วบันทึก `email_sent_status`

## อนุมัติครั้งที่ 2 และอีเมล

- แท็บ "รอยืนยันกองคลัง" คือคิวของอนุมัติครั้งที่ 2 ต้องติ๊กยืนยันว่าคีย์ข้อมูลเข้าระบบ e-Donation แล้ว ระบบจะ
  - เปลี่ยนสถานะเป็น `COMPLETED_RD` และบันทึก `rd_submitted_by` / `rd_submitted_at`
  - ส่งอีเมลฉบับที่ 2 แล้วบันทึก `rd_confirm_email_sent_at` ยกเว้นผู้บริจาคไม่ประสงค์ลดหย่อนภาษี
- ถ้าส่งอีเมลไม่สำเร็จ การอนุมัติยังคงอยู่ หน้ารายละเอียดมีปุ่มส่งอีเมลอีกครั้ง และเลือกสร้าง PDF ใหม่ตามการตั้งค่าล่าสุดได้
- ตั้ง SMTP ด้วย `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` และ `MAIL_FROM`
  - ตอนพัฒนา ถ้าไม่มี `SMTP_HOST` อีเมลจะถูกเขียนเป็นไฟล์ `.eml` ใน `storage/outbox/`
  - ใน production ถ้าไม่ตั้งค่า อีเมลจะถูกบันทึกเป็น `FAILED`
- PDF ใช้ `@react-pdf/renderer` กับฟอนต์ `app/fonts/NotoSansThai.ttf`
  - ข้อความไทยตัดคำด้วย `Intl.Segmenter`
  - "ำ" ถูกแยกเป็น "ํา" ก่อนวาด เพราะ layout ของ PDF ทำให้ตัวอักษรท้ายบรรทัดหาย

## ส่งออก Excel e-Donation (`/admin/exports`)

- ส่งออกเฉพาะรายการที่
  - ผ่านอนุมัติครั้งที่ 1 แล้ว (`WAITING_TREASURY_RD`)
  - ผู้บริจาคประสงค์ลดหย่อนภาษี
  - ยังไม่เคยส่งออก
- กรองช่วงวันที่โอนได้ และติ๊กเพื่อรวมรายการที่เคยส่งออกแล้ว หรือที่ส่งสรรพากรแล้วได้
- การกดดาวน์โหลดจะ
  - สร้าง `edonation_export_batches` (`EXP-YYYYMM-NN`) และ `edonation_export_items`
  - เปลี่ยน `edonation_export_status` เป็น `EXPORTED` เพื่อไม่ให้ดึงซ้ำ
  - บันทึก `EXPORT_EXCEL_EDONATION`
- ไฟล์ .xlsx (ใช้ `exceljs`) มีเลขผู้เสียภาษี 13 หลักเต็ม
  - จัดเป็นข้อความ เลข 0 นำหน้าจึงไม่หาย
  - สร้างใหม่ทุกครั้งที่ดาวน์โหลด และทุกครั้งบันทึก `DOWNLOAD_EXCEL_EDONATION`
  - ดาวน์โหลดชุดเดิมซ้ำได้จากประวัติการส่งออก
- View `vw_edonation_excel_export` ในเอกสาร PostgreSQL ไม่ได้ใช้ เพราะเลขผู้เสียภาษีต้องถอดรหัสในแอป

## ตั้งค่า (`/admin/settings`)

- **กองทุนและการชำระเงิน:**
  - **บัญชีรับเงินรวม** (`payment_settings` มีแถวเดียว): ตั้งบัญชีและ QR ไว้ที่เดียว ใช้ร่วมกันได้ทุกวัตถุประสงค์ (QR รวม)
  - **วัตถุประสงค์:**
    - เพิ่มได้ วัตถุประสงค์ใหม่จะปิดรับบริจาคและใช้บัญชีรวมไว้ก่อน
    - ลบได้เมื่อยังไม่มีรายการบริจาค
    - แต่ละวัตถุประสงค์เลือก `payment_mode` ได้ว่าใช้บัญชีรวม (`SHARED`) หรือบัญชีแยก (`OWN`)
  - **QR** (`qr_type`) เลือกได้ 3 แบบ:
    - `PROMPTPAY`: พร้อมเพย์จากเลขผู้เสียภาษี มือถือ หรือ e-Wallet
    - `BANK_ACCOUNT`: Thai QR จากรหัสธนาคาร 3 หลักกับเลขที่บัญชี ใช้ tag 29-04 ซึ่งต้องทดลองสแกนกับแอปธนาคารก่อนใช้จริง
    - `NONE`: ไม่แสดง QR
  - QR บนฟอร์มบริจาคใส่ยอดเงินที่ผู้บริจาคเลือกให้อัตโนมัติ
  - เปิดรับบริจาคได้เมื่อบัญชีที่ใช้งานจริง (รวมหรือแยก) มีเลขที่บัญชีแล้ว
- **รายชื่อนิสิตผู้รับทุน** (`scholarship_students`):
  - เพิ่มได้ทีละหลายคนจากข้อความ หนึ่งบรรทัดต่อหนึ่งคน
  - เมื่อมีรายชื่อที่เปิดใช้งาน ทุนแบบระบุชื่อจะบังคับเลือกจากรายการ และ server ตรวจซ้ำ
- **ใบอนุโมทนาบัตรและอีเมล** (`certificate_settings` มีแถวเดียว):
  - ตั้งข้อความบนใบ ผู้ลงนาม และภาพลายเซ็น
  - ตั้งหัวเรื่องและเนื้อหาอีเมลทั้งสองฉบับ ใช้ตัวแปร เช่น `{donor_name}` และ `{document_no}`
  - ดูตัวอย่าง PDF ได้ ถ้ายังไม่บันทึกจะใช้ค่าเริ่มต้นใน `lib/certificate-settings.ts`
- dev server ที่เปิดค้างไว้จะสร้าง Prisma client ใหม่เองหลัง `npm run db:generate` (ดู `lib/prisma.ts`)

## ตรวจสอบ

```sh
npm run lint
npm test
npm run test:e2e
npm run build
```

Browser tests ใช้ Google Chrome ในเครื่องและเปิด dev server ที่ port 3120 ต้องมีฐานข้อมูลพัฒนาที่ migration แล้ว Tests สร้างบัญชีชั่วคราวและลบเมื่อจบ ให้ใช้ `DATABASE_URL` ของฐานข้อมูลพัฒนาสำหรับการทดสอบ

`npm run build` สร้าง Prisma Client ก่อน build อัตโนมัติ สำหรับ production รัน `npm run db:deploy` เป็นขั้นตอนแยกก่อนเปิดแอป แล้วใช้ `npm run start`
