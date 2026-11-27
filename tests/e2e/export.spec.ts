import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";
import { createDatabaseClient } from "../../lib/database";
import { confirmModal } from "./ui";
import { encryptTaxId, hashTaxId, maskTaxId } from "../../lib/donor-crypto";
import { hashPassword } from "../../lib/password";

const password = randomBytes(24).toString("hex");
// A fixed old transfer date keeps the test's rows apart from real development data.
const DAY = "2020-01-15";
let prisma: ReturnType<typeof createDatabaseClient>;
let userId: number;
let email: string;
let fundId: number;
const donationIds: string[] = [];

function taxIdWithCheckDigit(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i);
  return `${first12}${(11 - (sum % 11)) % 10}`;
}
// Leading zero on purpose: Excel must keep it as text.
const TAX_ID = taxIdWithCheckDigit("010555012345");

async function addDonation(name: string, needTaxDeduction: boolean, taxId: string) {
  const donation = await prisma.donation.create({
    data: {
      referenceNo: `E2E-EXP-${randomBytes(4).toString("hex")}`, fundId, donorType: "CORPORATE", donorPrefix: "บริษัท", donorName: name,
      taxIdEncrypted: encryptTaxId(taxId), taxIdMasked: maskTaxId(taxId), taxIdHash: hashTaxId(taxId),
      phone: "0812345678", email: "export-e2e@example.test", amount: "2500.50", needTaxDeduction,
      transferDate: new Date(`${DAY}T00:00:00Z`), transferTime: new Date("1970-01-01T09:30:00Z"),
      slipFilePath: "slips/e2e/none.png", verificationStatus: "WAITING_TREASURY_RD",
    },
  });
  donationIds.push(donation.donationId);
  return donation;
}

test.beforeAll(async () => {
  prisma = createDatabaseClient();
  const suffix = randomBytes(6).toString("hex");
  email = `export-test-${suffix}@example.test`;
  userId = (await prisma.adminUser.create({ data: { username: `export-test-${suffix}`, email, fullName: "ผู้ทดสอบส่งออก", passwordHash: await hashPassword(password), role: "ADMIN" } })).userId;
  fundId = (await prisma.scholarshipFund.create({ data: { fundCode: `E2E_EXPORT_${suffix.toUpperCase()}`, fundNameTh: "ทุนทดสอบการส่งออก", bankAccountNo: "999-9-99999-9", isActive: false } })).fundId;
});

test.afterAll(async () => {
  const items = await prisma.edonationExportItem.findMany({ where: { donationId: { in: donationIds } }, select: { batchId: true } });
  const batchIds = [...new Set(items.map((item) => item.batchId))];
  await prisma.edonationExportBatch.deleteMany({ where: { batchId: { in: batchIds } } }); // items cascade
  await prisma.donation.deleteMany({ where: { donationId: { in: donationIds } } });
  await prisma.scholarshipFund.delete({ where: { fundId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.adminSession.deleteMany({ where: { userId } });
  await prisma.adminUser.delete({ where: { userId } });
  await prisma.$disconnect();
});

test("finance export: batch is saved, file has full tax IDs as text, and rows are not exported twice", async ({ page, request }) => {
  const included = await addDonation("บริษัท ทดสอบส่งออก จำกัด", true, TAX_ID);
  await addDonation("ผู้ไม่ขอลดหย่อน", false, taxIdWithCheckDigit("310050012345"));

  await page.goto("/login");
  await page.getByLabel("อีเมลผู้ดูแลระบบ").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });

  await page.getByRole("complementary", { name: "เมนูผู้ดูแล" }).getByRole("link", { name: /^ส่งออก Excel/ }).click();
  await page.getByLabel("โอนตั้งแต่วันที่").fill(DAY);
  await page.getByLabel("ถึงวันที่").fill(DAY);
  await page.getByRole("button", { name: "แสดงรายการ" }).click();
  await expect(page).toHaveURL(new RegExp(`from=${DAY}`));
  await expect(page.getByRole("cell", { name: /บริษัท ทดสอบส่งออก จำกัด/ })).toBeVisible();
  await expect(page.getByText("ผู้ไม่ขอลดหย่อน")).toHaveCount(0);
  await page.screenshot({ path: "test-results/admin-export.png", fullPage: true });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ดาวน์โหลด Excel (1 รายการ)" }).click();
  await confirmModal(page, "ส่งออก");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^e-donation-EXP-\d{6}-\d{2,}\.xlsx$/);
  const file = await download.path();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet("e-Donation")!;
  expect(sheet.getRow(4).getCell(2).value).toBe("เลขประจำตัวผู้เสียภาษี 13 หลัก");
  expect(sheet.getRow(5).getCell(2).value).toBe(TAX_ID); // full, with its leading zero
  expect(sheet.getRow(5).getCell(5).value).toBe("บริษัท ทดสอบส่งออก จำกัด");
  expect(sheet.getRow(5).getCell(6).value).toBe(2500.5);
  expect(sheet.getRow(6).getCell(5).value).toBe("รวม");

  const saved = await prisma.donation.findUniqueOrThrow({ where: { donationId: included.donationId }, include: { exportItems: { include: { batch: true } } } });
  expect(saved.edonationExportStatus).toBe("EXPORTED");
  expect(saved.exportItems).toHaveLength(1);
  expect(saved.exportItems[0].batch.totalRecords).toBe(1);
  expect(saved.exportItems[0].batch.exportedBy).toBe(userId);
  const actions = (await prisma.auditLog.findMany({ where: { userId, action: { contains: "EXCEL" } } })).map((log) => log.action).sort();
  expect(actions).toEqual(["DOWNLOAD_EXCEL_EDONATION", "EXPORT_EXCEL_EDONATION"]);

  // Already exported: the default view no longer offers it, and the history lists the batch.
  await page.reload();
  await expect(page.getByRole("button", { name: "ดาวน์โหลด Excel (0 รายการ)" })).toBeDisabled();
  await expect(page.getByRole("link", { name: `ดาวน์โหลดชุด ${saved.exportItems[0].batch.batchNo} อีกครั้ง` })).toBeVisible();

  // The file holds full tax IDs, so it needs an admin session.
  expect((await request.get(`/admin/exports/${saved.exportItems[0].batchId}/download`)).status()).toBe(401);
});
