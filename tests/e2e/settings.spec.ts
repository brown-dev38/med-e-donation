import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createDatabaseClient } from "../../lib/database";
import { confirmModal, expectToast } from "./ui";
import { hashPassword } from "../../lib/password";

const password = randomBytes(24).toString("hex");
const STUDENT = `นายทดสอบ อีทูอี${randomBytes(3).toString("hex")}`;

let prisma: ReturnType<typeof createDatabaseClient>;
let userId: number;
let email: string;
let fundId: number;
let fundCode: string;
let savedSettings: Awaited<ReturnType<typeof prisma.certificateSetting.findUnique>> = null;
let savedPayment: Awaited<ReturnType<typeof prisma.paymentSetting.findUnique>> = null;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมลผู้ดูแลระบบ").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test.beforeAll(async () => {
  prisma = createDatabaseClient();
  const suffix = randomBytes(6).toString("hex");
  email = `settings-test-${suffix}@example.test`;
  userId = (await prisma.adminUser.create({ data: { username: `settings-test-${suffix}`, email, fullName: "ผู้ตั้งค่าทดสอบ", passwordHash: await hashPassword(password), role: "ADMIN" } })).userId;
  fundCode = `E2E_SETTINGS_${suffix.toUpperCase()}`;
  fundId = (await prisma.scholarshipFund.create({ data: { fundCode, fundNameTh: "ทุนทดสอบการตั้งค่า", requiresStudentName: true, bankAccountNo: "ยังไม่ได้ตั้งค่า", isActive: false } })).fundId;
  savedSettings = await prisma.certificateSetting.findUnique({ where: { settingId: 1 } });
  savedPayment = await prisma.paymentSetting.findUnique({ where: { settingId: 1 } });
});

test.afterAll(async () => {
  await prisma.scholarshipStudent.deleteMany({ where: { fullName: STUDENT } });
  await prisma.scholarshipFund.delete({ where: { fundId } });
  // Put the certificate settings back the way they were.
  if (savedSettings) await prisma.certificateSetting.update({ where: { settingId: 1 }, data: { ...savedSettings, updatedBy: null } });
  else await prisma.certificateSetting.deleteMany({ where: { settingId: 1 } });
  // ...and the shared payment account, and any purpose the test created but did not delete.
  if (savedPayment) await prisma.paymentSetting.update({ where: { settingId: 1 }, data: savedPayment });
  else await prisma.paymentSetting.deleteMany({ where: { settingId: 1 } });
  await prisma.scholarshipFund.deleteMany({ where: { fundCode: { startsWith: "E2E_NEW_" }, donations: { none: {} } } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.adminSession.deleteMany({ where: { userId } });
  await prisma.adminUser.delete({ where: { userId } });
  await prisma.$disconnect();
});

test("fund settings open the fund with a PromptPay QR that carries the amount", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "กองทุนและการชำระเงิน" }).click();
  const form = page.locator("form", { has: page.getByRole("heading", { name: fundCode }) });
  await form.getByLabel("บัญชีแยกของวัตถุประสงค์นี้").check();
  await form.getByLabel("เปิดรับบริจาควัตถุประสงค์นี้").check();
  await form.getByRole("button", { name: "บันทึก" }).click();
  await expectToast(page, "ต้องกรอกเลขที่บัญชีจริง");

  await form.getByLabel("เลขที่บัญชี", { exact: true }).fill("512-0-12345-6");
  await form.getByLabel("ชื่อบัญชี", { exact: true }).fill("กองทุนทดสอบ อีทูอี");
  await form.getByLabel(/^QR พร้อมเพย์/).check();
  await form.getByLabel("พร้อมเพย์", { exact: true }).fill("0994000165552");
  await expect(form.getByRole("img", { name: /QR พร้อมเพย์/ })).toBeVisible();
  await form.getByRole("button", { name: "บันทึก" }).click();
  await expectToast(page, "บันทึกแล้ว กองทุนนี้เปิดรับบริจาค");
  const fund = await prisma.scholarshipFund.findUniqueOrThrow({ where: { fundId } });
  expect(fund).toMatchObject({ isActive: true, paymentMode: "OWN", qrType: "PROMPTPAY", bankAccountNo: "512-0-12345-6", promptpayId: "0994000165552", bankAccountName: "กองทุนทดสอบ อีทูอี" });
  await page.screenshot({ path: "test-results/settings-funds.png", fullPage: true });

  await page.goto(`/?fund=${fundCode}`);
  await page.getByRole("button", { name: "1,000 ฿" }).click();
  await expect(page.getByRole("img", { name: "QR พร้อมเพย์ ยอด 1000.00 บาท" })).toBeVisible();
  await expect(page.getByText("กองทุนทดสอบ อีทูอี")).toBeVisible();
  await page.screenshot({ path: "test-results/donate-qr.png", fullPage: true });
});

test("new purpose on the shared account shows the shared bank-account QR, and can be deleted", async ({ page }) => {
  const newCode = `E2E_NEW_${randomBytes(4).toString("hex").toUpperCase()}`;
  const newName = `ทุนทดสอบใหม่ ${newCode}`;
  await signIn(page);
  await page.goto("/admin/settings");

  // Shared account with a QR built from the bank account number.
  const shared = page.locator("form", { has: page.getByRole("heading", { name: "บัญชีรับเงินรวม" }) });
  await shared.getByLabel("ธนาคาร", { exact: true }).selectOption("006");
  await shared.getByLabel("เลขที่บัญชี", { exact: true }).fill("512-0-12345-6");
  await shared.getByLabel(/^QR จากเลขบัญชีธนาคาร/).check();
  await expect(shared.getByRole("img", { name: "QR เลขบัญชีธนาคาร" })).toBeVisible();
  await shared.getByRole("button", { name: "บันทึกบัญชีรับเงินรวม" }).click();
  await expectToast(page, "บันทึกบัญชีรับเงินรวมแล้ว");

  // Create a purpose; it starts closed and on the shared account.
  await page.getByLabel("ชื่อวัตถุประสงค์", { exact: true }).fill(newName);
  await page.getByLabel("รหัส (ไม่บังคับ)").fill(newCode);
  await page.getByRole("button", { name: "+ เพิ่ม" }).click();
  const card = page.locator("form", { has: page.getByRole("heading", { name: newCode }) });
  await expect(card).toBeVisible();
  await expect(card.getByLabel("ใช้บัญชีรับเงินรวม")).toBeChecked();
  await card.getByLabel("เปิดรับบริจาควัตถุประสงค์นี้").check();
  await card.getByRole("button", { name: "บันทึก" }).click();
  await expectToast(page, "บันทึกแล้ว กองทุนนี้เปิดรับบริจาค");
  await page.screenshot({ path: "test-results/settings-shared.png", fullPage: true });

  await page.goto(`/?fund=${newCode}`);
  await page.getByRole("button", { name: "500 ฿" }).click();
  await expect(page.getByRole("img", { name: "QR เลขบัญชีธนาคาร ยอด 500.00 บาท" })).toBeVisible();
  await expect(page.getByText("512-0-12345-6")).toBeVisible();

  // A purpose with no donations can be deleted.
  await page.goto("/admin/settings");
  await page.locator(".admin-settings-card", { has: page.getByRole("heading", { name: newCode }) }).getByRole("button", { name: "ลบวัตถุประสงค์นี้" }).click();
  await confirmModal(page, "ลบ");
  await expectToast(page, "ลบวัตถุประสงค์แล้ว");
  await expect(page.getByRole("heading", { name: newCode })).toHaveCount(0);
  expect(await prisma.scholarshipFund.count({ where: { fundCode: newCode } })).toBe(0);
});

test("students added in settings become the donor's recipient choices", async ({ page }) => {
  await prisma.scholarshipFund.update({ where: { fundId }, data: { isActive: true, bankAccountNo: "512-0-12345-6" } });
  await signIn(page);
  await page.goto("/admin/settings/students");
  await page.getByLabel(/หนึ่งบรรทัดต่อหนึ่งคน/).fill(`${STUDENT}, E2E001, 3`);
  await page.getByRole("button", { name: "เพิ่มรายชื่อ" }).click();
  await expect(page.getByRole("cell", { name: STUDENT, exact: true })).toBeVisible();

  await page.goto(`/?fund=${fundCode}`);
  const select = page.getByLabel("เลือกนิสิตผู้รับทุน");
  await expect(select.locator("option", { hasText: STUDENT })).toHaveCount(1);
});

test("certificate settings change the generated PDF", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/settings/certificate");
  await page.getByLabel("ชื่อผู้ลงนาม").fill("ผู้ทดสอบ ลงนามอีทูอี");
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expectToast(page, "บันทึกการตั้งค่าแล้ว");
  expect((await prisma.certificateSetting.findUniqueOrThrow({ where: { settingId: 1 } })).signerName).toBe("ผู้ทดสอบ ลงนามอีทูอี");

  const preview = await page.request.get("/admin/settings/certificate/preview");
  expect(preview.status()).toBe(200);
  const bytes = await preview.body();
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  await writeFile("test-results/certificate-preview.pdf", bytes);
});

test("settings routes and files require an admin session", async ({ request }) => {
  for (const url of ["/admin/settings/certificate/preview", "/admin/settings/signature"]) {
    expect((await request.get(url)).status()).toBe(401);
  }
});
