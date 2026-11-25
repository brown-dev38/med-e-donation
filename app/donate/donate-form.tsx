"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  bangkokNow,
  DONOR_PREFIXES,
  emptyDonationFields,
  normalizeAmount,
  PRESET_AMOUNTS,
  validateDonation,
  validateSlipFile,
  type DonationFields,
  type FieldErrors,
  type FieldName,
} from "@/lib/donation-form";
import ThaiQr from "@/app/components/promptpay-qr";
import type { QrTarget } from "@/lib/promptpay";
import { submitDonation } from "./actions";

export type FundOption = {
  fundCode: string;
  fundNameTh: string;
  fundDescription: string;
  requiresStudentName: boolean;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  qr: QrTarget | null;
};

export type StudentChoice = { fullName: string; studentCode: string | null; yearLevel: number | null };

const FIELD_ORDER: FieldName[] = ["fundCode", "studentRecipientName", "studentRecipientCode", "amount", "donorType", "donorPrefix", "donorName", "taxId", "phone", "email", "transferDate", "transferTime", "slip", "pdpaConsent"];
const formatBaht = (amount: string) => Number(amount).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Field({ id, label, error, hint, required, children }: { id: string; label: string; error?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className={`donate-field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}{required && <span className="donate-required" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && !error && <p className="donate-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="donate-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

function StepHeading({ number, title, detail }: { number: number; title: string; detail?: string }) {
  return (
    <div className="donate-step-heading">
      <span className="donate-step-number" aria-hidden="true">{number}</span>
      <div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>
    </div>
  );
}

export default function DonateForm(props: { funds: FundOption[]; students: StudentChoice[]; initialFund: string }) {
  // Remounting the form is the simplest way to clear action state for another donation.
  const [formKey, setFormKey] = useState(0);
  return <DonateFormInner key={formKey} {...props} onReset={() => { setFormKey(formKey + 1); window.scrollTo({ top: 0 }); }} />;
}

function DonateFormInner({ funds: fundOptions, students, initialFund, onReset }: { funds: FundOption[]; students: StudentChoice[]; initialFund: string; onReset: () => void }) {
  // Same rule input as the server: a non-empty student list means donors must pick from it.
  const funds = fundOptions.map((item) => ({ ...item, students }));
  const [state, dispatch, pending] = useActionState(submitDonation, null);
  const [fields, setFields] = useState<DonationFields>(() => ({ ...emptyDonationFields(), fundCode: initialFund }));
  const [slip, setSlip] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipError, setSlipError] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [edited, setEdited] = useState<Set<FieldName>>(new Set());
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const fund = funds.find((item) => item.fundCode === fields.fundCode) ?? funds[0];
  const amount = normalizeAmount(fields.amount);
  const serverErrors = state?.status === "error" ? state.fieldErrors ?? {} : {};
  const sourceErrors = clientErrors ?? serverErrors;
  const errors: FieldErrors = Object.fromEntries(Object.entries(sourceErrors).filter(([name]) => !edited.has(name as FieldName)));
  if (slipError) errors.slip = slipError;
  const hasFieldErrors = Object.keys(errors).length > 0;
  // Field problems hide the summary once fixed; a server failure without field errors stays until resubmitted.
  const alertMessage = hasFieldErrors
    ? "กรุณาตรวจสอบข้อมูลที่ไฮไลต์ไว้"
    : !clientErrors && state?.status === "error" && !state.fieldErrors ? state.message : null;
  const today = bangkokNow().date;

  const markEdited = (name: FieldName) => setEdited((current) => (current.has(name) ? current : new Set(current).add(name)));
  const update = <K extends keyof DonationFields>(name: K, value: DonationFields[K]) => {
    setFields((current) => ({ ...current, [name]: value }));
    markEdited(name);
  };
  const describedBy = (name: FieldName, hint = false) => (errors[name] ? `${name}-error` : hint ? `${name}-hint` : undefined);

  function chooseDonorType(type: keyof typeof DONOR_PREFIXES) {
    setFields((current) => ({ ...current, donorType: type, donorPrefix: (DONOR_PREFIXES[type] as readonly string[]).includes(current.donorPrefix) ? current.donorPrefix : "" }));
    markEdited("donorType");
    markEdited("donorPrefix");
  }

  function chooseSlip(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return; // dialog cancelled: keep the current slip
    const error = validateSlipFile(file);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = error ? null : URL.createObjectURL(file);
    setSlipPreview(previewRef.current);
    setSlip(file);
    setSlipError(error);
    markEdited("slip");
  }

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(fund.bankAccountNo.replace(/\D/g, "") || fund.bankAccountNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    // Submit manually so React does not reset the form (and the chosen slip) on a server error.
    event.preventDefault();
    if (pending) return;
    const result = validateDonation(fields, funds);
    const nextErrors: FieldErrors = result.ok ? {} : { ...result.errors };
    const fileError = validateSlipFile(slip);
    if (fileError) nextErrors.slip = fileError;
    setEdited(new Set());
    const firstError = FIELD_ORDER.find((name) => nextErrors[name]);
    if (firstError) {
      setClientErrors(nextErrors);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-field="${firstError}"]`)?.focus());
      return;
    }
    setClientErrors(null);
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      if (typeof value === "boolean") { if (value) formData.set(name, "on"); }
      else formData.set(name, value);
    }
    formData.set("slip", slip!);
    startTransition(() => dispatch(formData));
  }

  useEffect(() => {
    if (state?.status === "success") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state]);

  if (state?.status === "success") {
    return (
      <section className="donate-success" aria-labelledby="success-title">
        <div className="donate-success-icon" aria-hidden="true">✓</div>
        <p className="donate-eyebrow"><span /> THANK YOU</p>
        <h2 id="success-title">ได้รับข้อมูลการบริจาคเรียบร้อยแล้ว</h2>
        <p>ขออนุโมทนาในกุศลเจตนาของท่าน เจ้าหน้าที่จะตรวจสอบสลิปและส่งใบอนุโมทนาบัตร (PDF) ไปที่ <strong>{state.email}</strong></p>
        <dl className="donate-success-details">
          <div><dt>เลขอ้างอิงรายการ</dt><dd className="donate-reference">{state.referenceNo}</dd></div>
          <div><dt>วัตถุประสงค์</dt><dd>{state.fundName}</dd></div>
          <div><dt>จำนวนเงิน</dt><dd>{formatBaht(state.amount)} บาท</dd></div>
          <div><dt>สถานะ</dt><dd><span className="donate-status">รอตรวจสอบสลิป</span></dd></div>
        </dl>
        <div className="donate-notice">
          <strong>โปรดบันทึกเลขอ้างอิงไว้</strong>
          <p>ข้อมูลลดหย่อนภาษีจะถูกนำส่งระบบ e-Donation ของกรมสรรพากรภายใน 2 สัปดาห์หลังตรวจสอบยอดโอน หากพ้นกำหนดแล้วยังไม่พบข้อมูล กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งเลขอ้างอิงนี้</p>
        </div>
        <div className="donate-success-actions">
          <Link href="/" className="donate-button">กลับหน้าแรก</Link>
          <button type="button" className="donate-button donate-button-ghost" onClick={onReset}>บริจาคเพิ่มอีกรายการ</button>
        </div>
      </section>
    );
  }

  const prefixes = DONOR_PREFIXES[fields.donorType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL"];
  const isCorporate = fields.donorType === "CORPORATE";

  return (
    <form ref={formRef} className="donate-layout" onSubmit={submit} noValidate aria-busy={pending}>
      <div className="donate-steps">
        {alertMessage && <div className="donate-alert" role="alert">{alertMessage}</div>}

        <section className="donate-card" aria-labelledby="step-1">
          <StepHeading number={1} title="เลือกวัตถุประสงค์การบริจาค" />
          <fieldset className="donate-options" aria-describedby={describedBy("fundCode")}>
            <legend id="step-1" className="sr-only">วัตถุประสงค์การบริจาค</legend>
            {funds.map((item, index) => (
              <label key={item.fundCode} className={`donate-option ${fields.fundCode === item.fundCode ? "is-selected" : ""}`}>
                <input type="radio" name="fundCode" value={item.fundCode} checked={fields.fundCode === item.fundCode} onChange={() => update("fundCode", item.fundCode)} data-field={index === 0 ? "fundCode" : undefined} />
                <span className="donate-option-body"><strong>{item.fundNameTh}</strong>{item.fundDescription && <span>{item.fundDescription}</span>}</span>
              </label>
            ))}
          </fieldset>
          {errors.fundCode && <p className="donate-error" id="fundCode-error">{errors.fundCode}</p>}
          {fund.requiresStudentName && students.length > 0 && (
            <div className="donate-student">
              <Field id="studentRecipientName" label="เลือกนิสิตผู้รับทุน" required error={errors.studentRecipientName}>
                <select id="studentRecipientName" data-field="studentRecipientName" value={fields.studentRecipientName} onChange={(e) => update("studentRecipientName", e.target.value)} aria-invalid={!!errors.studentRecipientName} aria-describedby={describedBy("studentRecipientName")}>
                  <option value="">เลือกรายชื่อนิสิต</option>
                  {students.map((student) => (
                    <option key={student.fullName} value={student.fullName}>
                      {student.fullName}{student.yearLevel ? ` · ชั้นปีที่ ${student.yearLevel}` : ""}{student.studentCode ? ` · ${student.studentCode}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {fund.requiresStudentName && students.length === 0 && (
            <div className="donate-grid donate-student">
              <Field id="studentRecipientName" label="ชื่อ–นามสกุลนิสิตผู้รับทุน" required error={errors.studentRecipientName}>
                <input id="studentRecipientName" data-field="studentRecipientName" value={fields.studentRecipientName} onChange={(e) => update("studentRecipientName", e.target.value)} maxLength={255} autoComplete="off" aria-invalid={!!errors.studentRecipientName} aria-describedby={describedBy("studentRecipientName")} />
              </Field>
              <Field id="studentRecipientCode" label="รหัสนิสิต (ถ้าทราบ)" error={errors.studentRecipientCode}>
                <input id="studentRecipientCode" data-field="studentRecipientCode" value={fields.studentRecipientCode} onChange={(e) => update("studentRecipientCode", e.target.value)} maxLength={20} autoComplete="off" aria-invalid={!!errors.studentRecipientCode} aria-describedby={describedBy("studentRecipientCode")} />
              </Field>
            </div>
          )}
        </section>

        <section className="donate-card" aria-labelledby="step-2-title">
          <StepHeading number={2} title="จำนวนเงินและประเภทผู้บริจาค" />
          <h3 id="step-2-title" className="donate-subheading">จำนวนเงินบริจาค (บาท)</h3>
          <div className="donate-presets" role="group" aria-label="จำนวนเงินสำเร็จรูป">
            {PRESET_AMOUNTS.map((preset) => (
              <button key={preset} type="button" className={amount === preset.toFixed(2) ? "is-selected" : ""} aria-pressed={amount === preset.toFixed(2)} onClick={() => update("amount", String(preset))}>
                {preset.toLocaleString("th-TH")} ฿
              </button>
            ))}
          </div>
          <Field id="amount" label="หรือระบุจำนวนเงินเอง" required error={errors.amount}>
            <div className="donate-input-suffix">
              <input id="amount" data-field="amount" inputMode="decimal" value={fields.amount} onChange={(e) => update("amount", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="เช่น 1500" aria-invalid={!!errors.amount} aria-describedby={describedBy("amount")} />
              <span>บาท</span>
            </div>
          </Field>
          <h3 className="donate-subheading">ประเภทผู้บริจาค</h3>
          <div className="donate-toggle" role="radiogroup" aria-label="ประเภทผู้บริจาค">
            {(["INDIVIDUAL", "CORPORATE"] as const).map((type) => (
              <label key={type} className={fields.donorType === type ? "is-selected" : ""}>
                <input type="radio" name="donorType" value={type} checked={fields.donorType === type} onChange={() => chooseDonorType(type)} />
                {type === "INDIVIDUAL" ? "บุคคลธรรมดา" : "นิติบุคคล / องค์กร"}
              </label>
            ))}
          </div>
        </section>

        <section className="donate-card" aria-labelledby="step-3-title">
          <StepHeading number={3} title="โอนเงินเข้าบัญชีกองทุน" detail={fund.qr ? "สแกน QR ด้วยแอปธนาคาร หรือโอนเข้าบัญชี แล้วเก็บสลิปไว้แนบในขั้นตอนถัดไป" : "โอนผ่าน Mobile Banking ได้ทุกธนาคาร แล้วเก็บสลิปไว้แนบในขั้นตอนถัดไป"} />
          <h3 id="step-3-title" className="sr-only">ข้อมูลบัญชีรับบริจาค</h3>
          <div className={`donate-pay ${fund.qr ? "has-qr" : ""}`}>
            {fund.qr && (
              <div className="donate-qr">
                <ThaiQr target={fund.qr} amount={amount} size={210} caption={fund.qr.type === "BANK_ACCOUNT" ? fund.bankName : undefined} />
                <p>{amount ? `QR นี้ระบุยอด ${formatBaht(amount)} บาทไว้แล้ว` : "เลือกจำนวนเงินก่อน QR จะระบุยอดให้อัตโนมัติ"}</p>
              </div>
            )}
            <div className="donate-bank">
              <div><span>ธนาคาร</span><strong>{fund.bankName}</strong></div>
              <div><span>เลขที่บัญชี</span><strong className="donate-account">{fund.bankAccountNo}</strong></div>
              <div><span>ชื่อบัญชี</span><strong>{fund.bankAccountName}</strong></div>
              <div><span>ยอดที่ต้องโอน</span><strong className="donate-bank-amount">{amount ? `${formatBaht(amount)} บาท` : "—"}</strong></div>
              <button type="button" className="donate-button donate-button-ghost" onClick={copyAccount}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกเลขที่บัญชี"}</button>
              <span className="sr-only" aria-live="polite">{copied ? "คัดลอกเลขที่บัญชีแล้ว" : ""}</span>
            </div>
          </div>
        </section>

        <section className="donate-card" aria-labelledby="step-4-title">
          <StepHeading number={4} title="ข้อมูลผู้บริจาคและสลิปโอนเงิน" detail="ใช้สำหรับออกใบอนุโมทนาบัตรและนำส่งข้อมูล e-Donation กรุณากรอกให้ตรงกับชื่อเจ้าของเลขผู้เสียภาษี" />
          <h3 id="step-4-title" className="sr-only">ข้อมูลผู้บริจาค</h3>
          <div className="donate-grid donate-grid-name">
            <Field id="donorPrefix" label={isCorporate ? "ประเภทนิติบุคคล" : "คำนำหน้า"} required error={errors.donorPrefix}>
              <select id="donorPrefix" data-field="donorPrefix" value={fields.donorPrefix} onChange={(e) => update("donorPrefix", e.target.value)} aria-invalid={!!errors.donorPrefix} aria-describedby={describedBy("donorPrefix")}>
                <option value="">เลือก</option>
                {prefixes.map((prefix) => <option key={prefix} value={prefix}>{prefix}</option>)}
              </select>
            </Field>
            <Field id="donorName" label={isCorporate ? "ชื่อนิติบุคคล / องค์กร" : "ชื่อ–นามสกุล"} required error={errors.donorName}>
              <input id="donorName" data-field="donorName" value={fields.donorName} onChange={(e) => update("donorName", e.target.value)} maxLength={255} autoComplete={isCorporate ? "organization" : "name"} aria-invalid={!!errors.donorName} aria-describedby={describedBy("donorName")} />
            </Field>
          </div>
          <div className="donate-grid">
            <Field id="taxId" label={isCorporate ? "เลขประจำตัวผู้เสียภาษีนิติบุคคล (13 หลัก)" : "เลขประจำตัวผู้เสียภาษี / เลขบัตรประชาชน (13 หลัก)"} required error={errors.taxId} hint="ใช้นำส่งข้อมูลลดหย่อนภาษีกับกรมสรรพากร ระบบจัดเก็บแบบเข้ารหัส">
              <input id="taxId" data-field="taxId" inputMode="numeric" value={fields.taxId} onChange={(e) => update("taxId", e.target.value.replace(/\D/g, "").slice(0, 13))} autoComplete="off" placeholder="x xxxx xxxxx xx x" aria-invalid={!!errors.taxId} aria-describedby={describedBy("taxId", true)} />
            </Field>
            <Field id="phone" label="เบอร์โทรศัพท์" required error={errors.phone}>
              <input id="phone" data-field="phone" type="tel" inputMode="tel" value={fields.phone} onChange={(e) => update("phone", e.target.value)} maxLength={20} autoComplete="tel" placeholder="0812345678" aria-invalid={!!errors.phone} aria-describedby={describedBy("phone")} />
            </Field>
          </div>
          <Field id="email" label="อีเมลสำหรับรับใบอนุโมทนาบัตร (PDF)" required error={errors.email} hint="กรุณาตรวจสอบให้ถูกต้อง ใบอนุโมทนาบัตรจะส่งไปที่อีเมลนี้">
            <input id="email" data-field="email" type="email" value={fields.email} onChange={(e) => update("email", e.target.value)} maxLength={255} autoComplete="email" aria-invalid={!!errors.email} aria-describedby={describedBy("email", true)} />
          </Field>
          <div className="donate-grid">
            <Field id="transferDate" label="วันที่โอนเงิน (ตามสลิป)" required error={errors.transferDate}>
              <input id="transferDate" data-field="transferDate" type="date" max={today} value={fields.transferDate} onChange={(e) => update("transferDate", e.target.value)} aria-invalid={!!errors.transferDate} aria-describedby={describedBy("transferDate")} />
            </Field>
            <Field id="transferTime" label="เวลาที่โอนเงิน (ตามสลิป)" required error={errors.transferTime}>
              <input id="transferTime" data-field="transferTime" type="time" value={fields.transferTime} onChange={(e) => update("transferTime", e.target.value)} aria-invalid={!!errors.transferTime} aria-describedby={describedBy("transferTime")} />
            </Field>
          </div>

          <div className={`donate-field ${errors.slip ? "has-error" : ""}`}>
            <span className="donate-label" id="slip-label">สลิปโอนเงิน (JPG หรือ PNG ไม่เกิน 5 MB)<span className="donate-required" aria-hidden="true"> *</span></span>
            <div className={`donate-upload ${slip && !errors.slip ? "has-file" : ""}`}>
              {slipPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not an optimizable asset
                <img src={slipPreview} alt="ตัวอย่างสลิปโอนเงินที่เลือก" className="donate-upload-preview" />
              ) : (
                <span className="donate-upload-icon" aria-hidden="true">⇪</span>
              )}
              <div className="donate-upload-copy">
                <strong>{slip && !errors.slip ? slip.name : "เลือกไฟล์สลิปจากเครื่อง"}</strong>
                <span>{slip && !errors.slip ? `${(slip.size / 1024 / 1024).toFixed(2)} MB · พร้อมส่งให้เจ้าหน้าที่ตรวจสอบ` : "ถ่ายภาพหน้าจอสลิปจากแอปธนาคารให้เห็นยอดเงินและวันเวลาชัดเจน"}</span>
              </div>
              <button type="button" className="donate-button donate-button-ghost" onClick={() => fileRef.current?.click()} data-field="slip" aria-describedby={errors.slip ? "slip-error" : undefined} aria-labelledby="slip-label slip-button-text">
                <span id="slip-button-text">{slip ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}</span>
              </button>
              <input ref={fileRef} id="slip" type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} onChange={chooseSlip} aria-hidden="true" />
            </div>
            {errors.slip && <p className="donate-error" id="slip-error">{errors.slip}</p>}
          </div>

          <label className="donate-check">
            <input type="checkbox" checked={fields.needTaxDeduction} onChange={(e) => update("needTaxDeduction", e.target.checked)} />
            <span>ต้องการใช้สิทธิ์ลดหย่อนภาษีผ่านระบบ e-Donation ของกรมสรรพากร</span>
          </label>
          <label className={`donate-check ${errors.pdpaConsent ? "has-error" : ""}`}>
            <input type="checkbox" data-field="pdpaConsent" checked={fields.pdpaConsent} onChange={(e) => update("pdpaConsent", e.target.checked)} aria-invalid={!!errors.pdpaConsent} aria-describedby={describedBy("pdpaConsent")} />
            <span>ข้าพเจ้ายินยอมให้คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา เก็บและใช้ข้อมูลส่วนบุคคลข้างต้น เพื่อออกใบอนุโมทนาบัตรและนำส่งข้อมูลการบริจาคให้กรมสรรพากร ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562<span className="donate-required" aria-hidden="true"> *</span></span>
          </label>
          {errors.pdpaConsent && <p className="donate-error" id="pdpaConsent-error">{errors.pdpaConsent}</p>}
        </section>
      </div>

      <aside className="donate-summary" aria-label="สรุปรายการบริจาค">
        <div className="donate-summary-card">
          <p className="donate-eyebrow"><span /> SUMMARY</p>
          <h2>สรุปรายการบริจาค</h2>
          <dl>
            <div><dt>วัตถุประสงค์</dt><dd>{fund.fundNameTh}</dd></div>
            {fund.requiresStudentName && <div><dt>นิสิตผู้รับทุน</dt><dd>{fields.studentRecipientName.trim() || "—"}</dd></div>}
            <div><dt>ผู้บริจาค</dt><dd>{fields.donorName.trim() ? `${fields.donorPrefix} ${fields.donorName.trim()}`.trim() : isCorporate ? "นิติบุคคล" : "บุคคลธรรมดา"}</dd></div>
          </dl>
          <div className="donate-summary-total"><span>ยอดบริจาค</span><strong>{amount ? formatBaht(amount) : "0.00"}</strong><span>บาท</span></div>
          <button type="submit" className="donate-button donate-submit" disabled={pending}>
            {pending ? "กำลังส่งข้อมูล…" : "ยืนยันการบริจาค"}
          </button>
          <p className="donate-summary-note">หลังยืนยัน เจ้าหน้าที่จะตรวจสลิปและส่งใบอนุโมทนาบัตรทางอีเมล และนำส่งข้อมูล e-Donation ภายใน 2 สัปดาห์</p>
        </div>
      </aside>
    </form>
  );
}
