import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createDatabaseClient } from "../../lib/database";
import { hashPassword, verifyPassword } from "../../lib/password";
import { confirmModal, expectToast } from "./ui";

const password = randomBytes(24).toString("hex");
const suffix = randomBytes(6).toString("hex");
const email = `users-test-${suffix}@example.test`;
const newEmail = `users-new-${suffix}@example.test`;
const editedEmail = `users-edited-${suffix}@example.test`;
let prisma: ReturnType<typeof createDatabaseClient>;

test.beforeAll(async () => {
  prisma = createDatabaseClient();
  await prisma.adminUser.create({ data: { username: `users-test-${suffix}`, email, fullName: "ผู้ทดสอบผู้ใช้งาน", passwordHash: await hashPassword(password), role: "ADMIN" } });
});

test.afterAll(async () => {
  const ids = (await prisma.adminUser.findMany({ where: { email: { in: [email, newEmail, editedEmail] } }, select: { userId: true } })).map((row) => row.userId);
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { targetTable: "admin_users", targetId: { in: ids.map(String) } }] } });
  await prisma.adminSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.adminUser.deleteMany({ where: { userId: { in: ids } } });
  await prisma.$disconnect();
});

test("admin adds, edits, re-passwords and disables a user", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 860 });
  await page.goto("/login");
  await page.getByLabel("อีเมลผู้ดูแลระบบ").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });

  await page.getByRole("complementary", { name: "เมนูผู้ดูแล" }).getByRole("link", { name: "ผู้ใช้งานระบบ" }).click();
  await expect(page.getByRole("heading", { name: "ผู้ใช้งานระบบ", level: 1 })).toBeVisible();

  // Add: new users default to the employee role.
  const addForm = page.locator("form", { has: page.getByRole("heading", { name: "เพิ่มผู้ใช้งาน" }) });
  await addForm.getByLabel("ชื่อ–นามสกุล").fill("เจ้าหน้าที่ใหม่ ทดสอบ");
  await addForm.getByLabel("อีเมล (ใช้เข้าสู่ระบบ)").fill(newEmail);
  await addForm.getByLabel("ชื่อผู้ใช้").fill(`users-new-${suffix}`);
  await addForm.getByLabel("รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัว)").fill("first-pass-123");
  await addForm.getByRole("button", { name: "เพิ่มผู้ใช้งาน", exact: true }).click();
  await expectToast(page, "เพิ่มผู้ใช้งาน เจ้าหน้าที่ใหม่ ทดสอบ แล้ว");
  await expect(addForm.getByLabel("ชื่อ–นามสกุล")).toHaveValue(""); // the form clears after a successful add
  expect((await prisma.adminUser.findUniqueOrThrow({ where: { email: newEmail } })).role).toBe("EMPLOYEE");

  // A duplicate email shows an error toast.
  await addForm.getByLabel("ชื่อ–นามสกุล").fill("ซ้ำ ทดสอบ");
  await addForm.getByLabel("อีเมล (ใช้เข้าสู่ระบบ)").fill(newEmail);
  await addForm.getByLabel("ชื่อผู้ใช้").fill(`users-dup-${suffix}`);
  await addForm.getByLabel("รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัว)").fill("first-pass-123");
  await addForm.getByRole("button", { name: "เพิ่มผู้ใช้งาน", exact: true }).click();
  await expectToast(page, "อีเมลนี้มีผู้ใช้งานแล้ว");

  // Edit name, email and role in the modal.
  await page.getByRole("button", { name: "แก้ไข เจ้าหน้าที่ใหม่ ทดสอบ" }).click();
  const editDialog = page.getByRole("dialog", { name: "แก้ไขข้อมูล เจ้าหน้าที่ใหม่ ทดสอบ" });
  await editDialog.getByLabel("ชื่อ–นามสกุล").fill("เจ้าหน้าที่แก้ไข ทดสอบ");
  await editDialog.getByLabel("อีเมล (ใช้เข้าสู่ระบบ)").fill(editedEmail);
  await editDialog.getByLabel(/^ผู้ดูแลระบบ/).check();
  await page.screenshot({ path: "test-results/admin-users-edit.png" });
  await editDialog.getByRole("button", { name: "บันทึก" }).click();
  await expectToast(page, "บันทึกข้อมูล เจ้าหน้าที่แก้ไข ทดสอบ แล้ว");
  await expect(editDialog).toBeHidden();
  const row = page.getByRole("row").filter({ hasText: editedEmail });
  await expect(row).toContainText("ผู้ดูแลระบบ");
  expect(await prisma.adminUser.findUniqueOrThrow({ where: { email: editedEmail } })).toMatchObject({ fullName: "เจ้าหน้าที่แก้ไข ทดสอบ", role: "ADMIN" });

  // Your own role is locked in the edit modal.
  await page.getByRole("button", { name: "แก้ไข ผู้ทดสอบผู้ใช้งาน" }).click();
  await expect(page.getByRole("dialog").getByLabel(/^เจ้าหน้าที่/)).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }).click();

  // Change password in its modal; mismatched confirmation is caught before sending.
  await row.getByRole("button", { name: "เปลี่ยนรหัสผ่าน เจ้าหน้าที่แก้ไข ทดสอบ" }).click();
  const pwDialog = page.getByRole("dialog", { name: "เปลี่ยนรหัสผ่าน เจ้าหน้าที่แก้ไข ทดสอบ" });
  await pwDialog.getByLabel("รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)").fill("second-pass-456");
  await pwDialog.getByLabel("ยืนยันรหัสผ่านใหม่").fill("second-pass-999");
  await pwDialog.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
  await expect(pwDialog.getByRole("alert")).toContainText("ไม่ตรงกัน");
  await pwDialog.getByLabel("ยืนยันรหัสผ่านใหม่").fill("second-pass-456");
  await pwDialog.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
  await expectToast(page, "เปลี่ยนรหัสผ่านแล้ว");
  await expect(pwDialog).toBeHidden();
  expect(await verifyPassword("second-pass-456", (await prisma.adminUser.findUniqueOrThrow({ where: { email: editedEmail } })).passwordHash)).toBe(true);

  // Disabling asks for confirmation; cancelling leaves the account active.
  await row.getByRole("button", { name: "ปิดใช้งาน เจ้าหน้าที่แก้ไข ทดสอบ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }).click();
  expect((await prisma.adminUser.findUniqueOrThrow({ where: { email: editedEmail } })).isActive).toBe(true);
  await row.getByRole("button", { name: "ปิดใช้งาน เจ้าหน้าที่แก้ไข ทดสอบ" }).click();
  await confirmModal(page, "ปิดใช้งาน");
  await expectToast(page, "ปิดใช้งานบัญชีแล้ว");
  await expect(row.getByRole("button", { name: "เปิดใช้งาน เจ้าหน้าที่แก้ไข ทดสอบ" })).toBeVisible();
  expect((await prisma.adminUser.findUniqueOrThrow({ where: { email: editedEmail } })).isActive).toBe(false);

  // The signed-in admin cannot disable their own account.
  await expect(page.getByRole("row").filter({ hasText: email }).getByRole("button", { name: /^ปิดใช้งาน/ })).toHaveCount(0);
  await page.screenshot({ path: "test-results/admin-users.png", fullPage: true });
});
