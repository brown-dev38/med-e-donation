// Thai QR Payment (PromptPay) payload, EMVCo merchant-presented format.
// Shared by the browser (QR rendering) and the server (settings validation).

const PROMPTPAY_AID = "A000000677010111";

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

export type PromptPayKind = "mobile" | "taxId" | "eWallet";

/** Returns the target kind for a PromptPay ID, or null if the format is not supported. */
export function promptPayKind(id: string): PromptPayKind | null {
  const digits = id.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return "mobile";
  if (/^\d{13}$/.test(digits)) return "taxId";
  if (/^\d{15}$/.test(digits)) return "eWallet";
  return null;
}

/** CRC-16/CCITT-FALSE, as required by EMVCo tag 63. */
export function crc16(text: string) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** What a QR pays to: a PromptPay ID, or a bank account (3-digit bank code + account number). */
export type QrTarget = { type: "PROMPTPAY"; promptpayId: string } | { type: "BANK_ACCOUNT"; bankCode: string; accountNo: string };

export const isBankAccountNo = (value: string) => /^\d{10,15}$/.test(value.replace(/\D/g, ""));

/** Returns a reason the target cannot be encoded, or null when it is valid. */
export function qrTargetError(target: QrTarget) {
  if (target.type === "PROMPTPAY") return promptPayKind(target.promptpayId) ? null : "พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก เลขประจำตัวผู้เสียภาษี 13 หลัก หรือ e-Wallet 15 หลัก";
  if (!/^\d{3}$/.test(target.bankCode)) return "QR เลขบัญชีต้องเลือกธนาคารจากรายการ";
  return isBankAccountNo(target.accountNo) ? null : "เลขที่บัญชีต้องเป็นตัวเลข 10–15 หลัก";
}

/**
 * Builds the Thai QR Payment payload. With an amount, the QR is "dynamic" (tag 01 = 12) and
 * banking apps pre-fill the amount; without one it is reusable ("static", 11).
 * Bank accounts use PromptPay credit-transfer tag 29-04: bank code followed by the account number.
 */
export function thaiQrPayload(qr: QrTarget, amount?: string | null) {
  const error = qrTargetError(qr);
  if (error) throw new Error(error);
  let target: string;
  if (qr.type === "BANK_ACCOUNT") {
    target = field("04", `${qr.bankCode}${qr.accountNo.replace(/\D/g, "")}`);
  } else {
    const digits = qr.promptpayId.replace(/\D/g, "");
    const kind = promptPayKind(digits);
    target = kind === "mobile" ? field("01", `0066${digits.slice(1)}`.padStart(13, "0")) : kind === "taxId" ? field("02", digits) : field("03", digits);
  }
  return buildPayload(target, amount);
}

/** PromptPay-only shorthand kept for existing callers. */
export function promptPayPayload(id: string, amount?: string | null) {
  if (!promptPayKind(id)) throw new Error("Unsupported PromptPay ID.");
  return thaiQrPayload({ type: "PROMPTPAY", promptpayId: id }, amount);
}

function buildPayload(target: string, amount?: string | null) {
  const numericAmount = amount ? Number(amount) : 0;
  const parts = [
    field("00", "01"),
    field("01", numericAmount > 0 ? "12" : "11"),
    field("29", field("00", PROMPTPAY_AID) + target),
    field("53", "764"),
    ...(numericAmount > 0 ? [field("54", numericAmount.toFixed(2))] : []),
    field("58", "TH"),
  ].join("");
  const withCrcTag = `${parts}6304`;
  return withCrcTag + crc16(withCrcTag);
}
