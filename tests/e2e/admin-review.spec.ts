import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createDatabaseClient } from "../../lib/database";
import { encryptTaxId, hashTaxId, maskTaxId } from "../../lib/donor-crypto";
import { hashPassword } from "../../lib/password";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const storageRoot = path.resolve(process.env.SLIP_STORAGE_DIR?.trim() || "storage");
const password = randomBytes(24).toString("hex");

let prisma: ReturnType<typeof createDatabaseClient>;
let userId: number;
let email: string;
let fundId: number;
const donationIds: string[] = [];
const slipPaths: string[] = [];

function taxIdWithCheckDigit(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i);
  return `${first12}${(11 - (sum % 11)) % 10}`;
}

async function createDonation(suffix: string, taxId: string) {
  const slipFilePath = `slips/e2e/${randomBytes(8).toString("hex")}.png`;
  await mkdir(path.join(storageRoot, "slips/e2e"), { recursive: true });
  await writeFile(path.join(storageRoot, slipFilePath), PNG);
  slipPaths.push(slipFilePath);
  const donation = await prisma.donation.create({
    data: {
      referenceNo: `E2E-${suffix}-${randomBytes(4).toString("hex")}`,
      fundId, donorType: "INDIVIDUAL", donorPrefix: "นาย", donorName: `ผู้ทดสอบ ${suffix}`,
      taxIdEncrypted: encryptTaxId(taxId), taxIdMasked: maskTaxId(taxId), taxIdHash: hashTaxId(taxId),
      phone: "0812345678", email: "review-e2e@example.test", amount: "1500.00",
      transferDate: new Date("2026-11-01T00:00:00Z"), transferTime: new Date(`1970-01-01T10:${String(donationIds.length).padStart(2, "0")}:00Z`),
      slipFilePath, slipFileHash: randomBytes(32).toString("hex"),
    },
  });
  donationIds.push(donation.donationId);
  return donation;
}

/** Deletes development outbox messages addressed to the test donor. */
async function removeOutboxMail(recipient: string) {
  const outbox = path.join(storageRoot, "outbox");
  const files = await readdir(outbox).catch(() => [] as string[]);
  for (const file of files) {
    const content = await readFile(path.join(outbox, file), "utf8").catch(() => "");
    if (content.includes(recipient)) await rm(path.join(outbox, file), { force: true });
  }
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมลผู้ดูแลระบบ").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  // The first visit compiles /admin in development, which can take a while.
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test.beforeAll(async () => {
  prisma = createDatabaseClient();
  const suffix = randomBytes(6).toString("hex");
  email = `review-test-${suffix}@example.test`;
  const user = await prisma.adminUser.create({ data: { username: `review-test-${suffix}`, email, fullName: "ผู้ตรวจทดสอบ", passwordHash: await hashPassword(password), role: "ADMIN" } });
  userId = user.userId;
  const fund = await prisma.scholarshipFund.create({ data: { fundCode: `E2E_REVIEW_${suffix.toUpperCase()}`, fundNameTh: "ทุนทดสอบการตรวจสลิป", bankAccountNo: "999-9-99999-9", isActive: false } });
  fundId = fund.fundId;
});

test.afterAll(async () => {
  const certificates = await prisma.acknowledgementCertificate.findMany({ where: { donationId: { in: donationIds } }, select: { pdfFilePath: true } });
  for (const certificate of certificates) if (certificate.pdfFilePath) await rm(path.join(storageRoot, certificate.pdfFilePath), { force: true });
  await removeOutboxMail("review-e2e@example.test");
  await prisma.acknowledgementCertificate.deleteMany({ where: { donationId: { in: donationIds } } });
  await prisma.adminNotification.deleteMany({ where: { donationId: { in: donationIds } } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.donation.deleteMany({ where: { donationId: { in: donationIds } } });
  await prisma.scholarshipFund.delete({ where: { fundId } });
  await prisma.adminSession.deleteMany({ where: { userId } });
  await prisma.adminUser.delete({ where: { userId } });
  for (const slip of slipPaths) await rm(path.join(storageRoot, slip), { force: true });
  await prisma.$disconnect();
});

test("slip images require an admin session", async ({ request }) => {
  const donation = await createDonation("anon", taxIdWithCheckDigit("110170023070"));
  const response = await request.get(`/admin/slips/${donation.donationId}`);
  expect(response.status()).toBe(401);
});

test("admin reviews a slip, reveals the tax ID and approves it", async ({ page }) => {
  const taxId = taxIdWithCheckDigit("356010029481");
  const donation = await createDonation("approve", taxId);
  await signIn(page);
  await page.getByRole("complementary", { name: "เมนูผู้ดูแล" }).getByRole("link", { name: /^รายการบริจาค/ }).click();
  await expect(page.getByRole("heading", { name: "ตรวจสอบรายการบริจาค" })).toBeVisible();
  await page.getByRole("link", { name: `เปิดรายการ ${donation.referenceNo}` }).click();

  await expect(page.getByRole("heading", { name: donation.referenceNo })).toBeVisible();
  const slip = page.getByRole("img", { name: /สลิปโอนเงินของรายการ/ });
  await expect(slip).toBeVisible();
  expect(await slip.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // The previous list page stays mounted but hidden after navigation, so scope to the tax ID field.
  const taxIdField = page.locator(".admin-taxid");
  await expect(taxIdField).toContainText(maskTaxId(taxId));
  await page.getByRole("button", { name: "แสดงเลขเต็ม" }).click();
  await expect(taxIdField).toContainText(taxId);

  const approve = page.getByRole("button", { name: "อนุมัติและออกใบอนุโมทนาบัตร" });
  await expect(approve).toBeDisabled();
  for (const label of [/ยอดเงินและวัน–เวลา/, /ชื่อผู้บริจาคตรงกับ/, /เลขผู้เสียภาษี 13 หลักถูกต้อง/]) await page.getByLabel(label).check();
  await page.screenshot({ path: "test-results/admin-review.png", fullPage: true });
  await approve.click();

  await expect(page.getByRole("heading", { name: "ผลการตรวจสอบ" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/MEDUP-\d{2}\/\d{4,}/).first()).toBeVisible();
  const saved = await prisma.donation.findUniqueOrThrow({ where: { donationId: donation.donationId }, include: { certificate: true } });
  expect(saved.verificationStatus).toBe("WAITING_TREASURY_RD");
  expect(saved.slipVerifiedBy).toBe(userId);
  expect(saved.certificate?.issuedBy).toBe(userId);
  // Email 1: certificate PDF generated, stored and sent (to storage/outbox in development).
  expect(saved.certificate?.emailSentStatus).toBe("SENT");
  expect(saved.certificate?.pdfFilePath).toMatch(/^certificates\/\d{4}\/MEDUP-\d{2}-\d{4,}\.pdf$/);
  const pdf = await page.request.get(`/admin/certificates/${donation.donationId}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const pdfBytes = await pdf.body();
  expect(pdfBytes.subarray(0, 4).toString()).toBe("%PDF");
  await writeFile("test-results/certificate-e2e.pdf", pdfBytes);
  const actions = (await prisma.auditLog.findMany({ where: { targetId: donation.donationId } })).map((log) => log.action).sort();
  expect(actions).toEqual(["APPROVE_SLIP", "VIEW_TAX_ID"]);
  await page.screenshot({ path: "test-results/admin-approved.png", fullPage: true });

  // Approval 2: keyed into the RD e-Donation system, confirmation email sent.
  const approve2 = page.getByRole("button", { name: "อนุมัติครั้งที่ 2 และส่งอีเมลยืนยัน" });
  await expect(approve2).toBeDisabled();
  await page.getByLabel(/คีย์ข้อมูลเข้าระบบ e-Donation กรมสรรพากรเรียบร้อย/).check();
  await approve2.click();
  await expect(page.getByText("อีเมลฉบับที่ 2 (ยืนยันสรรพากร)")).toBeVisible({ timeout: 30_000 });
  const completed = await prisma.donation.findUniqueOrThrow({ where: { donationId: donation.donationId } });
  expect(completed.verificationStatus).toBe("COMPLETED_RD");
  expect(completed.rdSubmittedBy).toBe(userId);
  expect(completed.rdConfirmEmailSentAt).not.toBeNull();
  await page.screenshot({ path: "test-results/admin-completed.png", fullPage: true });
});

test("admin rejects a slip with a reason", async ({ page }) => {
  const donation = await createDonation("reject", taxIdWithCheckDigit("310050012345"));
  await signIn(page);
  await page.goto(`/admin/donations/${donation.donationId}`);
  await page.getByRole("button", { name: "ไม่อนุมัติ", exact: true }).click();
  await page.getByLabel(/เหตุผลที่ไม่อนุมัติ/).fill("ไม่พบยอดเงินเข้าใน Book Bank");
  await page.getByRole("button", { name: "บันทึกว่าไม่อนุมัติ" }).click();
  await expect(page.getByText("ไม่พบยอดเงินเข้าใน Book Bank")).toBeVisible();
  const saved = await prisma.donation.findUniqueOrThrow({ where: { donationId: donation.donationId } });
  expect(saved.verificationStatus).toBe("REJECTED");
  expect(saved.rejectionReason).toBe("ไม่พบยอดเงินเข้าใน Book Bank");
});
