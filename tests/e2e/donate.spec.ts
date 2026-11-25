import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createDatabaseClient } from "../../lib/database";

// 1×1 transparent PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const storageRoot = path.resolve(process.env.SLIP_STORAGE_DIR?.trim() || "storage");

let prisma: ReturnType<typeof createDatabaseClient>;
let fundId: number;
let fundCode: string;

function taxIdWithCheckDigit(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i);
  return `${first12}${(11 - (sum % 11)) % 10}`;
}

const bangkokToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

test.beforeAll(() => { prisma = createDatabaseClient(); });

test.beforeEach(async () => {
  fundCode = `E2E_${randomBytes(6).toString("hex").toUpperCase()}`;
  const fund = await prisma.scholarshipFund.create({
    data: { fundCode, fundNameTh: "ทุนทดสอบระบบ (ระบุชื่อนิสิต)", fundDescription: "สร้างโดย e2e test", requiresStudentName: true, bankAccountNo: "999-9-99999-9", isActive: true },
  });
  fundId = fund.fundId;
});

test.afterEach(async () => {
  const donations = await prisma.donation.findMany({ where: { fundId }, select: { donationId: true, slipFilePath: true } });
  for (const donation of donations) await rm(path.join(storageRoot, donation.slipFilePath), { force: true });
  await prisma.adminNotification.deleteMany({ where: { donationId: { in: donations.map((d) => d.donationId) } } });
  await prisma.donation.deleteMany({ where: { fundId } });
  await prisma.scholarshipFund.delete({ where: { fundId } });
});

test.afterAll(() => prisma.$disconnect());

/**
 * The recipient field depends on the database: a dropdown when admins have listed students,
 * a free-text field otherwise. Fills whichever is shown and returns the name that will be saved.
 */
async function chooseStudent(page: Page) {
  const list = page.locator("select#studentRecipientName");
  if (await list.count()) {
    await list.selectOption({ index: 1 });
    return list.inputValue();
  }
  await page.getByLabel("ชื่อ–นามสกุลนิสิตผู้รับทุน").fill("นิสิต ทดสอบ");
  return "นิสิต ทดสอบ";
}

test("donor submits the form with a slip and receives a reference number", async ({ page }) => {
  await page.goto(`/donate?fund=${fundCode}`);
  await expect(page.getByRole("heading", { name: "แบบฟอร์มบริจาคทุนการศึกษา" })).toBeVisible();
  await expect(page.getByText("999-9-99999-9")).toBeVisible();

  // Empty submit shows errors and keeps the donor on the form.
  await page.getByRole("button", { name: "ยืนยันการบริจาค" }).click();
  await expect(page.locator(".donate-alert")).toContainText("กรุณาตรวจสอบข้อมูล");
  await expect(page.locator("#studentRecipientName-error")).toBeVisible();
  await expect(page.locator("#slip-error")).toBeVisible();
  await page.screenshot({ path: "test-results/donate-errors.png", fullPage: true });

  const taxId = taxIdWithCheckDigit("110170023070");
  const studentName = await chooseStudent(page);
  await page.getByRole("button", { name: "1,000 ฿" }).click();
  await expect(page.getByLabel("หรือระบุจำนวนเงินเอง")).toHaveValue("1000");
  await page.getByLabel("คำนำหน้า").selectOption("นาย");
  await page.locator("#donorName").fill("ผู้บริจาค ทดสอบ");
  await page.getByLabel("เลขประจำตัวผู้เสียภาษี").fill(taxId);
  await page.getByLabel("เบอร์โทรศัพท์").fill("081-234-5678");
  await page.getByLabel("อีเมลสำหรับรับใบอนุโมทนาบัตร").fill("donor-e2e@example.test");
  await page.getByLabel("วันที่โอนเงิน").fill(bangkokToday());
  await page.getByLabel("เวลาที่โอนเงิน").fill("00:00");
  await page.locator("#slip").setInputFiles({ name: "slip.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("ตัวอย่างสลิปโอนเงินที่เลือก")).toBeVisible();
  await page.getByLabel(/ข้าพเจ้ายินยอม/).check();
  await expect(page.locator(".donate-alert")).toHaveCount(0);
  await page.screenshot({ path: "test-results/donate-filled.png", fullPage: true });

  await page.getByRole("button", { name: "ยืนยันการบริจาค" }).click();
  await expect(page.getByRole("heading", { name: "ได้รับข้อมูลการบริจาคเรียบร้อยแล้ว" })).toBeVisible({ timeout: 15_000 });
  const reference = (await page.locator(".donate-reference").textContent())!;
  expect(reference).toMatch(/^MEDUP-\d{8}-\d{3,}$/);
  await page.screenshot({ path: "test-results/donate-success.png", fullPage: true });

  const donation = await prisma.donation.findUniqueOrThrow({ where: { referenceNo: reference }, include: { notifications: true } });
  expect(donation.fundId).toBe(fundId);
  expect(donation.studentRecipientName).toBe(studentName);
  expect(donation.amount.toFixed(2)).toBe("1000.00");
  expect(donation.phone).toBe("0812345678");
  expect(donation.taxIdMasked).toBe(`${taxId.slice(0, 5)}xxxx${taxId.slice(-4)}`);
  expect(donation.taxIdEncrypted).not.toContain(taxId);
  expect(donation.verificationStatus).toBe("PENDING_SLIP_CHECK");
  expect(donation.edonationSlaDueDate).not.toBeNull();
  expect(donation.notifications).toHaveLength(1);
  expect(existsSync(path.join(storageRoot, donation.slipFilePath))).toBe(true);
});

test("server rejects a slip whose contents are not an image", async ({ page }) => {
  await page.goto(`/donate?fund=${fundCode}`);
  await chooseStudent(page);
  await page.getByLabel("หรือระบุจำนวนเงินเอง").fill("250");
  await page.getByLabel("คำนำหน้า").selectOption("นาง");
  await page.locator("#donorName").fill("ผู้บริจาค ทดสอบ");
  await page.getByLabel("เลขประจำตัวผู้เสียภาษี").fill(taxIdWithCheckDigit("310050012345"));
  await page.getByLabel("เบอร์โทรศัพท์").fill("0812345678");
  await page.getByLabel("อีเมลสำหรับรับใบอนุโมทนาบัตร").fill("donor-e2e@example.test");
  await page.getByLabel("วันที่โอนเงิน").fill(bangkokToday());
  await page.getByLabel("เวลาที่โอนเงิน").fill("00:00");
  await page.locator("#slip").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not really a png file") });
  await page.getByLabel(/ข้าพเจ้ายินยอม/).check();
  await page.getByRole("button", { name: "ยืนยันการบริจาค" }).click();
  await expect(page.locator("#slip-error")).toContainText("ไม่ใช่ภาพ JPG หรือ PNG");
  expect(await prisma.donation.count({ where: { fundId } })).toBe(0);
});

test("mobile layout has no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/donate?fund=${fundCode}`);
  await expect(page.getByRole("button", { name: "ยืนยันการบริจาค" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/donate-mobile.png", fullPage: true });
});
