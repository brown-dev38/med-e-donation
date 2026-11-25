import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { emptyDonationFields, isValidThaiTaxId, normalizeAmount, validateDonation, validateSlipFile, type DonationFields } from "../lib/donation-form";
import { decryptTaxId, encryptTaxId, hashTaxId, maskTaxId } from "../lib/donor-crypto";

process.env.TAX_ID_ENCRYPTION_KEY = randomBytes(32).toString("base64");

function withCheckDigit(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i);
  return `${first12}${(11 - (sum % 11)) % 10}`;
}

const validTaxId = withCheckDigit("356010029481");
const funds = [{ fundCode: "GENERAL_SCHOLARSHIP", requiresStudentName: false }, { fundCode: "SPECIFIC_STUDENT", requiresStudentName: true }];
const now = new Date("2026-11-20T05:00:00Z"); // 12:00 in Bangkok
const valid: DonationFields = {
  ...emptyDonationFields(),
  fundCode: "GENERAL_SCHOLARSHIP",
  amount: "1,000",
  donorPrefix: "นาย",
  donorName: "  สมชาย   ใจดี ",
  taxId: validTaxId,
  phone: "+66 81-234-5678",
  email: "Donor@Example.com ",
  transferDate: "2026-11-20",
  transferTime: "11:30",
  pdpaConsent: true,
};

test("Thai tax IDs require 13 digits and a valid check digit", () => {
  assert.equal(isValidThaiTaxId(validTaxId), true);
  assert.equal(isValidThaiTaxId(validTaxId.slice(0, 12) + ((Number(validTaxId[12]) + 1) % 10)), false);
  assert.equal(isValidThaiTaxId("123"), false);
});

test("amounts are normalized to two decimals and bounded", () => {
  assert.equal(normalizeAmount("1,500"), "1500.00");
  assert.equal(normalizeAmount("99.5"), "99.50");
  for (const bad of ["", "0", "0.50", "1.234", "-5", "abc", "10000001"]) assert.equal(normalizeAmount(bad), null, bad);
});

test("a valid donation is normalized", () => {
  const result = validateDonation(valid, funds, now);
  assert.ok(result.ok);
  assert.equal(result.data.donorName, "สมชาย ใจดี");
  assert.equal(result.data.phone, "0812345678");
  assert.equal(result.data.email, "donor@example.com");
  assert.equal(result.data.amount, "1000.00");
  assert.equal(result.data.studentRecipientName, null);
});

test("specific-student funds require the student name", () => {
  const result = validateDonation({ ...valid, fundCode: "SPECIFIC_STUDENT" }, funds, now);
  assert.ok(!result.ok);
  assert.ok(result.errors.studentRecipientName);
});

test("rejects future transfers, unknown funds, mismatched prefixes and missing consent", () => {
  const result = validateDonation({ ...valid, fundCode: "CLOSED_FUND", donorType: "CORPORATE", transferTime: "12:30", pdpaConsent: false }, funds, now);
  assert.ok(!result.ok);
  assert.deepEqual(Object.keys(result.errors).sort(), ["donorPrefix", "fundCode", "pdpaConsent", "transferTime"]);
  const future = validateDonation({ ...valid, transferDate: "2026-11-21" }, funds, now);
  assert.ok(!future.ok && future.errors.transferDate);
});

test("slip files must be JPG or PNG up to 5 MB", () => {
  assert.equal(validateSlipFile({ size: 1000, type: "image/png" }), null);
  assert.ok(validateSlipFile(null));
  assert.ok(validateSlipFile({ size: 1000, type: "application/pdf" }));
  assert.ok(validateSlipFile({ size: 6 * 1024 * 1024, type: "image/jpeg" }));
});

test("tax IDs encrypt with a fresh IV, decrypt, hash stably and mask", () => {
  const first = encryptTaxId(validTaxId);
  assert.notEqual(first, encryptTaxId(validTaxId));
  assert.ok(!first.includes(validTaxId));
  assert.equal(decryptTaxId(first), validTaxId);
  assert.equal(hashTaxId(validTaxId), hashTaxId(validTaxId));
  assert.match(hashTaxId(validTaxId), /^[a-f0-9]{64}$/);
  assert.equal(maskTaxId("3560100294812"), "35601xxxx4812");
  const [version, iv, tag, ciphertext] = first.split(":");
  const tampered = [version, iv, tag, Buffer.from(Buffer.from(ciphertext, "base64url").map((byte) => byte ^ 1)).toString("base64url")].join(":");
  assert.throws(() => decryptTaxId(tampered));
});
