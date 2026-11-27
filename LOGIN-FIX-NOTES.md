# แก้ไขการเข้าสู่ระบบไม่ได้ (26 พ.ย. 2026)

## อาการ

หน้า `/login` แสดงข้อความ "ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองอีกครั้ง" ซึ่งเป็นข้อความจาก `catch` ใน `app/login/actions.ts` แปลว่า `authenticateAdmin()` โยน exception ไม่ใช่รหัสผ่านผิด

## สาเหตุ

MySQL 9.7 ใช้ authentication plugin `caching_sha2_password` และการเชื่อมต่อไม่ได้เปิด TLS ตัวขับ `mariadb` จึงต้องดึง RSA public key จากเซิร์ฟเวอร์เพื่อเข้ารหัสรหัสผ่าน แต่ `lib/database.ts` ไม่ได้เปิด `allowPublicKeyRetrieval` ทำให้เชื่อมต่อล้มเหลวด้วย error:

```
ER_CANNOT_RETRIEVE_RSA_KEY: RSA public key is not available client side
```

## การแก้ไข

เพิ่ม `allowPublicKeyRetrieval: true` ใน options ของ `PrismaMariaDb` ที่ `lib/database.ts`

## ตรวจสอบแล้ว

- เชื่อมต่อฐานข้อมูลและอ่านบัญชี `admin_users` ได้
- `npm test` ผ่าน 18 tests
- e2e `tests/e2e/auth.spec.ts` ผ่านทั้ง 7 tests (รันกับ dev server ที่มีอยู่)
- `npx eslint lib/database.ts` ผ่าน

## Prisma client เก่า (แก้แล้ว)

`generated/prisma` ถูก generate ไว้เมื่อ 13 พ.ย. ก่อน schema จะมี `payment_settings`, `scholarship_students`, `certificate_settings` ทำให้ `/admin/settings` โยน `Cannot read properties of undefined (reading 'findUnique')` ที่ `prisma.paymentSetting`

รัน `npm run db:generate` ใหม่แล้ว และตรวจสอบ:

- `npx tsc --noEmit` ผ่าน
- เข้าสู่ระบบด้วยบัญชีชั่วคราวแล้วเปิดหน้า `/admin/settings` ได้ตามปกติ

## หมายเหตุ

- รหัสผ่าน `BOOTSTRAP_ADMIN_PASSWORD` ใน `.env` (`12345678`) ไม่ตรงกับ hash ของบัญชีที่มีอยู่ เพราะ seed ไม่เขียนทับบัญชีเดิม หากต้องการตั้งรหัสใหม่ให้ใช้ `npm run admin:reset-password -- anantrakul.so@up.ac.th`
- `allowPublicKeyRetrieval` จำเป็นเมื่อไม่มี TLS ใน production ควรเชื่อมต่อ MySQL ผ่าน TLS เพื่อไม่ต้องพึ่งการดึง public key
