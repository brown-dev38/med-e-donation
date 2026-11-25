"use client";

import { useActionState, useState, useTransition } from "react";
import { approveRdSubmission, approveSlip, rejectSlip, resendDonorEmail, revealTaxId } from "../actions";

export function RdPanel({ donationId, needTaxDeduction }: { donationId: string; needTaxDeduction: boolean }) {
  const [state, action, pending] = useActionState(approveRdSubmission, null);
  const [checked, setChecked] = useState(false);
  return (
    <section className="admin-panel admin-review" aria-labelledby="rd-title">
      <div className="admin-panel-head"><h2 id="rd-title">อนุมัติครั้งที่ 2 (ส่งเมลยืนยัน)</h2></div>
      <p className="admin-review-note admin-review-lead">
        {needTaxDeduction
          ? "หลังกองคลังยืนยันและนำชื่อกับเลขผู้เสียภาษีกรอกลงระบบ e-Donation ของกรมสรรพากรแล้ว ให้กดอนุมัติเพื่อส่งอีเมลแจ้งผู้บริจาค"
          : "ผู้บริจาคไม่ประสงค์ใช้สิทธิ์ลดหย่อนภาษี กดอนุมัติเพื่อปิดรายการ (ไม่ส่งอีเมล)"}
      </p>
      <form action={action}>
        <input type="hidden" name="donationId" value={donationId} />
        <fieldset className="admin-checklist">
          <legend>ยืนยันว่าดำเนินการแล้ว</legend>
          <label>
            <input type="checkbox" name="checkKeyed" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>{needTaxDeduction ? "กองคลังยืนยันแล้ว และคีย์ข้อมูลเข้าระบบ e-Donation กรมสรรพากรเรียบร้อย" : "กองคลังยืนยันรายการนี้แล้ว"}</span>
          </label>
        </fieldset>
        {state?.status === "error" && <p className="admin-form-error" role="alert">{state.message}</p>}
        <button type="submit" className="admin-button admin-button-block" disabled={!checked || pending}>{pending ? "กำลังอนุมัติ…" : needTaxDeduction ? "อนุมัติครั้งที่ 2 และส่งอีเมลยืนยัน" : "อนุมัติครั้งที่ 2"}</button>
      </form>
    </section>
  );
}

export function ResendEmail({ donationId, kind, label, allowRegenerate = false }: { donationId: string; kind: "certificate" | "rd"; label: string; allowRegenerate?: boolean }) {
  const [state, action, pending] = useActionState(resendDonorEmail, null);
  return (
    <form action={action} className="admin-resend">
      <input type="hidden" name="donationId" value={donationId} />
      <input type="hidden" name="kind" value={kind} />
      {allowRegenerate && <label><input type="checkbox" name="regenerate" /> สร้าง PDF ใหม่ตามการตั้งค่าล่าสุด</label>}
      <button type="submit" className="admin-button admin-button-small admin-button-ghost" disabled={pending}>{pending ? "กำลังส่ง…" : label}</button>
      {state && <span className={state.status === "error" ? "admin-form-error" : "admin-form-success"} role="status">{state.message}</span>}
    </form>
  );
}

const CHECKS = [
  { name: "checkSlip", label: "ยอดเงินและวัน–เวลาในสลิปตรงกับรายการเงินเข้าใน Book Bank" },
  { name: "checkName", label: "ชื่อผู้บริจาคตรงกับชื่อผู้โอนในสลิป / Book Bank" },
  { name: "checkTaxId", label: "เลขผู้เสียภาษี 13 หลักถูกต้องตามที่ผู้บริจาคแจ้ง" },
];

export function ReviewPanel({ donationId }: { donationId: string }) {
  const [approveState, approve, approving] = useActionState(approveSlip, null);
  const [rejectState, reject, rejecting] = useActionState(rejectSlip, null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const allChecked = CHECKS.every((check) => checked[check.name]);
  const busy = approving || rejecting;

  return (
    <section className="admin-panel admin-review" aria-labelledby="review-title">
      <div className="admin-panel-head"><h2 id="review-title">อนุมัติครั้งที่ 1 (ตรวจสลิป)</h2></div>
      <div className="admin-review-tabs" role="group" aria-label="ผลการตรวจ">
        <button type="button" aria-pressed={mode === "approve"} onClick={() => setMode("approve")}>อนุมัติ</button>
        <button type="button" aria-pressed={mode === "reject"} onClick={() => setMode("reject")}>ไม่อนุมัติ</button>
      </div>

      {mode === "approve" ? (
        <form action={approve}>
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
          {approveState?.status === "error" && <p className="admin-form-error" role="alert">{approveState.message}</p>}
          <button type="submit" className="admin-button admin-button-block" disabled={!allChecked || busy}>{approving ? "กำลังอนุมัติ…" : "อนุมัติและออกใบอนุโมทนาบัตร"}</button>
        </form>
      ) : (
        <form action={reject}>
          <input type="hidden" name="donationId" value={donationId} />
          <label className="admin-field" htmlFor="reason">เหตุผลที่ไม่อนุมัติ (แจ้งผู้บริจาคเมื่อติดต่อกลับ)</label>
          <textarea id="reason" name="reason" rows={4} minLength={5} maxLength={1000} required placeholder="เช่น ไม่พบยอดเงินเข้าใน Book Bank ตามวันเวลาที่แจ้ง" />
          {rejectState?.status === "error" && <p className="admin-form-error" role="alert">{rejectState.message}</p>}
          <button type="submit" className="admin-button admin-button-block admin-button-danger" disabled={busy}>{rejecting ? "กำลังบันทึก…" : "บันทึกว่าไม่อนุมัติ"}</button>
        </form>
      )}
    </section>
  );
}

export function TaxIdReveal({ donationId, masked }: { donationId: string; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reveal() {
    startTransition(async () => {
      const result = await revealTaxId(donationId);
      if ("taxId" in result) { setValue(result.taxId); setError(null); }
      else setError(result.error);
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
      {error && <span className="admin-form-error" role="alert">{error}</span>}
    </span>
  );
}
