import "server-only";
import type { PaymentMode, QrType } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type { QrTarget } from "./promptpay";

export const ACCOUNT_NOT_SET = "ยังไม่ได้ตั้งค่า";

export type PaymentAccount = {
  bankName: string;
  bankCode: string | null;
  bankAccountNo: string;
  bankAccountName: string | null;
  qrType: QrType;
  promptpayId: string | null;
};

export const DEFAULT_SHARED_ACCOUNT: PaymentAccount = {
  bankName: "ธนาคารกรุงไทย", bankCode: "006", bankAccountNo: ACCOUNT_NOT_SET, bankAccountName: null, qrType: "NONE", promptpayId: null,
};

/** The shared account used by every fund in SHARED mode (defaults until an admin saves it). */
export async function getSharedAccount(): Promise<PaymentAccount> {
  const row = await prisma.paymentSetting.findUnique({ where: { settingId: 1 }, omit: { settingId: true, updatedBy: true, updatedAt: true } });
  return row ?? DEFAULT_SHARED_ACCOUNT;
}

export const accountIsSet = (account: Pick<PaymentAccount, "bankAccountNo">) =>
  account.bankAccountNo !== ACCOUNT_NOT_SET && /\d{6,}/.test(account.bankAccountNo.replace(/\D/g, ""));

/** The account a fund actually pays into, after applying its payment mode. */
export function effectiveAccount(fund: PaymentAccount & { paymentMode: PaymentMode }, shared: PaymentAccount): PaymentAccount {
  return fund.paymentMode === "SHARED" ? shared : fund;
}

export function qrTargetOf(account: PaymentAccount): QrTarget | null {
  if (account.qrType === "PROMPTPAY" && account.promptpayId) return { type: "PROMPTPAY", promptpayId: account.promptpayId };
  if (account.qrType === "BANK_ACCOUNT" && account.bankCode) return { type: "BANK_ACCOUNT", bankCode: account.bankCode, accountNo: account.bankAccountNo };
  return null;
}
