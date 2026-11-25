import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createDatabaseClient } from "../../lib/database";
import { hashPassword } from "../../lib/password";

const password = randomBytes(24).toString("hex");
let prisma: ReturnType<typeof createDatabaseClient>;
let userId: number;
let email: string;

test.beforeAll(async () => {
  prisma = createDatabaseClient();
  const suffix = randomBytes(6).toString("hex");
  email = `layout-test-${suffix}@example.test`;
  userId = (await prisma.adminUser.create({ data: { username: `layout-test-${suffix}`, email, fullName: "ผู้ทดสอบหน้าจอ", passwordHash: await hashPassword(password), role: "ADMIN" } })).userId;
});

test.afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.adminSession.deleteMany({ where: { userId } });
  await prisma.adminUser.delete({ where: { userId } });
  await prisma.$disconnect();
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมลผู้ดูแลระบบ").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test("desktop: hamburger hides and shows the sidebar; footer shows the credit", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 860 });
  await signIn(page);
  const sidebar = page.getByRole("complementary", { name: "เมนูผู้ดูแล" });
  const hamburger = page.getByRole("button", { name: "ปิดเมนูด้านข้าง" });
  await expect(sidebar.getByRole("link", { name: "ภาพรวม" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("contentinfo")).toContainText("พัฒนาระบบโดย");
  await page.screenshot({ path: "test-results/admin-dashboard-desktop.png", fullPage: true });

  await hamburger.click();
  await expect(page.getByRole("button", { name: "เปิดเมนูด้านข้าง" })).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeHidden();
  await page.waitForTimeout(400); // let the slide animation finish before the screenshot
  await page.screenshot({ path: "test-results/admin-dashboard-collapsed.png" });
  await page.getByRole("button", { name: "เปิดเมนูด้านข้าง" }).click();
  await expect(sidebar).toBeVisible();

  // Navigating keeps the same frame mounted: no page reload and no full-screen loading screen.
  await page.evaluate(() => {
    document.querySelector(".admin-sidebar")?.setAttribute("data-mounted", "before-navigation");
    const w = window as Window & { __fullScreenLoading?: boolean };
    w.__fullScreenLoading = false;
    new MutationObserver(() => { if (document.querySelector(".admin-loading")) w.__fullScreenLoading = true; }).observe(document.body, { childList: true, subtree: true });
  });
  await sidebar.getByRole("link", { name: "ใบอนุโมทนาบัตรและอีเมล" }).click();
  await expect(page.getByRole("heading", { name: "ใบอนุโมทนาบัตรและอีเมล", level: 1 })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "ใบอนุโมทนาบัตรและอีเมล" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('.admin-sidebar[data-mounted="before-navigation"]')).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __fullScreenLoading?: boolean }).__fullScreenLoading)).toBe(false);
});

test("mobile: sidebar is a drawer that opens from the hamburger and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const sidebar = page.getByRole("complementary", { name: "เมนูผู้ดูแล" });
  await expect(sidebar).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/admin-dashboard-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "เปิดเมนูด้านข้าง" }).click();
  await expect(sidebar).toBeVisible();
  await page.waitForTimeout(400); // let the slide animation finish before the screenshot
  await page.screenshot({ path: "test-results/admin-dashboard-drawer.png" });
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();

  await page.getByRole("button", { name: "เปิดเมนูด้านข้าง" }).click();
  await sidebar.getByRole("link", { name: /^รายการบริจาค/ }).click();
  await expect(page).toHaveURL(/\/admin\/donations$/);
  await expect(sidebar).toBeHidden();

  // The single "รายการบริจาค" menu covers every status tab.
  await page.getByRole("navigation", { name: "กรองตามสถานะ" }).getByRole("link", { name: /^รอยืนยันกองคลัง/ }).click();
  await expect(page).toHaveURL(/status=WAITING_TREASURY_RD/);
  // The drawer is closed (hidden from the accessibility tree), so check the link element directly.
  await expect(page.locator(".admin-sidebar a[href=\"/admin/donations\"]")).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/admin-donations-mobile.png", fullPage: true });
});
