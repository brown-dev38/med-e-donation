import "dotenv/config";
import { createDatabaseClient } from "../lib/database";
import { hashPassword } from "../lib/password";

const prisma = createDatabaseClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim() || email?.split("@")[0];
  if (!email || !username || !password || password.length < 8 || password.length > 256) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (8–256 characters) before seeding.");
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.adminUser.upsert({
      where: { email },
      update: {},
      create: { username, email, fullName: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || username, passwordHash, role: "ADMIN" },
    });
    for (const fund of [
      { fundCode: "GENERAL_SCHOLARSHIP", fundNameTh: "ทุนการศึกษาสำหรับนิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ (คณะจัดสรรให้กับนิสิต)", requiresStudentName: false },
      { fundCode: "SPECIFIC_STUDENT", fundNameTh: "ทุนการศึกษาสำหรับนิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ (ระบุชื่อนิสิตผู้รับทุน)", requiresStudentName: true },
    ]) {
      await tx.scholarshipFund.upsert({ where: { fundCode: fund.fundCode }, update: {}, create: { ...fund, bankAccountNo: "ยังไม่ได้ตั้งค่า", isActive: false } });
    }
  });
  console.log("Admin account and two scholarship funds initialized. Existing accounts and fund settings were preserved.");
}

main().catch(() => {
  console.error("Database seed failed. Check the connection and BOOTSTRAP_ADMIN_* variables; existing data has not been reset.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
