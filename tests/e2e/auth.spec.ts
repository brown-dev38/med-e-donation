import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createDatabaseClient } from "../../lib/database";
import { hashPassword } from "../../lib/password";

let prisma: ReturnType<typeof createDatabaseClient>;
const password = randomBytes(24).toString("hex");
let userId: number;
let email: string;

test.beforeAll(() => { prisma = createDatabaseClient(); });

test.beforeEach(async () => {
  const suffix = randomBytes(8).toString("hex");
  email = `auth-test-${suffix}@example.test`;
  const user = await prisma.adminUser.create({ data: { username: `auth-test-${suffix}`, email, fullName: "ผู้ดูแลทดสอบ", passwordHash: await hashPassword(password), role: "ADMIN" } });
  userId = user.userId;
});

test.afterEach(async () => {
  if (userId) {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.adminUser.delete({ where: { userId } });
  }
});

test.afterAll(() => prisma.$disconnect());

async function signIn(page: Page, suppliedPassword = password) {
  await page.goto("/login");
  await page.getByLabel("อีเมลผู้ดูแลระบบ").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(suppliedPassword);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
}

test("anonymous users cannot view the admin dashboard", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "ยินดีต้อนรับกลับ" })).toBeVisible();
  await expect(page.getByLabel("อีเมลผู้ดูแลระบบ")).toBeVisible();
  await page.screenshot({ path: "test-results/login-desktop.png", fullPage: true, caret: "initial" });
});

test("valid credentials create a protected session and logout revokes it", async ({ page, context }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบสำเร็จ" })).toBeVisible();
  const session = (await context.cookies()).find(cookie => cookie.name === "medup_admin_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  expect(await prisma.adminSession.count({ where: { userId } })).toBe(1);
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await prisma.adminSession.count({ where: { userId } })).toBe(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("five failed passwords temporarily lock the account", async ({ page }) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    await signIn(page, "incorrect-password");
    await expect(page.locator("#login-error")).toContainText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { userId } });
  expect(user.failedLoginAttempts).toBe(5);
  expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  await signIn(page);
  await expect(page.locator("#login-error")).toBeVisible();
  expect(await prisma.adminSession.count({ where: { userId } })).toBe(0);
});

test("expired sessions cannot access the dashboard", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await prisma.adminSession.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("revoked admin privileges take effect on existing sessions", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  await prisma.adminUser.update({ where: { userId }, data: { role: "VIEWER" } });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page);
  await expect(page.locator("#login-error")).toBeVisible();
});

test("inactive accounts cannot sign in", async ({ page }) => {
  await prisma.adminUser.update({ where: { userId }, data: { isActive: false } });
  await signIn(page);
  await expect(page.locator("#login-error")).toBeVisible();
  expect(await prisma.adminSession.count({ where: { userId } })).toBe(0);
});

test("login form fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/login-mobile.png", fullPage: true, caret: "initial" });
});
