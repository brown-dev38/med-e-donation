"use client";

import { startTransition, useActionState } from "react";
import type { FormEvent } from "react";
import { addStudents, saveCertificateSettings, type SettingsState } from "./actions";

/**
 * Submits without React's automatic form reset, so a validation error does not wipe what the
 * admin typed or ticked (a reset puts uncontrolled inputs back to their saved defaults).
 */
export function submitWithoutReset(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}

export function Message({ state }: { state: SettingsState }) {
  if (!state) return null;
  return <p className={state.status === "error" ? "admin-form-error" : "admin-form-success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

export function AddStudentsForm() {
  const [state, action, pending] = useActionState(addStudents, null);
  return (
    <form action={action} className="admin-panel">
      <div className="admin-panel-head"><h2>เพิ่มรายชื่อนิสิต</h2></div>
      <label className="admin-field" htmlFor="students">หนึ่งบรรทัดต่อหนึ่งคน: ชื่อ–นามสกุล, รหัสนิสิต, ชั้นปี (รหัสและชั้นปีไม่บังคับ) วางจาก Excel ได้</label>
      <textarea className="admin-input" id="students" name="students" rows={6} placeholder={"นายสมชาย ใจดี, 65000001, 3\nนางสาวสมหญิง รักเรียน, 66000002, 2"} />
      <Message state={state} />
      <button type="submit" className="admin-button" disabled={pending}>{pending ? "กำลังเพิ่ม…" : "เพิ่มรายชื่อ"}</button>
    </form>
  );
}

export type CertificateSettingsForm = Record<
  "orgName" | "title" | "subtitle" | "bodyText" | "blessingText" | "footerNote" | "signerName" | "signerPosition" | "certificateEmailSubject" | "certificateEmailBody" | "rdEmailSubject" | "rdEmailBody",
  string
> & { hasSignature: boolean };

export function CertificateSettingsEditor({ settings, fields }: { settings: CertificateSettingsForm; fields: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveCertificateSettings, null);
  const text = (name: keyof CertificateSettingsForm, label: string, rows = 0, max = 255) => (
    <div className="admin-field-block">
      <label className="admin-field" htmlFor={name}>{label}</label>
      {rows ? <textarea className="admin-input" id={name} name={name} defaultValue={String(settings[name])} rows={rows} maxLength={max} /> : <input className="admin-input" id={name} name={name} defaultValue={String(settings[name])} maxLength={max} />}
    </div>
  );
  return (
    <form onSubmit={submitWithoutReset(action)} className="admin-settings-stack">
      <section className="admin-panel">
        <div className="admin-panel-head"><h2>ข้อความบนใบอนุโมทนาบัตร</h2><a href="/admin/settings/certificate/preview" target="_blank" rel="noopener noreferrer">ดูตัวอย่าง PDF (ตามที่บันทึกไว้) ↗</a></div>
        <div className="admin-two">{text("orgName", "ชื่อหน่วยงาน")}{text("title", "หัวเรื่อง")}</div>
        <div className="admin-two">{text("subtitle", "หัวเรื่องรอง (ภาษาอังกฤษ)")}{text("bodyText", "ข้อความก่อนชื่อผู้บริจาค")}</div>
        {text("blessingText", "คำอวยพร", 2, 1000)}
        {text("footerNote", "หมายเหตุท้ายเอกสาร", 2, 1000)}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head"><h2>ผู้ลงนาม</h2></div>
        <div className="admin-two">{text("signerName", "ชื่อผู้ลงนาม")}{text("signerPosition", "ตำแหน่ง")}</div>
        <div className="admin-signature">
          {settings.hasSignature
            // eslint-disable-next-line @next/next/no-img-element -- private admin-only image
            ? <img src="/admin/settings/signature" alt="ลายเซ็นปัจจุบัน" />
            : <span className="admin-hint">ยังไม่มีภาพลายเซ็น (ใบอนุโมทนาบัตรจะเว้นที่ว่างไว้)</span>}
          <div>
            <label className="admin-field" htmlFor="signature">อัปโหลดภาพลายเซ็น (PNG พื้นใส หรือ JPG ไม่เกิน 1 MB)</label>
            <input id="signature" name="signature" type="file" accept="image/png,image/jpeg" />
            {settings.hasSignature && <label className="admin-check"><input type="checkbox" name="removeSignature" /> ลบภาพลายเซ็น</label>}
          </div>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head"><h2>อีเมลถึงผู้บริจาค</h2></div>
        <p className="admin-hint">ใช้ตัวแปรในวงเล็บปีกกาได้: {Object.entries(fields).map(([key, label]) => <code key={key} title={label}>{`{${key}}`}</code>)}</p>
        <h3 className="admin-subhead">ฉบับที่ 1 — หลังอนุมัติครั้งที่ 1 (แนบใบอนุโมทนาบัตร PDF)</h3>
        {text("certificateEmailSubject", "หัวเรื่องอีเมล")}
        {text("certificateEmailBody", "เนื้อหาอีเมล", 9, 5000)}
        <h3 className="admin-subhead">ฉบับที่ 2 — หลังอนุมัติครั้งที่ 2 (ส่งข้อมูลสรรพากรแล้ว)</h3>
        {text("rdEmailSubject", "หัวเรื่องอีเมล")}
        {text("rdEmailBody", "เนื้อหาอีเมล", 8, 5000)}
      </section>
      <div className="admin-sticky-save">
        <Message state={state} />
        <button type="submit" className="admin-button" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button>
      </div>
    </form>
  );
}
