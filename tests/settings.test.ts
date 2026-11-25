import assert from "node:assert/strict";
import test from "node:test";
import { emptyDonationFields, validateDonation } from "../lib/donation-form";
import { crc16, promptPayKind, promptPayPayload } from "../lib/promptpay";
import { bahtText, fillTemplate, thaiLongDate } from "../lib/thai-text";

test("CRC-16/CCITT-FALSE matches the standard check value", () => {
  assert.equal(crc16("123456789"), "29B1");
  // Published PromptPay example payload (mobile 000-000-0000, no amount) ends in CRC 8956.
  const example = "00020101021129370016A000000677010111011300660000000005802TH53037646304";
  assert.equal(crc16(example), "8956");
});

test("PromptPay payloads encode the target and the amount", () => {
  assert.equal(promptPayKind("081-234-5678"), "mobile");
  assert.equal(promptPayKind("0994000165552"), "taxId");
  assert.equal(promptPayKind("123456789012345"), "eWallet");
  assert.equal(promptPayKind("12345"), null);

  const mobile = promptPayPayload("0812345678");
  assert.ok(mobile.includes("0113006681234567"), "mobile becomes 0066 + number without leading 0");
  assert.ok(mobile.startsWith("000201010211"), "static QR without amount");
  assert.equal(mobile.slice(-4), crc16(mobile.slice(0, -4)));

  const withAmount = promptPayPayload("0994000165552", "1500");
  assert.ok(withAmount.startsWith("000201010212"), "dynamic QR with amount");
  assert.ok(withAmount.includes("02130994000165552"));
  assert.ok(withAmount.includes("54071500.00"));
  assert.equal(withAmount.slice(-4), crc16(withAmount.slice(0, -4)));
  assert.throws(() => promptPayPayload("123"));
});

test("baht amounts are written in Thai words", () => {
  assert.equal(bahtText(1000), "หนึ่งพันบาทถ้วน");
  assert.equal(bahtText("21"), "ยี่สิบเอ็ดบาทถ้วน");
  assert.equal(bahtText(11), "สิบเอ็ดบาทถ้วน");
  assert.equal(bahtText("1250.50"), "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์");
  assert.equal(bahtText(2_500_000), "สองล้านห้าแสนบาทถ้วน");
  assert.equal(bahtText(0.25), "ยี่สิบห้าสตางค์");
});

test("Thai dates use the Buddhist era and Bangkok time", () => {
  assert.equal(thaiLongDate(new Date("2026-11-20T18:00:00Z")), "21 พฤศจิกายน 2569");
  assert.equal(thaiLongDate(new Date("2026-11-20T00:00:00Z"), "utcDate"), "20 พฤศจิกายน 2569");
});

test("email templates fill known placeholders and keep unknown ones visible", () => {
  const values = { donor_name: "นายทดสอบ", amount: "1,000.00", amount_text: "หนึ่งพันบาทถ้วน", fund_name: "ทุน", reference_no: "REF", document_no: "MEDUP-70/0001", transfer_date: "1 พ.ย. 2569" };
  assert.equal(fillTemplate("เรียน {donor_name} เลขที่ {document_no} {unknown}", values), "เรียน นายทดสอบ เลขที่ MEDUP-70/0001 {unknown}");
});

test("a student list makes donors pick a listed student", () => {
  const funds = [{ fundCode: "SPECIFIC_STUDENT", requiresStudentName: true, students: [{ fullName: "นายเอ บี", studentCode: "65000001" }] }];
  const base = { ...emptyDonationFields(), fundCode: "SPECIFIC_STUDENT", amount: "100", donorPrefix: "นาย", donorName: "ผู้บริจาค", taxId: "1101700230708", phone: "0812345678", email: "a@b.co", transferDate: "2026-11-20", transferTime: "09:00", pdpaConsent: true };
  const now = new Date("2026-11-20T05:00:00Z");
  const unlisted = validateDonation({ ...base, studentRecipientName: "คนอื่น" }, funds, now);
  assert.ok(!unlisted.ok && unlisted.errors.studentRecipientName);
  const listed = validateDonation({ ...base, studentRecipientName: "นายเอ บี" }, funds, now);
  assert.ok(listed.ok);
  assert.equal(listed.data.studentRecipientCode, "65000001");
});

test("bank-account QR encodes bank code + account under PromptPay tag 29-04", async () => {
  const { thaiQrPayload, qrTargetError } = await import("../lib/promptpay");
  const payload = thaiQrPayload({ type: "BANK_ACCOUNT", bankCode: "006", accountNo: "512-0-12345-6" }, "500");
  assert.ok(payload.includes("29370016A00000067701011104130065120123456"), payload);
  assert.ok(payload.startsWith("000201010212"));
  assert.ok(payload.includes("5406500.00"));
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
  assert.ok(qrTargetError({ type: "BANK_ACCOUNT", bankCode: "", accountNo: "5120123456" }));
  assert.ok(qrTargetError({ type: "BANK_ACCOUNT", bankCode: "006", accountNo: "12345" }));
  assert.equal(qrTargetError({ type: "PROMPTPAY", promptpayId: "0994000165552" }), null);
});
