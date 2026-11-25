// Thai formatting helpers for certificates and donor emails.

const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readUnderMillion(value: number) {
  const digits = String(value).split("").map(Number);
  let text = "";
  digits.forEach((digit, index) => {
    const place = digits.length - index - 1;
    if (digit === 0) return;
    if (place === 1 && digit === 1) text += "สิบ";
    else if (place === 1 && digit === 2) text += "ยี่สิบ";
    else if (place === 0 && digit === 1 && digits.length > 1) text += "เอ็ด";
    else text += DIGITS[digit] + PLACES[place];
  });
  return text;
}

function readInteger(value: number): string {
  if (value === 0) return "ศูนย์";
  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  return (millions > 0 ? `${readInteger(millions)}ล้าน` : "") + (rest > 0 ? readUnderMillion(rest) : "");
}

/** 1250.50 -> "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์", 1000 -> "หนึ่งพันบาทถ้วน" */
export function bahtText(amount: string | number) {
  const [whole, fraction = "0"] = Number(amount).toFixed(2).split(".");
  const baht = Number(whole);
  const satang = Number(fraction);
  const bahtPart = baht > 0 ? `${readInteger(baht)}บาท` : "";
  if (satang === 0) return `${bahtPart || "ศูนย์บาท"}ถ้วน`;
  return `${bahtPart}${readInteger(satang)}สตางค์`;
}

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** Full Thai date in the Buddhist era, e.g. "21 พฤศจิกายน 2569". `utcDate` reads the UTC calendar date (DATE columns). */
export function thaiLongDate(date: Date, mode: "bangkok" | "utcDate" = "bangkok") {
  const shifted = mode === "bangkok" ? new Date(date.getTime() + 7 * 3_600_000) : date;
  return `${shifted.getUTCDate()} ${THAI_MONTHS[shifted.getUTCMonth()]} ${shifted.getUTCFullYear() + 543}`;
}

export const formatAmount = (amount: string | number | { toString(): string }) =>
  Number(amount.toString()).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TEMPLATE_FIELDS = {
  donor_name: "ชื่อผู้บริจาค (รวมคำนำหน้า)",
  amount: "จำนวนเงิน เช่น 1,000.00",
  amount_text: "จำนวนเงินเป็นตัวอักษร",
  fund_name: "วัตถุประสงค์ทุน",
  reference_no: "เลขอ้างอิงรายการ",
  document_no: "เลขที่ใบอนุโมทนาบัตร",
  transfer_date: "วันที่โอน",
} as const;

export type TemplateValues = Record<keyof typeof TEMPLATE_FIELDS, string>;

/** Replaces {field} placeholders; unknown placeholders are left as typed so mistakes are visible. */
export function fillTemplate(template: string, values: TemplateValues) {
  return template.replace(/\{([a-z_]+)\}/g, (match, key: string) => (key in values ? values[key as keyof TemplateValues] : match));
}
