// Acknowledgement certificate numbers: MEDUP-YY/NNNN, numbered per Thai fiscal year (B.E.).
// The Thai government fiscal year starts on 1 October, so October 2026 is fiscal year 2570.

export function fiscalYearBe(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "numeric" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return year + 543 + (month >= 10 ? 1 : 0);
}

export function formatDocumentNo(fiscalYear: number, runningSeq: number) {
  return `MEDUP-${String(fiscalYear % 100).padStart(2, "0")}/${String(runningSeq).padStart(4, "0")}`;
}
