"use client";

import { App } from "antd";
import { useState, useTransition } from "react";
import { useConfirmedAction } from "@/app/components/feedback";
import { approveRdSubmission, approveSlip, rejectSlip, resendDonorEmail, revealTaxId } from "../actions";

export function RdPanel({ donationId, needTaxDeduction }: { donationId: string; needTaxDeduction: boolean }) {
  const [checked, setChecked] = useState(false);
  const { onSubmit, pending } = useConfirmedAction(approveRdSubmission, {
    title: "ยืนยันอนุมัติครั้งที่ 2?",
    content: needTaxDeduction ? "สถานะจะเปลี่ยนเป็น “ส่งสรรพากรแล้ว” และระบบจะส่งอีเมลยืนยันถึงผู้บริจาค" : "สถานะจะเปลี่ยนเป็น “ส่งสรรพากรแล้ว” (ไม่ส่งอีเมล)",
    okText: "อนุมัติ",
  });
  return (
    <section className="admin-panel admin-review" aria-labelledby="rd-title">
      <div className="admin-panel-head"><h2 id="rd-title">อนุมัติครั้งที่ 2 (ส่งเมลยืนยัน)</h2></div>
      <p className="admin-review-note admin-review-lead">
        {needTaxDeduction
          ? "หลังกองคลังยืนยันและนำชื่อกับเลขผู้เสียภาษีกรอกลงระบบ e-Donation ของกรมสรรพากรแล้ว ให้กดอนุมัติเพื่อส่งอีเมลแจ้งผู้บริจาค"
          : "ผู้บริจาคไม่ประสงค์ใช้สิทธิ์ลดหย่อนภาษี กดอนุมัติเพื่อปิดรายการ (ไม่ส่งอีเมล)"}
      </p>
      <form onSubmit={onSubmit}>
        <input type="hidden" name="donationId" value={donationId} />
        <fieldset className="admin-checklist">
          <legend>ยืนยันว่าดำเนินการแล้ว</legend>
          <label>
            <input type="checkbox" name="checkKeyed" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>{needTaxDeduction ? "กองคลังยืนยันแล้ว และคีย์ข้อมูลเข้าระบบ e-Donation กรมสรรพากรเรียบร้อย" : "กองคลังยืนยันรายการนี้แล้ว"}</span>
          </label>
        </fieldset>
        <button type="submit" className="admin-button admin-button-block" disabled={!checked || pending}>{pending ? "กำลังอนุมัติ…" : needTaxDeduction ? "อนุมัติครั้งที่ 2 และส่งอีเมลยืนยัน" : "อนุมัติครั้งที่ 2"}</button>
      </form>
    </section>
  );
}

export function ResendEmail({ donationId, kind, label, allowRegenerate = false }: { donationId: string; kind: "certificate" | "rd"; label: string; allowRegenerate?: boolean }) {
  const { onSubmit, pending } = useConfirmedAction(resendDonorEmail, { title: `${label}?`, content: "ระบบจะส่งอีเมลถึงผู้บริจาคอีกครั้ง", okText: "ส่งอีเมล" });
  return (
    <form onSubmit={onSubmit} className="admin-resend">
      <input type="hidden" name="donationId" value={donationId} />
      <input type="hidden" name="kind" value={kind} />
      {allowRegenerate && <label><input type="checkbox" name="regenerate" /> สร้าง PDF ใหม่ตามการตั้งค่าล่าสุด</label>}
      <button type="submit" className="admin-button admin-button-small admin-button-ghost" disabled={pending}>{pending ? "กำลังส่ง…" : label}</button>
    </form>
  );
}

const CHECKS = [
  { name: "checkSlip", label: "ยอดเงินและวัน–เวลาในสลิปตรงกับรายการเงินเข้าใน Book Bank" },
  { name: "checkName", label: "ชื่อผู้บริจาคตรงกับชื่อผู้โอนในสลิป / Book Bank" },
  { name: "checkTaxId", label: "เลขผู้เสียภาษี 13 หลักถูกต้องตามที่ผู้บริจาคแจ้ง" },
];

export function ReviewPanel({ donationId }: { donationId: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const allChecked = CHECKS.every((check) => checked[check.name]);
  const { onSubmit: onApprove, pending: approving } = useConfirmedAction(approveSlip, { title: "ยืนยันอนุมัติครั้งที่ 1?", content: "ระบบจะออกเลขที่ใบอนุโมทนาบัตร ส่งอีเมลถึงผู้บริจาค และเปลี่ยนสถานะเป็น “รอยืนยันกองคลัง”", okText: "อนุมัติ" });
  const { onSubmit: onReject, pending: rejecting } = useConfirmedAction(rejectSlip, { title: "ยืนยันไม่อนุมัติรายการนี้?", content: "สถานะจะเปลี่ยนเป็น “ไม่อนุมัติ” และย้อนกลับไม่ได้", okText: "ไม่อนุมัติ", danger: true });

  return (
    <section className="admin-panel admin-review" aria-labelledby="review-title">
      <div className="admin-panel-head"><h2 id="review-title">อนุมัติครั้งที่ 1 (ตรวจสลิป)</h2></div>
      <div className="admin-review-tabs" role="group" aria-label="ผลการตรวจ">
        <button type="button" aria-pressed={mode === "approve"} onClick={() => setMode("approve")}>อนุมัติ</button>
        <button type="button" aria-pressed={mode === "reject"} onClick={() => setMode("reject")}>ไม่อนุมัติ</button>
      </div>

      {mode === "approve" ? (
        <form onSubmit={onApprove}>
          <input type="hidden" name="donationId" value={donationId} />
          <fieldset className="admin-checklist">
            <legend>ยืนยันว่าตรวจสอบแล้ว</legend>
            {CHECKS.map((check) => (
              <label key={check.name}>
                <input type="checkbox" name={check.name} checked={!!checked[check.name]} onChange={(e) => setChecked({ ...checked, [check.name]: e.target.checked })} />
                <span>{check.label}</span>
              </label>
            ))}
          </fieldset>
          <p className="admin-review-note">เมื่ออนุมัติ ระบบจะออกเลขที่ใบอนุโมทนาบัตรและเปลี่ยนสถานะเป็น “รอยืนยันกองคลัง”</p>
          <button type="submit" className="admin-button admin-button-block" disabled={!allChecked || approving || rejecting}>{approving ? "กำลังอนุมัติ…" : "อนุมัติและออกใบอนุโมทนาบัตร"}</button>
        </form>
      ) : (
        <form onSubmit={onReject}>
          <input type="hidden" name="donationId" value={donationId} />
          <label className="admin-field" htmlFor="reason">เหตุผลที่ไม่อนุมัติ (แจ้งผู้บริจาคเมื่อติดต่อกลับ)</label>
          <textarea id="reason" name="reason" rows={4} minLength={5} maxLength={1000} required placeholder="เช่น ไม่พบยอดเงินเข้าใน Book Bank ตามวันเวลาที่แจ้ง" />
          <button type="submit" className="admin-button admin-button-block admin-button-danger" disabled={approving || rejecting}>{rejecting ? "กำลังบันทึก…" : "บันทึกว่าไม่อนุมัติ"}</button>
        </form>
      )}
    </section>
  );
}

export function TaxIdReveal({ donationId, masked }: { donationId: string; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  function reveal() {
    startTransition(async () => {
      const result = await revealTaxId(donationId);
      if ("taxId" in result) setValue(result.taxId);
      else message.error(result.error);
    });
  }

  return (
    <span className="admin-taxid">
      <span className="admin-mono">{value ?? masked}</span>
      {value ? (
        <button type="button" onClick={() => setValue(null)}>ซ่อน</button>
      ) : (
        <button type="button" onClick={reveal} disabled={pending} title="การดูเลขเต็มจะถูกบันทึกในประวัติ">{pending ? "กำลังโหลด…" : "แสดงเลขเต็ม"}</button>
      )}
    </span>
  );
}
