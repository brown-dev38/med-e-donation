// Shared donation form rules. Imported by the browser form and the Server Action,
// so it must stay free of Node.js and server-only modules.

/** Suggested prefixes shown under the prefix field. Donors may also type their own (e.g. ยศ, ตำแหน่งทางวิชาการ). */
export const DONOR_PREFIXES = {
  INDIVIDUAL: ["นาย", "นาง", "นางสาว", "นพ.", "พญ.", "ดร."],
  CORPORATE: ["บริษัท", "ห้างหุ้นส่วนจำกัด", "ห้างหุ้นส่วนสามัญ", "มูลนิธิ", "สมาคม"],
} as const;

export type DonorType = keyof typeof DONOR_PREFIXES;

export const PRESET_AMOUNTS = [500, 1000, 2000, 5000, 10000] as const;
export const MAX_AMOUNT = 10_000_000;
export const MAX_PREFIX_LENGTH = 50; // donations.donor_prefix is VARCHAR(50)
export const SLIP_MAX_BYTES = 5 * 1024 * 1024;
export const SLIP_MIME_TYPES = ["image/jpeg", "image/png"] as const;
const MAX_TRANSFER_AGE_DAYS = 365;

export type DonationFields = {
  fundCode: string;
  studentRecipientName: string;
  studentRecipientCode: string;
  amount: string;
  donorType: string;
  donorPrefix: string;
  donorName: string;
  taxId: string;
  phone: string;
  email: string;
  transferDate: string;
  transferTime: string;
  needTaxDeduction: boolean;
  pdpaConsent: boolean;
};

export type FieldName = keyof DonationFields | "slip";
export type FieldErrors = Partial<Record<FieldName, string>>;

export type StudentOption = { fullName: string; studentCode: string | null };
/** `students`: when non-empty for a student-named fund, the donor must pick one of these. */
export type FundRule = { fundCode: string; requiresStudentName: boolean; students?: StudentOption[] };

export type ValidDonation = {
  fundCode: string;
  studentRecipientName: string | null;
  studentRecipientCode: string | null;
  amount: string;
  donorType: DonorType;
  donorPrefix: string;
  donorName: string;
  taxId: string;
  phone: string;
  email: string;
  transferDate: string;
  transferTime: string;
  needTaxDeduction: boolean;
};

export const emptyDonationFields = (): DonationFields => ({
  fundCode: "",
  studentRecipientName: "",
  studentRecipientCode: "",
  amount: "",
  donorType: "INDIVIDUAL",
  donorPrefix: "",
  donorName: "",
  taxId: "",
  phone: "",
  email: "",
  transferDate: "",
  transferTime: "",
  needTaxDeduction: true,
  pdpaConsent: false,
});

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();
export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Thai citizen / juristic person ID: 13 digits with a mod-11 check digit. */
export function isValidThaiTaxId(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

/** Returns the amount as a fixed two-decimal string, or null when invalid. */
export function normalizeAmount(value: string) {
  const cleaned = value.replace(/[,\s฿]/g, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!(amount >= 1) || amount > MAX_AMOUNT) return null;
  return amount.toFixed(2);
}

/** Today's date and current minute in Thailand, as YYYY-MM-DD and HH:MM. */
export function bangkokNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDonation(fields: DonationFields, funds: FundRule[], now = new Date()):
  | { ok: true; data: ValidDonation }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const fund = funds.find((item) => item.fundCode === fields.fundCode);
  if (!fund) errors.fundCode = "กรุณาเลือกวัตถุประสงค์การบริจาค";

  const studentRecipientName = collapse(fields.studentRecipientName);
  let studentRecipientCode = collapse(fields.studentRecipientCode);
  const studentList = fund?.requiresStudentName && fund.students?.length ? fund.students : null;
  if (studentList) {
    const chosen = studentList.find((student) => student.fullName === studentRecipientName);
    if (!chosen) errors.studentRecipientName = "กรุณาเลือกนิสิตผู้รับทุนจากรายชื่อ";
    else studentRecipientCode = chosen.studentCode ?? "";
  } else if (fund?.requiresStudentName) {
    if (!studentRecipientName) errors.studentRecipientName = "กรุณาระบุชื่อ–นามสกุลนิสิตผู้รับทุน";
    else if (studentRecipientName.length > 255) errors.studentRecipientName = "ชื่อนิสิตยาวเกินไป";
    if (studentRecipientCode && !/^[A-Za-z0-9-]{1,20}$/.test(studentRecipientCode)) errors.studentRecipientCode = "รหัสนิสิตต้องเป็นตัวอักษรหรือตัวเลข ไม่เกิน 20 ตัว";
  }

  const amount = normalizeAmount(fields.amount);
  if (!amount) errors.amount = `กรุณาระบุจำนวนเงินตั้งแต่ 1 ถึง ${MAX_AMOUNT.toLocaleString("th-TH")} บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง)`;

  const donorType = fields.donorType in DONOR_PREFIXES ? (fields.donorType as DonorType) : null;
  if (!donorType) errors.donorType = "กรุณาเลือกประเภทผู้บริจาค";
  const donorPrefix = collapse(fields.donorPrefix);
  if (donorType && !donorPrefix) errors.donorPrefix = donorType === "CORPORATE" ? "กรุณาระบุประเภทนิติบุคคล" : "กรุณาระบุคำนำหน้า";
  else if (donorPrefix.length > MAX_PREFIX_LENGTH) errors.donorPrefix = `คำนำหน้ายาวเกินไป (ไม่เกิน ${MAX_PREFIX_LENGTH} ตัวอักษร)`;

  const donorName = collapse(fields.donorName);
  if (donorName.length < 2) errors.donorName = donorType === "CORPORATE" ? "กรุณากรอกชื่อนิติบุคคล" : "กรุณากรอกชื่อ–นามสกุล";
  else if (donorName.length > 255) errors.donorName = "ชื่อยาวเกินไป";

  const taxId = digitsOnly(fields.taxId);
  if (taxId.length !== 13) errors.taxId = "กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลัก";
  else if (!isValidThaiTaxId(taxId)) errors.taxId = "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";

  let phone = digitsOnly(fields.phone);
  if (phone.startsWith("66") && phone.length === 11) phone = `0${phone.slice(2)}`;
  if (!/^0\d{8,9}$/.test(phone)) errors.phone = "กรุณากรอกเบอร์โทรศัพท์ 9–10 หลัก เช่น 0812345678";

  const email = fields.email.trim().toLowerCase();
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "กรุณากรอกอีเมลให้ถูกต้อง";

  const today = bangkokNow(now);
  if (!isRealDate(fields.transferDate)) errors.transferDate = "กรุณาระบุวันที่โอนเงิน";
  else {
    const ageDays = (Date.parse(`${today.date}T00:00:00Z`) - Date.parse(`${fields.transferDate}T00:00:00Z`)) / 86_400_000;
    if (ageDays < 0) errors.transferDate = "วันที่โอนต้องไม่เป็นวันในอนาคต";
    else if (ageDays > MAX_TRANSFER_AGE_DAYS) errors.transferDate = "วันที่โอนต้องไม่เกิน 1 ปีย้อนหลัง";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.transferTime)) errors.transferTime = "กรุณาระบุเวลาที่โอนเงิน";
  else if (fields.transferDate === today.date && fields.transferTime > today.time) errors.transferTime = "เวลาที่โอนต้องไม่เป็นเวลาในอนาคต";

  if (!fields.pdpaConsent) errors.pdpaConsent = "กรุณายินยอมการเก็บและใช้ข้อมูลก่อนยืนยันการบริจาค";

  if (Object.keys(errors).length > 0 || !fund || !amount || !donorType) return { ok: false, errors };
  return {
    ok: true,
    data: {
      fundCode: fund.fundCode,
      studentRecipientName: fund.requiresStudentName ? studentRecipientName : null,
      studentRecipientCode: fund.requiresStudentName && studentRecipientCode ? studentRecipientCode : null,
      amount,
      donorType,
      donorPrefix,
      donorName,
      taxId,
      phone,
      email,
      transferDate: fields.transferDate,
      transferTime: fields.transferTime,
      needTaxDeduction: fields.needTaxDeduction,
    },
  };
}

/** Browser-level checks only; the server re-checks the file contents. */
export function validateSlipFile(file: { size: number; type: string } | null | undefined) {
  if (!file || file.size === 0) return "กรุณาแนบสลิปโอนเงิน";
  if (!(SLIP_MIME_TYPES as readonly string[]).includes(file.type)) return "รองรับเฉพาะไฟล์ภาพ JPG หรือ PNG";
  if (file.size > SLIP_MAX_BYTES) return "ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB";
  return null;
}
