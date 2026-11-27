import { expect, type Page } from "@playwright/test";

/** The Ant Design toast area used for action results. */
export const toast = (page: Page) => page.locator(".ant-message");

/** Expects a success/error toast containing `text`. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(toast(page).filter({ hasText: text })).toBeVisible();
}

/** Presses the OK button of the open Ant Design confirm modal. */
export async function confirmModal(page: Page, okText: string) {
  await page.getByRole("dialog").getByRole("button", { name: okText, exact: true }).click();
}
