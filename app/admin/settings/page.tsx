import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { getSharedAccount, type PaymentAccount } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { THAI_BANKS } from "@/lib/thai-banks";
import { CreateFundForm, FundForm, SharedAccountForm, type AccountSettings } from "./fund-forms";

export const metadata: Metadata = { title: "ตั้งค่ากองทุน | MED e-Donation" };
export const instant = false;

/** Form values for an account; older rows saved only a bank name, so the code is looked up from it. */
function toForm(account: PaymentAccount): AccountSettings {
  return {
    bankName: account.bankName,
    bankCode: account.bankCode ?? THAI_BANKS.find((bank) => bank.name === account.bankName)?.code ?? "",
    bankAccountNo: account.bankAccountNo,
    bankAccountName: account.bankAccountName ?? "",
    qrType: account.qrType,
    promptpayId: account.promptpayId ?? "",
  };
}

async function FundSettings() {
  await requireAdmin(); // each page checks the session itself; the layout does not re-render on navigation
  const [funds, shared] = await Promise.all([
    prisma.scholarshipFund.findMany({ orderBy: { fundId: "asc" }, include: { _count: { select: { donations: true } } } }),
    getSharedAccount(),
  ]);
  const sharedForm = toForm(shared);
  return (
    <main className="admin-main">
      <p className="admin-eyebrow">SETTINGS</p>
      <div className="admin-welcome"><div><h1>กองทุนและการชำระเงิน</h1><p>วัตถุประสงค์การรับบริจาค บัญชีรับเงิน และ QR บนฟอร์มบริจาค แต่ละวัตถุประสงค์เลือกใช้บัญชีรับเงินรวม (QR รวม) หรือบัญชีแยกของตัวเองได้</p></div></div>
      <div className="admin-settings-stack">
        <SharedAccountForm account={sharedForm} usedBy={funds.filter((fund) => fund.paymentMode === "SHARED").map((fund) => fund.fundNameTh)} />
        <CreateFundForm />
        {funds.map((fund) => (
          <FundForm
            key={fund.fundId}
            shared={sharedForm}
            fund={{
              ...toForm(fund),
              fundId: fund.fundId, fundCode: fund.fundCode, fundNameTh: fund.fundNameTh, fundDescription: fund.fundDescription ?? "",
              requiresStudentName: fund.requiresStudentName, paymentMode: fund.paymentMode, isActive: fund.isActive, donationCount: fund._count.donations,
            }}
          />
        ))}
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลด…</main>}><FundSettings /></Suspense>
  );
}
