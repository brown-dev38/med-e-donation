import assert from "node:assert/strict";
import test from "node:test";
import { fiscalYearBe, formatDocumentNo } from "../lib/certificate-number";

test("fiscal year starts on 1 October, Bangkok time", () => {
  assert.equal(fiscalYearBe(new Date("2026-09-30T16:59:00Z")), 2569); // 23:59 on 30 Sep in Bangkok
  assert.equal(fiscalYearBe(new Date("2026-09-30T17:00:00Z")), 2570); // 00:00 on 1 Oct in Bangkok
  assert.equal(fiscalYearBe(new Date("2027-01-15T00:00:00Z")), 2570);
});

test("document numbers use the two-digit B.E. year and a 4-digit sequence", () => {
  assert.equal(formatDocumentNo(2570, 1), "MEDUP-70/0001");
  assert.equal(formatDocumentNo(2569, 123), "MEDUP-69/0123");
  assert.equal(formatDocumentNo(2570, 12345), "MEDUP-70/12345");
});
