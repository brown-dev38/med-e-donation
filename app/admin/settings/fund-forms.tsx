"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import ThaiQr from "@/app/components/promptpay-qr";
import { qrTargetError, type QrTarget } from "@/lib/promptpay";
import { THAI_BANKS } from "@/lib/thai-banks";
import { createFund, deleteFund, saveFund, saveSharedAccount } from "./actions";
import { Message, submitWithoutReset } from "./settings-forms";

export type QrKind = "NONE" | "PROMPTPAY" | "BANK_ACCOUNT";
export type AccountSettings = {
  bankName: string;
  bankCode: string;
  bankAccountNo: string;
  bankAccountName: string;
  qrType: QrKind;
  promptpayId: string;
};

const NOT_SET = "ยังไม่ได้ตั้งค่า";
const QR_OPTIONS: { value: QrKind; label: string; hint: string }[] = [
  { value: "PROMPTPAY", label: "QR พร้อมเพย์", hint: "ใช้เลขผู้เสียภาษี 13 หลักของหน่วยงาน เบอร์มือถือ หรือ e-Wallet ที่ผูกพร้อมเพย์ไว้" },
  { value: "BANK_ACCOUNT", label: "QR จากเลขบัญชีธนาคาร", hint: "สร้าง Thai QR จากรหัสธนาคาร + เลขที่บัญชี ไม่ต้องผูกพร้อมเพย์" },
  { value: "NONE", label: "ไม่แสดง QR", hint: "แสดงเฉพาะเลขที่บัญชีให้ผู้บริจาคโอนเอง" },
];

function qrTargetFrom(account: AccountSettings): QrTarget | null {
  if (account.qrType === "PROMPTPAY") return { type: "PROMPTPAY", promptpayId: account.promptpayId.replace(/[\s-]/g, "") };
  if (account.qrType === "BANK_ACCOUNT") return { type: "BANK_ACCOUNT", bankCode: account.bankCode, accountNo: account.bankAccountNo };
  return null;
}

/** QR preview (no amount) for the account as currently typed. */
export function QrPreview({ account, emptyText }: { account: AccountSettings; emptyText?: string }) {
  const target = qrTargetFrom(account);
  if (!target) return <div className="admin-qr-empty">{emptyText ?? "ไม่แสดง QR"}</div>;
  const error = qrTargetError(target);
  if (error) return <div className="admin-qr-empty">{error}</div>;
  return <ThaiQr target={target} size={190} caption={target.type === "BANK_ACCOUNT" ? account.bankName : undefined} />;
}

/** Bank, account number, account name and QR type. Field names match readAccount() on the server. */
function AccountFields({ idPrefix, account, onChange }: { idPrefix: string; account: AccountSettings; onChange: (next: AccountSettings) => void }) {
  const id = (name: string) => `${name}-${idPrefix}`;
  const knownBank = THAI_BANKS.some((bank) => bank.code === account.bankCode);
  const set = (patch: Partial<AccountSettings>) => onChange({ ...account, ...patch });
  return (
    <>
      <div className="admin-two">
        <div>
          <label className="admin-field" htmlFor={id("bankCode")}>ธนาคาร</label>
          <select className="admin-input" id={id("bankCode")} name="bankCode" value={knownBank ? account.bankCode : ""} onChange={(e) => set({ bankCode: e.target.value, bankName: THAI_BANKS.find((bank) => bank.code === e.target.value)?.name ?? account.bankName })}>
            {THAI_BANKS.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
            <option value="">อื่น ๆ (ระบุชื่อเอง)</option>
          </select>
          {!knownBank && <input className="admin-input admin-input-follow" name="bankNameOther" aria-label="ชื่อธนาคาร" value={account.bankName} onChange={(e) => set({ bankName: e.target.value })} maxLength={100} />}
        </div>
        <div>
          <label className="admin-field" htmlFor={id("bankAccountNo")}>เลขที่บัญชี</label>
          <input className="admin-input" id={id("bankAccountNo")} name="bankAccountNo" value={account.bankAccountNo === NOT_SET ? "" : account.bankAccountNo} onChange={(e) => set({ bankAccountNo: e.target.value })} maxLength={50} placeholder="เช่น 512-0-12345-6" />
        </div>
      </div>
      <label className="admin-field" htmlFor={id("bankAccountName")}>ชื่อบัญชี</label>
      <input className="admin-input" id={id("bankAccountName")} name="bankAccountName" value={account.bankAccountName} onChange={(e) => set({ bankAccountName: e.target.value })} maxLength={255} placeholder="กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา" />
      <fieldset className="admin-radio-cards">
        <legend className="admin-field">QR บนฟอร์มบริจาค</legend>
        {QR_OPTIONS.map((option) => (
          <label key={option.value} className={account.qrType === option.value ? "is-selected" : ""}>
            <input type="radio" name="qrType" value={option.value} checked={account.qrType === option.value} onChange={() => set({ qrType: option.value })} />
            <span><strong>{option.label}</strong><small>{option.hint}</small></span>
          </label>
        ))}
      </fieldset>
      {account.qrType === "PROMPTPAY" && (
        <>
          <label className="admin-field" htmlFor={id("promptpayId")}>พร้อมเพย์</label>
          <input className="admin-input" id={id("promptpayId")} name="promptpayId" value={account.promptpayId} onChange={(e) => set({ promptpayId: e.target.value })} inputMode="numeric" maxLength={30} placeholder="เลขผู้เสียภาษี 13 หลัก / มือถือ 10 หลัก / e-Wallet 15 หลัก" />
        </>
      )}
      {account.qrType === "BANK_ACCOUNT" && (
        <p className="admin-hint admin-hint-warn">QR เลขบัญชีใช้ข้อมูลธนาคารและเลขที่บัญชีด้านบน กรุณาทดลองสแกนด้วยแอปธนาคารและโอนยอดเล็ก ๆ ก่อนเปิดใช้งานจริง</p>
      )}
    </>
  );
}

export function SharedAccountForm({ account: saved, usedBy }: { account: AccountSettings; usedBy: string[] }) {
  const [state, action, pending] = useActionState(saveSharedAccount, null);
  const [account, setAccount] = useState(saved);
  return (
    <form onSubmit={submitWithoutReset(action)} className="admin-panel admin-settings-card admin-shared-account" aria-labelledby="shared-title">
      <div className="admin-panel-head">
        <h2 id="shared-title">บัญชีรับเงินรวม</h2>
        <span className="admin-hint">ใช้ร่วมกันได้ทุกวัตถุประสงค์ · QR รวมอันเดียว</span>
      </div>
      <div className="admin-settings-grid">
        <div className="admin-settings-fields">
          <AccountFields idPrefix="shared" account={account} onChange={setAccount} />
          <p className="admin-hint">{usedBy.length ? `ใช้อยู่กับ: ${usedBy.join(" · ")}` : "ยังไม่มีวัตถุประสงค์ที่ใช้บัญชีรวม"}</p>
        </div>
        <div className="admin-settings-preview">
          <p className="admin-hint">ตัวอย่าง QR รวม (ไม่ระบุยอด)</p>
          <QrPreview account={account} />
        </div>
      </div>
      <Message state={state} />
      <div className="admin-actions-row"><button type="submit" className="admin-button" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกบัญชีรับเงินรวม"}</button></div>
    </form>
  );
}

export function CreateFundForm() {
  const [state, action, pending] = useActionState(createFund, null);
  return (
    <form action={action} className="admin-panel admin-create-fund">
      <div className="admin-panel-head"><h2>เพิ่มวัตถุประสงค์การรับบริจาค</h2></div>
      <div className="admin-create-grid">
        <div>
          <label className="admin-field" htmlFor="new-fundNameTh">ชื่อวัตถุประสงค์</label>
          <input className="admin-input" id="new-fundNameTh" name="fundNameTh" required minLength={3} maxLength={255} placeholder="เช่น ทุนสนับสนุนกิจกรรมนิสิตแพทย์" />
        </div>
        <div>
          <label className="admin-field" htmlFor="new-fundCode">รหัส (ไม่บังคับ)</label>
          <input className="admin-input" id="new-fundCode" name="fundCode" maxLength={50} placeholder="เช่น STUDENT_ACTIVITY" />
        </div>
        <button type="submit" className="admin-button" disabled={pending}>{pending ? "กำลังเพิ่ม…" : "+ เพิ่ม"}</button>
      </div>
      <label className="admin-check"><input type="checkbox" name="requiresStudentName" /> ผู้บริจาคต้องระบุชื่อนิสิตผู้รับทุน</label>
      <p className="admin-hint">วัตถุประสงค์ใหม่จะใช้บัญชีรับเงินรวมและปิดรับบริจาคไว้ก่อน ตรวจรายละเอียดด้านล่างแล้วจึงเปิดใช้งาน</p>
      <Message state={state} />
    </form>
  );
}

export type FundSettings = AccountSettings & {
  fundId: number;
  fundCode: string;
  fundNameTh: string;
  fundDescription: string;
  requiresStudentName: boolean;
  paymentMode: "SHARED" | "OWN";
  isActive: boolean;
  donationCount: number;
};

export function FundForm({ fund, shared }: { fund: FundSettings; shared: AccountSettings }) {
  const [state, action, pending] = useActionState(saveFund, null);
  const [mode, setMode] = useState(fund.paymentMode);
  const [account, setAccount] = useState<AccountSettings>(fund);
  const id = (name: string) => `${name}-${fund.fundId}`;
  return (
    <div className="admin-panel admin-settings-card">
      <form onSubmit={submitWithoutReset(action)} aria-labelledby={id("title")}>
        <input type="hidden" name="fundId" value={fund.fundId} />
        <div className="admin-panel-head">
          <h2 id={id("title")}>{fund.fundNameTh} <small className="admin-fund-code">{fund.fundCode}</small></h2>
          <span className={`admin-status ${fund.isActive ? "admin-status-completed_rd" : "admin-status-rejected"}`}>{fund.isActive ? "เปิดรับบริจาค" : "ปิดรับบริจาค"}</span>
        </div>
        <div className="admin-settings-grid">
          <div className="admin-settings-fields">
            <label className="admin-field" htmlFor={id("fundNameTh")}>ชื่อวัตถุประสงค์ (แสดงบนฟอร์มและใบอนุโมทนาบัตร)</label>
            <input className="admin-input" id={id("fundNameTh")} name="fundNameTh" defaultValue={fund.fundNameTh} maxLength={255} required />
            <label className="admin-field" htmlFor={id("fundDescription")}>คำอธิบายบนฟอร์มบริจาค</label>
            <textarea className="admin-input" id={id("fundDescription")} name="fundDescription" defaultValue={fund.fundDescription} rows={2} maxLength={2000} />
            <label className="admin-check"><input type="checkbox" name="requiresStudentName" defaultChecked={fund.requiresStudentName} /> ผู้บริจาคต้องระบุชื่อนิสิตผู้รับทุน</label>

            <fieldset className="admin-radio-cards admin-radio-row">
              <legend className="admin-field">บัญชีรับเงิน</legend>
              <label className={mode === "SHARED" ? "is-selected" : ""}>
                <input type="radio" name="paymentMode" value="SHARED" checked={mode === "SHARED"} onChange={() => setMode("SHARED")} />
                <span><strong>ใช้บัญชีรับเงินรวม</strong><small>QR รวมอันเดียวกับวัตถุประสงค์อื่น</small></span>
              </label>
              <label className={mode === "OWN" ? "is-selected" : ""}>
                <input type="radio" name="paymentMode" value="OWN" checked={mode === "OWN"} onChange={() => setMode("OWN")} />
                <span><strong>บัญชีแยกของวัตถุประสงค์นี้</strong><small>เลขบัญชีและ QR ของตัวเอง</small></span>
              </label>
            </fieldset>
            {mode === "OWN"
              ? <AccountFields idPrefix={String(fund.fundId)} account={account} onChange={setAccount} />
              : <p className="admin-hint">โอนเข้า {shared.bankName} {shared.bankAccountNo === NOT_SET ? "(ยังไม่ได้ตั้งเลขที่บัญชีรวม)" : shared.bankAccountNo}</p>}

            <label className="admin-check admin-check-strong"><input type="checkbox" name="isActive" defaultChecked={fund.isActive} /> เปิดรับบริจาควัตถุประสงค์นี้บนหน้าเว็บไซต์</label>
          </div>
          <div className="admin-settings-preview">
            <p className="admin-hint">{mode === "SHARED" ? "QR รวม" : "QR ของวัตถุประสงค์นี้"} (ไม่ระบุยอด)</p>
            <QrPreview account={mode === "SHARED" ? shared : account} />
            <p className="admin-hint">มีรายการบริจาค {fund.donationCount.toLocaleString("th-TH")} รายการ</p>
          </div>
        </div>
        <Message state={state} />
        <div className="admin-actions-row">
          <button type="submit" className="admin-button" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
          <Link href={`/donate?fund=${fund.fundCode}`} target="_blank" className="admin-inline-link">ดูฟอร์มบริจาค ↗</Link>
        </div>
      </form>
      {fund.donationCount === 0 && (
        <form action={deleteFund} className="admin-delete-fund" onSubmit={(e) => { if (!confirm(`ลบวัตถุประสงค์ “${fund.fundNameTh}”?`)) e.preventDefault(); }}>
          <input type="hidden" name="fundId" value={fund.fundId} />
          <button type="submit" className="admin-button admin-button-small admin-button-ghost admin-danger-text">ลบวัตถุประสงค์นี้</button>
        </form>
      )}
    </div>
  );
}
