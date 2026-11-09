# การออกแบบฐานข้อมูล (Database Schema Design)

**โครงการ:** ระบบรับบริจาคทุนการศึกษาออนไลน์ คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา (MED UP e-Donation)

เอกสารฉบับนี้สรุปโครงสร้างฐานข้อมูลเชิงสัมพันธ์ (Relational Database Schema) ที่ออกแบบให้สอดคล้องกับขั้นตอนการบริจาค (Donation Workflow) การแนบสลิปโอนเงิน การออกใบอนุโมทนาบัตรอิเล็กทรอนิกส์ (PDF) และการส่งออกข้อมูลไฟล์ Excel สำหรับเจ้าหน้าที่การเงิน (พี่บอม) เพื่อนำส่งข้อมูลลดหย่อนภาษี e-Donation ภายในกรอบเวลา 2 สัปดาห์

## 1. ภาพรวมความสัมพันธ์ของตาราง (Entity-Relationship Overview)

ระบบประกอบด้วย **11 ตารางหลัก** ที่เชื่อมโยงการทำงานตั้งแต่หน้าเว็บไซต์ประชาสัมพันธ์และฟอร์มผู้บริจาคไปจนถึงระบบหลังบ้าน (Admin Dashboard & CMS):

 1. **`scholarship_funds`** เก็บข้อมูลวัตถุประสงค์การบริจาค (ทุนที่คณะจัดสรรให้ และทุนที่ระบุชื่อนิสิตผู้รับทุน)

 2. **`donations`** เก็บข้อมูลธุรกรรมการบริจาค ข้อมูลผู้เสียภาษี วัน-เวลาโอน และไฟล์สลิปโอนเงิน (ไม่ต้องสมัครสมาชิก)

 3. **`acknowledgement_certificates`** เก็บข้อมูลเลขที่ใบอนุโมทนาบัตร (`MEDUP-YY/XXXX`) ไฟล์ PDF และสถานะการส่งอีเมล

 4. **`edonation_export_batches`** เก็บประวัติรอบการดึงไฟล์ Excel ส่งให้เจ้าหน้าที่การเงิน (พี่บอม) เพื่อป้องกันการดึงรายการซ้ำและติดตามกรอบเวลา 2 สัปดาห์

 5. **`edonation_export_items`** ตารางเชื่อมรายการบริจาคแต่ละรายการเข้ากับรอบการดึงไฟล์ Excel

 6. **`contact_inquiries`** เก็บรายการติดต่อเจ้าหน้าที่ กรณีผู้บริจาคติดตามผล e-Donation เกิน 2 สัปดาห์ หรือขอแก้ไขข้อมูล

 7. **`admin_users`** เก็บข้อมูลเจ้าหน้าที่ผู้ดูแลระบบและสิทธิ์การใช้งาน (แยกตามบทบาท)

 8. **`audit_logs`** เก็บประวัติการตรวจสอบสลิป การอนุมัติใบอนุโมทนาบัตร การแก้ไขหน้าประชาสัมพันธ์ และการดาวน์โหลดไฟล์ Excel ทุกครั้งตามมาตรฐานการตรวจสอบภายใน

 9. **`landing_page_configs`** เก็บข้อมูลการตั้งค่าหน้าแรกประชาสัมพันธ์กองทุน (พาดหัวแบนเนอร์ คำโปรย รูปภาพหลัก และข้อความแถบประกาศแจ้งเตือน SLA 2 สัปดาห์) เพื่อให้ Admin ปรับแก้ไขหน้าเว็บได้เอง

10. **`pr_news_articles`** เก็บข่าวสารประชาสัมพันธ์ กิจกรรมพิธีมอบทุน และรายงานผลการจัดสรรทุนการศึกษาที่แสดงบนหน้าแรก

11. **`landing_carousel_slides`** เก็บข้อมูลสไลด์รูปภาพแบนเนอร์ (Carousel) บนหน้าแรก พร้อมลำดับการแสดงผล พาดหัว คำบรรยาย และสถานะเปิด/ปิด เพื่อให้ Admin เพิ่ม ลบ หรือจัดเรียงสไลด์ได้

```
[scholarship_funds] (1) ──────< (N) [donations] (1) ────── (0..1) [acknowledgement_certificates]
                                         │
                                         ├──< (N) [edonation_export_items] >── (1) [edonation_export_batches]
                                         │
[admin_users] (1) ────────────< (N) [audit_logs]
      │
      ├───────────────────────< (N) [landing_page_configs]
      ├───────────────────────< (N) [landing_carousel_slides]
      └───────────────────────< (N) [pr_news_articles]



```

## 2. พจนานุกรมข้อมูล (Data Dictionary)

### 2.1 ตาราง `scholarship_funds` (วัตถุประสงค์กองทุนทุนการศึกษา)

ใช้เก็บประเภทวัตถุประสงค์การบริจาคและเงื่อนไขว่าต้องระบุชื่อนิสิตผู้รับทุนหรือไม่

| ชื่อคอลัมน์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraint | คำอธิบาย | 
| ----- | ----- | ----- | ----- | 
| `fund_id` | `SERIAL / INT` | `PK` | รหัสอ้างอิงวัตถุประสงค์ทุน | 
| `fund_code` | `VARCHAR(50)` | `UNIQUE, NOT NULL` | รหัสกองทุน เช่น `GENERAL_SCHOLARSHIP`, `SPECIFIC_STUDENT` | 
| `fund_name_th` | `VARCHAR(255)` | `NOT NULL` | ชื่อวัตถุประสงค์ทุนการศึกษา (แสดงบนหน้าเว็บและใบอนุโมทนาบัตร) | 
| `fund_description` | `TEXT` | `NULL` | รายละเอียดวัตถุประสงค์ของทุนการศึกษา | 
| `requires_student_name` | `BOOLEAN` | `DEFAULT FALSE` | กำหนดว่าต้องกรอกชื่อนิสิตผู้รับทุนหรือไม่ (`TRUE` สำหรับทุนระบุชื่อนิสิต) | 
| `bank_name` | `VARCHAR(100)` | `NOT NULL` | ชื่อธนาคารรับบริจาค เช่น ธนาคารกรุงไทย | 
| `bank_account_no` | `VARCHAR(50)` | `NOT NULL` | เลขที่บัญชีธนาคารสำหรับรับโอน | 
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | สถานะเปิดรับบริจาค (`TRUE` = เปิดใช้งาน, `FALSE` = ปิดชั่วคราว) | 
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่สร้างรายการ | 
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่แก้ไขล่าสุด | 

### 2.2 ตาราง `donations` (ธุรกรรมการบริจาคและข้อมูลผู้บริจาค)

ตารางหลักสำหรับบันทึกข้อมูลจากหน้าแบบฟอร์มบริจาค (ขั้นตอนที่ 1–4) โดยแยกเก็บข้อมูลเลขประจำตัวผู้เสียภาษีแบบเข้ารหัสตามมาตรฐาน PDPA

| ชื่อคอลัมน์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraint | คำอธิบาย | 
| ----- | ----- | ----- | ----- | 
| `donation_id` | `UUID` | `PK` | รหัสธุรกรรมการบริจาคหลัก (Primary Key) | 
| `reference_no` | `VARCHAR(30)` | `UNIQUE, NOT NULL` | เลขอ้างอิงรายการที่แสดงต่อผู้บริจาค เช่น `MEDUP-20261026-001` | 
| `fund_id` | `INT` | `FK -> scholarship_funds` | วัตถุประสงค์การบริจาคที่เลือก | 
| `student_recipient_name` | `VARCHAR(255)` | `NULL` | ชื่อ-นามสกุลนิสิตแพทย์ผู้รับทุน (บังคับกรอกเมื่อเลือกทุนระบุชื่อนิสิต) | 
| `student_recipient_code` | `VARCHAR(20)` | `NULL` | รหัสนิสิตแพทย์ผู้รับทุน (ถ้าทราบ) | 
| `donor_type` | `VARCHAR(20)` | `NOT NULL` | ประเภทผู้บริจาค (`INDIVIDUAL` = บุคคลธรรมดา, `CORPORATE` = นิติบุคคล) | 
| `donor_prefix` | `VARCHAR(50)` | `NOT NULL` | คำนำหน้าชื่อ เช่น นาย, นางสาว, นพ., พญ., บริษัท | 
| `donor_name` | `VARCHAR(255)` | `NOT NULL` | ชื่อ-นามสกุลผู้บริจาค หรือชื่อนิติบุคคล | 
| `tax_id_encrypted` | `TEXT` | `NOT NULL` | เลขประจำตัวผู้เสียภาษี 13 หลัก (เข้ารหัส AES-256 สำหรับส่งออก Excel e-Donation) | 
| `tax_id_masked` | `VARCHAR(20)` | `NOT NULL` | เลขผู้เสียภาษีแบบปกปิดบางส่วน เช่น `35601xxxx4812` สำหรับแสดงผลทั่วไป | 
| `tax_id_hash` | `CHAR(64)` | `INDEX, NOT NULL` | ค่า SHA-256 Hash ของเลขผู้เสียภาษี สำหรับใช้ค้นหาโดยไม่ต้องถอดรหัสทั้งตาราง | 
| `phone` | `VARCHAR(30)` | `NOT NULL` | เบอร์โทรศัพท์ติดต่อผู้บริจาค | 
| `email` | `VARCHAR(255)` | `NOT NULL` | อีเมลสำหรับจัดส่งใบอนุโมทนาบัตร PDF | 
| `need_tax_deduction` | `BOOLEAN` | `DEFAULT TRUE` | ความประสงค์ใช้สิทธิ์ลดหย่อนภาษี e-Donation | 
| `pdpa_consent` | `BOOLEAN` | `NOT NULL` | การยินยอมให้จัดเก็บและส่งข้อมูลเพื่อลดหย่อนภาษีตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล | 
| `amount` | `NUMERIC(12,2)` | `NOT NULL, > 0` | จำนวนเงินที่บริจาค (บาท) | 
| `transfer_date` | `DATE` | `NOT NULL` | วันที่โอนเงินตามสลิป | 
| `transfer_time` | `TIME` | `NOT NULL` | เวลาที่โอนเงินตามสลิป | 
| `slip_file_path` | `VARCHAR(500)` | `NOT NULL` | พาธเก็บไฟล์ภาพสลิปโอนเงินใน Object Storage ที่จำกัดสิทธิ์เข้าถึง | 
| `slip_file_hash` | `CHAR(64)` | `INDEX, NULL` | ค่า Hash ของไฟล์ภาพสลิป เพื่อแจ้งเตือนกรณีมีผู้บริจาคแนบไฟล์สลิปซ้ำ | 
| `verification_status` | `VARCHAR(30)` | `DEFAULT 'PENDING_SLIP_CHECK'` | สถานะตาม Flow ใหม่ (`PENDING_SLIP_CHECK` = รอตรวจสลิปเทียบ Book Bank, `WAITING_TREASURY_RD` = อนุมัติครั้งที่ 1 ส่งใบอนุโมทนาบัตรแล้ว รอยืนยันจากกองคลัง/คีย์สรรพากร, `COMPLETED_RD` = อนุมัติครั้งที่ 2 ส่งข้อมูลกรมสรรพากรและส่งเมลยืนยันแล้ว, `REJECTED` = ไม่ผ่าน) |
| `slip_verified_by` | `INT` | `FK -> admin_users, NULL` | เจ้าหน้าที่ Admin ผู้กดอนุมัติครั้งที่ 1 (ตรวจชื่อ-สลิป-เลขภาษี ตรงกับ Book Bank) |
| `slip_verified_at` | `TIMESTAMPTZ` | `NULL` | วันเวลาที่กดอนุมัติครั้งที่ 1 และสั่งส่งใบอนุโมทนาบัตรทางอีเมล |
| `rd_submitted_by` | `INT` | `FK -> admin_users, NULL` | เจ้าหน้าที่ผู้กดอนุมัติครั้งที่ 2 (หลังกองคลังยืนยันและกรอกข้อมูลลงระบบ e-Donation กรมสรรพากรแล้ว) |
| `rd_submitted_at` | `TIMESTAMPTZ` | `NULL` | วันเวลาที่กดอนุมัติครั้งที่ 2 |
| `rd_confirm_email_sent_at` | `TIMESTAMPTZ` | `NULL` | วันเวลาที่ระบบส่งอีเมลฉบับที่ 2 ยืนยันการส่งข้อมูลกรมสรรพากรให้ผู้บริจาค | 
| `verified_by` | `INT` | `FK -> admin_users, NULL` | รหัสเจ้าหน้าที่ผู้ตรวจสอบและอนุมัติสลิป | 
| `verified_at` | `TIMESTAMPTZ` | `NULL` | วันเวลาที่เจ้าหน้าที่กดอนุมัติยอดโอน | 
| `rejection_reason` | `TEXT` | `NULL` | หมายเหตุกรณีสลิปไม่ถูกต้องหรือยอดเงินไม่ตรง | 
| `edonation_sla_due_date` | `DATE` | `NOT NULL` | วันครบกำหนด 2 สัปดาห์ (14 วัน) นับจากวันที่บริจาค เพื่อแจ้งเตือนเจ้าหน้าที่ | 
| `edonation_export_status` | `VARCHAR(20)` | `DEFAULT 'PENDING'` | สถานะการดึงข้อมูลส่งพี่บอม (`PENDING` = ยังไม่ดึง, `EXPORTED` = ดึงไฟล์ Excel แล้ว) | 
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่ผู้บริจาคทำรายการผ่านหน้าเว็บ | 
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่อัปเดตข้อมูลล่าสุด | 

### 2.3 ตาราง `acknowledgement_certificates` (ใบอนุโมทนาบัตรอิเล็กทรอนิกส์)

สร้างข้อมูลเมื่อเจ้าหน้าที่กดอนุมัติรายการ เพื่อรันเลขที่เอกสารและจัดเก็บไฟล์ PDF

| ชื่อคอลัมน์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraint | คำอธิบาย | 
| ----- | ----- | ----- | ----- | 
| `certificate_id` | `UUID` | `PK` | รหัสใบอนุโมทนาบัตร | 
| `donation_id` | `UUID` | `FK -> donations, UNIQUE` | เชื่อมกับรายการบริจาค (1 รายการบริจาคมีใบอนุโมทนาบัตรที่ใช้งานได้ 1 ใบ) | 
| `fiscal_year_be` | `SMALLINT` | `NOT NULL` | ปีงบประมาณ พ.ศ. เช่น `2569` | 
| `running_seq` | `INT` | `NOT NULL` | เลขลำดับเอกสารในปีงบประมาณนั้น เช่น `1`, `2`, `3` | 
| `document_no` | `VARCHAR(30)` | `UNIQUE, NOT NULL` | เลขที่ใบอนุโมทนาบัตรฉบับเต็ม เช่น `MEDUP-69/0001` | 
| `pdf_file_path` | `VARCHAR(500)` | `NULL` | พาธเก็บไฟล์ PDF ของใบอนุโมทนาบัตรที่สร้างเสร็จแล้ว | 
| `email_sent_status` | `VARCHAR(20)` | `DEFAULT 'PENDING'` | สถานะการส่งอีเมล (`PENDING`, `SENT`, `FAILED`) | 
| `email_sent_at` | `TIMESTAMPTZ` | `NULL` | วันเวลาที่ส่งไฟล์ PDF ไปยังอีเมลผู้บริจาคสำเร็จ | 
| `issued_by` | `INT` | `FK -> admin_users` | เจ้าหน้าที่ผู้อนุมัติออกเอกสาร | 
| `issued_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่ออกเลขที่เอกสาร | 

### 2.4 ตาราง `edonation_export_batches` และ `edonation_export_items` (การส่งออกไฟล์ Excel สำหรับพี่บอม)

ออกแบบมาเพื่อรองรับขั้นตอน *"ถามข้อมูลที่พี่บอมต้องการ เพื่อจัดทำ e-Donation ขอเป็นดาวโหลด Excel"* โดยบันทึกว่าดึงข้อมูลรอบวันที่เท่าไรไปแล้วบ้าง

| ตาราง | ชื่อคอลัมน์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraint | คำอธิบาย | 
| ----- | ----- | ----- | ----- | ----- | 
| `edonation_export_batches` | `batch_id` | `SERIAL / INT` | `PK` | รหัสรอบการส่งออกไฟล์ Excel | 
| `edonation_export_batches` | `batch_no` | `VARCHAR(30)` | `UNIQUE, NOT NULL` | เลขที่ชุดข้อมูล เช่น `EXP-202610-01` | 
| `edonation_export_batches` | `date_from` | `DATE` | `NOT NULL` | วันเริ่มต้นของข้อมูลที่ดึง | 
| `edonation_export_batches` | `date_to` | `DATE` | `NOT NULL` | วันสิ้นสุดของข้อมูลที่ดึง | 
| `edonation_export_batches` | `total_records` | `INT` | `NOT NULL` | จำนวนรายการบริจาคในไฟล์ Excel รอบนั้น | 
| `edonation_export_batches` | `total_amount` | `NUMERIC(14,2)` | `NOT NULL` | ยอดเงินบริจาครวมในไฟล์ Excel รอบนั้น | 
| `edonation_export_batches` | `exported_by` | `INT` | `FK -> admin_users` | เจ้าหน้าที่ผู้กดดาวน์โหลดไฟล์ Excel (เช่น พี่บอม) | 
| `edonation_export_batches` | `exported_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่ดาวน์โหลดไฟล์ Excel | 
| `edonation_export_items` | `item_id` | `BIGSERIAL` | `PK` | รหัสลำดับรายการในชุดส่งออก | 
| `edonation_export_items` | `batch_id` | `INT` | `FK -> edonation_export_batches` | เชื่อมไปยังรอบการส่งออกไฟล์ | 
| `edonation_export_items` | `donation_id` | `UUID` | `FK -> donations` | เชื่อมไปยังรายการบริจาคที่ถูกดึงลงไฟล์ Excel | 

### 2.5 ตาราง `contact_inquiries` (แจ้งเรื่องติดต่อเจ้าหน้าที่ / ติดตามผลเกิน 2 สัปดาห์)

รองรับเงื่อนไข *"จะได้รับ e-Donation ภายใน 2 สัปดาห์ หากไม่ได้รับติดต่อเจ้าหน้าที่"*

| ชื่อคอลัมน์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraint | คำอธิบาย | 
| ----- | ----- | ----- | ----- | 
| `inquiry_id` | `BIGSERIAL` | `PK` | รหัสเรื่องติดต่อ | 
| `reference_no` | `VARCHAR(30)` | `NULL` | เลขอ้างอิงการบริจาคที่ผู้ติดต่อแจ้ง (ถ้ามี) | 
| `inquirer_name` | `VARCHAR(255)` | `NOT NULL` | ชื่อ-นามสกุลผู้ติดต่อ | 
| `contact_info` | `VARCHAR(255)` | `NOT NULL` | เบอร์โทรศัพท์หรืออีเมลสำหรับติดต่อกลับ | 
| `inquiry_type` | `VARCHAR(50)` | `DEFAULT 'FOLLOW_UP_EDONATION'` | ประเภทเรื่อง (`FOLLOW_UP_EDONATION`, `EDIT_RECEIPT`, `GENERAL`) | 
| `message` | `TEXT` | `NOT NULL` | รายละเอียดข้อความที่แจ้งเจ้าหน้าที่ | 
| `status` | `VARCHAR(20)` | `DEFAULT 'OPEN'` | สถานะการดูแล (`OPEN`, `IN_PROGRESS`, `RESOLVED`) | 
| `resolved_by` | `INT` | `FK -> admin_users, NULL` | เจ้าหน้าที่ผู้ดำเนินการแก้ไข | 
| `resolved_note` | `TEXT` | `NULL` | บันทึกผลการตรวจสอบและแจ้งกลับผู้บริจาค | 
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่ผู้บริจาคส่งข้อความ | 
| `resolved_at` | `TIMESTAMPTZ` | `NULL` | วันเวลาที่ปิดเรื่อง | 

### 2.6 ตาราง `admin_users` และ `audit_logs` (ผู้ดูแลระบบและประวัติการใช้งาน)

| ตาราง | ชื่อคอลัมน์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraint | คำอธิบาย | 
| ----- | ----- | ----- | ----- | ----- | 
| `admin_users` | `user_id` | `SERIAL / INT` | `PK` | รหัสเจ้าหน้าที่ | 
| `admin_users` | `username` | `VARCHAR(100)` | `UNIQUE, NOT NULL` | ชื่อบัญชีผู้ใช้ (หรือผูกกับ UP SSO ของมหาวิทยาลัยพะเยา) | 
| `admin_users` | `full_name` | `VARCHAR(255)` | `NOT NULL` | ชื่อ-นามสกุลเจ้าหน้าที่ | 
| `admin_users` | `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL` | อีเมลมหาวิทยาลัย (`@up.ac.th`) | 
| `admin_users` | `role` | `VARCHAR(30)` | `NOT NULL` | บทบาท (`ADMIN`, `FINANCE_OFFICER`, `VIEWER`) | 
| `admin_users` | `is_active` | `BOOLEAN` | `DEFAULT TRUE` | สถานะสิทธิ์การเข้าใช้งาน | 
| `audit_logs` | `log_id` | `BIGSERIAL` | `PK` | รหัสบันทึกประวัติ (Audit Trail) | 
| `audit_logs` | `user_id` | `INT` | `FK -> admin_users, NULL` | เจ้าหน้าที่ผู้ทำรายการ | 
| `audit_logs` | `action` | `VARCHAR(50)` | `NOT NULL` | กิจกรรม เช่น `APPROVE_SLIP`, `ISSUE_PDF`, `EXPORT_EXCEL_EDONATION` | 
| `audit_logs` | `target_table` | `VARCHAR(50)` | `NOT NULL` | ชื่อตารางที่ถูกกระทำ | 
| `audit_logs` | `target_id` | `VARCHAR(64)` | `NOT NULL` | รหัสข้อมูลที่ถูกกระทำ | 
| `audit_logs` | `details` | `JSONB` | `NULL` | รายละเอียดข้อมูลก่อน-หลังการแก้ไข หรือเงื่อนไขการดึงไฟล์ Excel | 
| `audit_logs` | `ip_address` | `VARCHAR(45)` | `NULL` | หมายเลข IP ของเครื่องที่ทำรายการ | 
| `audit_logs` | `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่เกิดรายการ | 

### 2.7 ตาราง `landing_page_configs`, `landing_carousel_slides` และ `pr_news_articles` (สำหรับ Admin ปรับหน้าประชาสัมพันธ์, สไลด์ Carousel และข่าวสารกองทุน)

รองรับการให้ผู้ดูแลระบบ (Admin) ปรับเปลี่ยนข้อความแบนเนอร์ รูปภาพหน้าแรก ข้อความประกาศแจ้งเตือน และเพิ่ม/ซ่อนข่าวสารประชาสัมพันธ์ของกองทุนได้โดยไม่ต้องแก้ไขโค้ดโปรแกรม

| ตาราง | ชื่อคอลัมน์ (Field) | ชนิดข้อมูล (Data Type) | Key / Constraint | คำอธิบาย | 
| ----- | ----- | ----- | ----- | ----- | 
| `landing_page_configs` | `config_id` | `SERIAL / INT` | `PK` | รหัสชุดการตั้งค่าหน้าแรกประชาสัมพันธ์ | 
| `landing_page_configs` | `hero_badge_text` | `VARCHAR(255)` | `NOT NULL` | ข้อความป้ายกำกับด้านบน เช่น `กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา` | 
| `landing_page_configs` | `hero_title_line1` | `VARCHAR(255)` | `NOT NULL` | พาดหัวหลักบรรทัดที่ 1 เช่น `ให้โอกาสทางการศึกษา` | 
| `landing_page_configs` | `hero_title_line2` | `VARCHAR(255)` | `NOT NULL` | พาดหัวเน้นสีบรรทัดที่ 2 เช่น `สร้างอนาคตทางการแพทย์` | 
| `landing_page_configs` | `hero_description` | `TEXT` | `NOT NULL` | คำโปรยอธิบายความสำคัญของทุนการศึกษาบนแบนเนอร์หน้าแรก | 
| `landing_page_configs` | `hero_image_path` | `VARCHAR(500)` | `NOT NULL` | พาธไฟล์รูปภาพแบนเนอร์หลักบนหน้าแรก | 
| `landing_page_configs` | `hero_image_caption` | `VARCHAR(255)` | `NULL` | คำบรรยายใต้ภาพแบนเนอร์หลัก | 
| `landing_page_configs` | `top_announcement_text` | `TEXT` | `NOT NULL` | ข้อความแถบประกาศด้านบนสุด (เช่น แจ้งระยะเวลาได้รับ e-Donation ภายใน 2 สัปดาห์) | 
| `landing_page_configs` | `show_total_raised` | `BOOLEAN` | `DEFAULT TRUE` | เปิด/ปิดการแสดงผลยอดบริจาคสะสมบนหน้าแรก | 
| `landing_page_configs` | `updated_by` | `INT` | `FK -> admin_users, NULL` | เจ้าหน้าที่ Admin ผู้แก้ไขหน้าประชาสัมพันธ์ล่าสุด | 
| `landing_page_configs` | `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่บันทึกการแก้ไขหน้าแรกล่าสุด | 
| `landing_carousel_slides` | `slide_id` | `SERIAL / INT` | `PK` | รหัสสไลด์ Carousel บนหน้าแรก | 
| `landing_carousel_slides` | `display_order` | `INT` | `NOT NULL, DEFAULT 1` | ลำดับการแสดงผลสไลด์ (1, 2, 3...) สำหรับให้ Admin เลื่อนขึ้น/ลง | 
| `landing_carousel_slides` | `badge_tag` | `VARCHAR(150)` | `NOT NULL` | ป้ายกำกับมุมบนของสไลด์ เช่น `ภารกิจการผลิตบัณฑิตแพทย์` | 
| `landing_carousel_slides` | `slide_subtitle` | `VARCHAR(255)` | `NOT NULL` | หัวข้อย่อยของสไลด์ | 
| `landing_carousel_slides` | `slide_caption` | `TEXT` | `NOT NULL` | ข้อความคำบรรยายหลักที่แสดงบนภาพสไลด์ | 
| `landing_carousel_slides` | `image_path` | `VARCHAR(500)` | `NOT NULL` | พาธไฟล์รูปภาพของสไลด์ Carousel | 
| `landing_carousel_slides` | `cta_url` | `VARCHAR(500)` | `NULL` | ลิงก์ปลายทางเมื่อคลิกสไลด์ (ถ้ามี) | 
| `landing_carousel_slides` | `is_active` | `BOOLEAN` | `DEFAULT TRUE` | สถานะการแสดงผล (`TRUE` = แสดงใน Carousel, `FALSE` = ซ่อนไว้) | 
| `landing_carousel_slides` | `updated_by` | `INT` | `FK -> admin_users, NULL` | เจ้าหน้าที่ Admin ผู้แก้ไขสไลด์ล่าสุด | 
| `landing_carousel_slides` | `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่แก้ไขสไลด์ล่าสุด | 
| `pr_news_articles` | `article_id` | `SERIAL / INT` | `PK` | รหัสข่าวประชาสัมพันธ์ | 
| `pr_news_articles` | `title` | `VARCHAR(255)` | `NOT NULL` | หัวข้อข่าวสารหรือกิจกรรมกองทุนทุนการศึกษา | 
| `pr_news_articles` | `category` | `VARCHAR(100)` | `NOT NULL` | หมวดหมู่ เช่น `ข่าวประชาสัมพันธ์`, `พิธีมอบทุนการศึกษา`, `รายงานผลการจัดสรรทุน` | 
| `pr_news_articles` | `summary` | `TEXT` | `NOT NULL` | เนื้อหาย่อที่แสดงในการ์ดข่าวบนหน้าแรก | 
| `pr_news_articles` | `content_html` | `TEXT` | `NULL` | เนื้อหาข่าวฉบับเต็มและรายละเอียดกิจกรรม | 
| `pr_news_articles` | `cover_image_path` | `VARCHAR(500)` | `NULL` | พาธรูปภาพหน้าปกข่าวประชาสัมพันธ์ | 
| `pr_news_articles` | `published_date` | `DATE` | `DEFAULT CURRENT_DATE` | วันที่เผยแพร่ข่าวสาร | 
| `pr_news_articles` | `is_published` | `BOOLEAN` | `DEFAULT TRUE` | สถานะการแสดงผลบนหน้าแรก (`TRUE` = แสดงผล, `FALSE` = ซ่อนไว้) | 
| `pr_news_articles` | `is_pinned` | `BOOLEAN` | `DEFAULT FALSE` | ปักหมุดข่าวสำคัญไว้ลำดับแรก | 
| `pr_news_articles` | `created_by` | `INT` | `FK -> admin_users, NULL` | เจ้าหน้าที่ผู้สร้างข่าวประชาสัมพันธ์ | 
| `pr_news_articles` | `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | วันเวลาที่แก้ไขข่าวล่าสุด | 

## 3. สคริปต์สร้างฐานข้อมูล (SQL DDL สำหรับ PostgreSQL)

สามารถนำสคริปต์ SQL ด้านล่างไปรันเพื่อสร้างตาราง ดัชนี (Indexes) และ View สำหรับส่งออกไฟล์ Excel ได้ทันที:

```
-- เปิดใช้งาน Extension สำหรับสร้าง UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ตารางวัตถุประสงค์การบริจาค (scholarship_funds)
CREATE TABLE scholarship_funds (
    fund_id SERIAL PRIMARY KEY,
    fund_code VARCHAR(50) UNIQUE NOT NULL,
    fund_name_th VARCHAR(255) NOT NULL,
    fund_description TEXT,
    requires_student_name BOOLEAN NOT NULL DEFAULT FALSE,
    bank_name VARCHAR(100) NOT NULL DEFAULT 'ธนาคารกรุงไทย',
    bank_account_no VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ข้อมูลตั้งต้น 2 วัตถุประสงค์ตามเอกสาร Workflow
INSERT INTO scholarship_funds (fund_code, fund_name_th, fund_description, requires_student_name, bank_account_no)
VALUES
('GENERAL_SCHOLARSHIP', 'ทุนการศึกษาสำหรับนิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ (คณะจัดสรรให้กับนิสิต)', 'คณะแพทยศาสตร์ดำเนินการคัดเลือกและจัดสรรทุนให้แก่นิสิตแพทย์ที่ขาดแคลนทุนทรัพย์', FALSE, '512-0-XXXXX-X'),
('SPECIFIC_STUDENT', 'ทุนการศึกษาสำหรับนิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ (ระบุชื่อนิสิตผู้รับทุน)', 'ผู้บริจาคระบุรายชื่อนิสิตแพทย์ผู้รับทุนการศึกษาโดยตรง', TRUE, '512-0-XXXXX-X');

-- 2. ตารางผู้ดูแลระบบหลังบ้าน (admin_users)
CREATE TABLE admin_users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN', 'FINANCE_OFFICER', 'VIEWER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ตารางธุรกรรมการบริจาค (donations)
CREATE TABLE donations (
    donation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no VARCHAR(30) UNIQUE NOT NULL,
    fund_id INT NOT NULL REFERENCES scholarship_funds(fund_id),
    student_recipient_name VARCHAR(255),
    student_recipient_code VARCHAR(20),
    donor_type VARCHAR(20) NOT NULL CHECK (donor_type IN ('INDIVIDUAL', 'CORPORATE')),
    donor_prefix VARCHAR(50) NOT NULL,
    donor_name VARCHAR(255) NOT NULL,
    tax_id_encrypted TEXT NOT NULL,
    tax_id_masked VARCHAR(20) NOT NULL,
    tax_id_hash CHAR(64) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255) NOT NULL,
    need_tax_deduction BOOLEAN NOT NULL DEFAULT TRUE,
    pdpa_consent BOOLEAN NOT NULL DEFAULT TRUE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transfer_date DATE NOT NULL,
    transfer_time TIME NOT NULL,
    slip_file_path VARCHAR(500) NOT NULL,
    slip_file_hash CHAR(64),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_SLIP_CHECK'
        CHECK (verification_status IN ('PENDING_SLIP_CHECK', 'WAITING_TREASURY_RD', 'COMPLETED_RD', 'REJECTED')),
    slip_verified_by INT REFERENCES admin_users(user_id),
    slip_verified_at TIMESTAMPTZ,
    rd_submitted_by INT REFERENCES admin_users(user_id),
    rd_submitted_at TIMESTAMPTZ,
    rd_confirm_email_sent_at TIMESTAMPTZ,
    rejection_reason TEXT,
    edonation_sla_due_date DATE GENERATED ALWAYS AS (transfer_date + INTERVAL '14 days') STORED,
    edonation_export_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (edonation_export_status IN ('PENDING', 'EXPORTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- เงื่อนไขบังคับ: หากเลือกทุนแบบระบุชื่อนิสิต (fund_id = 2) ต้องมีค่า student_recipient_name
    CONSTRAINT chk_student_recipient_when_specific
        CHECK (fund_id <> 2 OR (student_recipient_name IS NOT NULL AND length(trim(student_recipient_name)) > 0))
);

CREATE INDEX idx_donations_verification_status ON donations(verification_status);
CREATE INDEX idx_donations_transfer_date ON donations(transfer_date);
CREATE INDEX idx_donations_tax_id_hash ON donations(tax_id_hash);
CREATE INDEX idx_donations_edonation_export ON donations(edonation_export_status, verification_status);

-- 4. ตารางใบอนุโมทนาบัตรอิเล็กทรอนิกส์ (acknowledgement_certificates)
CREATE TABLE acknowledgement_certificates (
    certificate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID UNIQUE NOT NULL REFERENCES donations(donation_id) ON DELETE RESTRICT,
    fiscal_year_be SMALLINT NOT NULL,
    running_seq INT NOT NULL,
    document_no VARCHAR(30) UNIQUE NOT NULL,
    pdf_file_path VARCHAR(500),
    email_sent_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (email_sent_status IN ('PENDING', 'SENT', 'FAILED')),
    email_sent_at TIMESTAMPTZ,
    issued_by INT NOT NULL REFERENCES admin_users(user_id),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (fiscal_year_be, running_seq)
);

-- 5. ตารางรอบการส่งออกไฟล์ Excel สำหรับพี่บอม (edonation_export_batches & items)
CREATE TABLE edonation_export_batches (
    batch_id SERIAL PRIMARY KEY,
    batch_no VARCHAR(30) UNIQUE NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    total_records INT NOT NULL DEFAULT 0,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    exported_by INT NOT NULL REFERENCES admin_users(user_id),
    exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks TEXT
);

CREATE TABLE edonation_export_items (
    item_id BIGSERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES edonation_export_batches(batch_id) ON DELETE CASCADE,
    donation_id UUID NOT NULL REFERENCES donations(donation_id) ON DELETE RESTRICT,
    UNIQUE (batch_id, donation_id)
);

-- 6. ตารางแจ้งปัญหาและติดตามผล e-Donation เกิน 2 สัปดาห์ (contact_inquiries)
CREATE TABLE contact_inquiries (
    inquiry_id BIGSERIAL PRIMARY KEY,
    reference_no VARCHAR(30),
    inquirer_name VARCHAR(255) NOT NULL,
    contact_info VARCHAR(255) NOT NULL,
    inquiry_type VARCHAR(50) NOT NULL DEFAULT 'FOLLOW_UP_EDONATION',
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
    resolved_by INT REFERENCES admin_users(user_id),
    resolved_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 7. ตารางบันทึกประวัติการใช้งานหลังบ้าน (audit_logs)
CREATE TABLE audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES admin_users(user_id),
    action VARCHAR(50) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ตารางตั้งค่าหน้าแรกประชาสัมพันธ์กองทุน (landing_page_configs) สำหรับ Admin ปรับหน้าเว็บ
CREATE TABLE landing_page_configs (
    config_id SERIAL PRIMARY KEY,
    hero_badge_text VARCHAR(255) NOT NULL DEFAULT '🎓 กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา',
    hero_title_line1 VARCHAR(255) NOT NULL DEFAULT 'ให้โอกาสทางการศึกษา',
    hero_title_line2 VARCHAR(255) NOT NULL DEFAULT 'สร้างอนาคตทางการแพทย์',
    hero_description TEXT NOT NULL,
    hero_image_path VARCHAR(500) NOT NULL,
    hero_image_caption VARCHAR(255),
    top_announcement_text TEXT NOT NULL,
    show_total_raised BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by INT REFERENCES admin_users(user_id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ตารางข่าวสารและกิจกรรมประชาสัมพันธ์กองทุน (pr_news_articles)
CREATE TABLE pr_news_articles (
    article_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'ข่าวประชาสัมพันธ์',
    summary TEXT NOT NULL,
    content_html TEXT,
    cover_image_path VARCHAR(500),
    published_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT REFERENCES admin_users(user_id),
    updated_by INT REFERENCES admin_users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pr_news_published ON pr_news_articles(is_published, is_pinned DESC, published_date DESC);

-- 10. ตารางสไลด์แบนเนอร์บนหน้าแรก (landing_carousel_slides) สำหรับ Admin จัดการ Carousel
CREATE TABLE landing_carousel_slides (
    slide_id SERIAL PRIMARY KEY,
    display_order INT NOT NULL DEFAULT 1,
    badge_tag VARCHAR(150) NOT NULL,
    slide_subtitle VARCHAR(255) NOT NULL,
    slide_caption TEXT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    cta_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by INT REFERENCES admin_users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carousel_active_order ON landing_carousel_slides(is_active, display_order ASC);

-- 11. ตารางแจ้งเตือนเจ้าหน้าที่ Admin เมื่อมีผู้บริจาคแนบสลิปใหม่ (admin_notifications)
CREATE TABLE admin_notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    donation_id UUID NOT NULL REFERENCES donations(donation_id) ON DELETE CASCADE,
    notify_type VARCHAR(50) NOT NULL DEFAULT 'NEW_SLIP_UPLOADED',
    title VARCHAR(255) NOT NULL,
    channel_sent VARCHAR(50) NOT NULL DEFAULT 'WEB,EMAIL',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_by INT REFERENCES admin_users(user_id),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_notifications_unread ON admin_notifications(is_read, created_at DESC);



```

## 4. คำสั่ง SQL View สำหรับดึงไฟล์ Excel ส่งให้ "พี่บอม" (e-Donation Export Query)

เพื่อให้ปุ่ม **"ดาวน์โหลด Excel สำหรับทำ e-Donation"** ในหน้า Admin Dashboard ดึงข้อมูลได้ครบถ้วนและตรงตามรูปแบบที่ฝ่ายการเงินต้องการ สามารถสร้าง Database View ดังนี้:

```
CREATE OR REPLACE VIEW vw_edonation_excel_export AS
SELECT
    d.reference_no AS "เลขอ้างอิงธุรกรรม",
    COALESCE(c.document_no, 'รอออกเลขที่') AS "เลขที่ใบอนุโมทนาบัตร",
    TO_CHAR(d.transfer_date, 'DD/MM/YYYY') AS "วันที่โอน",
    TO_CHAR(d.transfer_time, 'HH24:MI') AS "เวลาที่โอน",
    CASE
        WHEN d.donor_type = 'INDIVIDUAL' THEN 'บุคคลธรรมดา'
        ELSE 'นิติบุคคล'
    END AS "ประเภทผู้บริจาค",
    -- ถอดรหัสเลขผู้เสียภาษีเฉพาะตอนที่เจ้าหน้าที่สิทธิ์ FINANCE_OFFICER สั่ง Export Excel
    d.tax_id_encrypted AS "เลขประจำตัวผู้เสียภาษี_13_หลัก",
    d.donor_prefix AS "คำนำหน้า",
    d.donor_name AS "ชื่อ_นามสกุล_หรือชื่อนิติบุคคล",
    d.amount AS "จำนวนเงินบริจาค",
    f.fund_name_th AS "วัตถุประสงค์การบริจาค",
    COALESCE(d.student_recipient_name, '-') AS "ชื่อนิสิตแพทย์ผู้รับทุน",
    d.phone AS "เบอร์โทรศัพท์",
    d.email AS "อีเมลผู้บริจาค",
    d.edonation_sla_due_date AS "วันครบกำหนด_2_สัปดาห์",
    d.verification_status AS "สถานะตรวจสอบสลิป",
    d.edonation_export_status AS "สถานะส่งออก_Excel"
FROM donations d
JOIN scholarship_funds f ON d.fund_id = f.fund_id
LEFT JOIN acknowledgement_certificates c ON d.donation_id = c.donation_id
WHERE d.verification_status = 'APPROVED'
  AND d.need_tax_deduction = TRUE
ORDER BY d.transfer_date ASC, d.transfer_time ASC;



```

## 5. แนวทางเสริมด้านความปลอดภัยและการจัดการข้อมูล

* **การป้องกันการแนบสลิปโอนเงินซ้ำ (Duplicate Slip Detection):** เมื่อผู้บริจาคอัปโหลดไฟล์ภาพสลิป ระบบจะคำนวณค่า `SHA-256` เก็บลงคอลัมน์ `slip_file_hash` และตรวจสอบร่วมกับ `transfer_date`, `transfer_time` และ `amount` หากพบข้อมูลตรงกันกับรายการที่มีอยู่แล้ว ระบบจะแจ้งเตือนให้เจ้าหน้าที่ตรวจสอบเป็นพิเศษ

* **การติดตามกรอบเวลา 2 สัปดาห์ (14-Day SLA Tracking):** คอลัมน์ `edonation_sla_due_date` คำนวณวันครบกำหนด 14 วันนับจากวันที่โอนเงินโดยอัตโนมัติ ช่วยให้หน้า Admin Dashboard แสดงแถบแจ้งเตือนรายการที่ใกล้ครบกำหนด 2 สัปดาห์แต่ยังไม่ถูกดึงไฟล์ Excel ส่งให้พี่บอมได้ทันที

* **การคุ้มครองข้อมูลส่วนบุคคล (PDPA):** เลขประจำตัวผู้เสียภาษี 13 หลักจะถูกเข้ารหัสในคอลัมน์ `tax_id_encrypted` และแสดงผลบนหน้าจอทั่วไปผ่าน `tax_id_masked` เท่านั้น โดยการกดดาวน์โหลดไฟล์ Excel ที่มีเลข 13 หลักครบถ้วนจะถูกบันทึกผู้ใช้งานและเวลาลงในตาราง `audit_logs` ทุกครั้ง