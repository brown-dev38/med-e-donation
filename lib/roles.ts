import type { AdminRole } from "@/generated/prisma/enums";

/** Display names for staff roles. ADMIN manages settings and users; EMPLOYEE handles daily donation work. */
export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  EMPLOYEE: "เจ้าหน้าที่",
};

export const ROLES = Object.keys(ROLE_LABELS) as AdminRole[];

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  ADMIN: "ทำได้ทุกอย่าง รวมถึงตั้งค่ากองทุน นิสิต ใบอนุโมทนาบัตร และจัดการผู้ใช้งาน",
  EMPLOYEE: "ตรวจรายการบริจาคและส่งออก Excel e-Donation ไม่เห็นเมนูตั้งค่า",
};
