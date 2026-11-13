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

## ตรวจสอบ

```sh
npm run lint
npm test
npm run test:e2e
npm run build
```

Browser tests ใช้ Google Chrome ในเครื่องและเปิด dev server ที่ port 3120 ต้องมีฐานข้อมูลพัฒนาที่ migration แล้ว Tests สร้างบัญชีชั่วคราวและลบเมื่อจบ ให้ใช้ `DATABASE_URL` ของฐานข้อมูลพัฒนาสำหรับการทดสอบ

`npm run build` สร้าง Prisma Client ก่อน build อัตโนมัติ สำหรับ production รัน `npm run db:deploy` เป็นขั้นตอนแยกก่อนเปิดแอป แล้วใช้ `npm run start`
