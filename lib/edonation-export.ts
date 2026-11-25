import "server-only";
import ExcelJS from "exceljs";
import type { Prisma } from "@/generated/prisma/client";
import { decryptTaxId } from "./donor-crypto";
import { prisma } from "./prisma";

// Exports for the finance officer, who keys donor name + 13-digit tax ID into the Revenue
// Department's e-Donation system. Only donors who asked for a tax deduction are included.

export type ExportFilters = {
  from: string | null; // transfer date, YYYY-MM-DD
  to: string | null;
  includeCompleted: boolean; // also include donations already confirmed to the RD
  includeExported: boolean; // also include donations already in an earlier batch
};

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Reads filters from search params or form data; defaults to "approved, not yet exported". */
export function parseExportFilters(get: (name: string) => unknown): ExportFilters {
  const from = get("from");
  const to = get("to");
  return {
    from: isDate(from) ? from : null,
    to: isDate(to) ? to : null,
    includeCompleted: get("includeCompleted") === "on" || get("includeCompleted") === "1",
    includeExported: get("includeExported") === "on" || get("includeExported") === "1",
  };
}

export function exportWhere(filters: ExportFilters): Prisma.DonationWhereInput {
  return {
    needTaxDeduction: true,
    verificationStatus: { in: filters.includeCompleted ? ["WAITING_TREASURY_RD", "COMPLETED_RD"] : ["WAITING_TREASURY_RD"] },
    ...(filters.includeExported ? {} : { edonationExportStatus: "PENDING" }),
    ...(filters.from || filters.to
      ? { transferDate: { ...(filters.from && { gte: new Date(`${filters.from}T00:00:00Z`) }), ...(filters.to && { lte: new Date(`${filters.to}T00:00:00Z`) }) } }
      : {}),
  };
}

export const EXPORT_ORDER: Prisma.DonationOrderByWithRelationInput[] = [{ transferDate: "asc" }, { transferTime: "asc" }, { referenceNo: "asc" }];

const COLUMNS: { header: string; key: string; width: number; numFmt?: string }[] = [
  { header: "ลำดับ", key: "no", width: 7 },
  { header: "เลขประจำตัวผู้เสียภาษี 13 หลัก", key: "taxId", width: 20 },
  { header: "ประเภทผู้บริจาค", key: "donorType", width: 14 },
  { header: "คำนำหน้า", key: "prefix", width: 12 },
  { header: "ชื่อ–นามสกุล / ชื่อนิติบุคคล", key: "name", width: 32 },
  { header: "จำนวนเงินบริจาค (บาท)", key: "amount", width: 18, numFmt: "#,##0.00" },
  { header: "วันที่โอน", key: "transferDate", width: 13, numFmt: "dd/mm/yyyy" },
  { header: "เวลาที่โอน", key: "transferTime", width: 10 },
  { header: "เลขที่ใบอนุโมทนาบัตร", key: "documentNo", width: 18 },
  { header: "เลขอ้างอิงรายการ", key: "referenceNo", width: 22 },
  { header: "วัตถุประสงค์การบริจาค", key: "fund", width: 40 },
  { header: "ชื่อนิสิตผู้รับทุน", key: "student", width: 24 },
  { header: "เบอร์โทรศัพท์", key: "phone", width: 14 },
  { header: "อีเมล", key: "email", width: 28 },
  { header: "ครบกำหนด 2 สัปดาห์", key: "dueDate", width: 16, numFmt: "dd/mm/yyyy" },
  { header: "สถานะ", key: "status", width: 18 },
];

const STATUS_TEXT: Record<string, string> = { WAITING_TREASURY_RD: "รอคีย์ e-Donation", COMPLETED_RD: "ส่งสรรพากรแล้ว" };

/** Builds the .xlsx for a saved batch. Tax IDs are decrypted here only; callers must audit the download. */
export async function buildExportWorkbook(batchId: number) {
  const batch = await prisma.edonationExportBatch.findUnique({
    where: { batchId },
    include: {
      exporter: { select: { fullName: true } },
      items: {
        include: { donation: { include: { fund: { select: { fundNameTh: true } }, certificate: { select: { documentNo: true } } } } },
      },
    },
  });
  if (!batch) return null;
  const donations = batch.items.map((item) => item.donation).sort((a, b) =>
    a.transferDate.getTime() - b.transferDate.getTime() || a.transferTime.getTime() - b.transferTime.getTime() || a.referenceNo.localeCompare(b.referenceNo));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MED UP e-Donation";
  workbook.created = batch.exportedAt;
  const sheet = workbook.addWorksheet("e-Donation", { views: [{ state: "frozen", ySplit: 4 }] });

  sheet.mergeCells(1, 1, 1, COLUMNS.length);
  sheet.getCell(1, 1).value = `ข้อมูลผู้บริจาคสำหรับระบบ e-Donation — ชุด ${batch.batchNo}`;
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.mergeCells(2, 1, 2, COLUMNS.length);
  sheet.getCell(2, 1).value = `คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา · ส่งออกโดย ${batch.exporter.fullName} · ${batch.exportedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · ${batch.totalRecords} รายการ`;
  sheet.getCell(2, 1).font = { color: { argb: "FF5E6E62" } };

  const headerRow = sheet.getRow(4);
  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF32745B" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    sheet.getColumn(index + 1).width = column.width;
  });
  headerRow.height = 30;

  donations.forEach((donation, index) => {
    const values: Record<string, ExcelJS.CellValue> = {
      no: index + 1,
      taxId: decryptTaxId(donation.taxIdEncrypted),
      donorType: donation.donorType === "CORPORATE" ? "นิติบุคคล" : "บุคคลธรรมดา",
      prefix: donation.donorPrefix,
      name: donation.donorName,
      amount: Number(donation.amount.toString()),
      transferDate: donation.transferDate,
      transferTime: donation.transferTime.toISOString().slice(11, 16),
      documentNo: donation.certificate?.documentNo ?? "",
      referenceNo: donation.referenceNo,
      fund: donation.fund.fundNameTh,
      student: donation.studentRecipientName ?? "",
      phone: donation.phone,
      email: donation.email,
      dueDate: donation.edonationSlaDueDate,
      status: STATUS_TEXT[donation.verificationStatus] ?? donation.verificationStatus,
    };
    const row = sheet.getRow(5 + index);
    COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = values[column.key] ?? null;
      if (column.numFmt) cell.numFmt = column.numFmt;
      // Keep IDs and phone numbers as text so Excel does not drop leading zeros or use scientific notation.
      if (column.key === "taxId" || column.key === "phone") cell.numFmt = "@";
    });
  });

  const totalRow = sheet.getRow(5 + donations.length);
  totalRow.getCell(5).value = "รวม";
  totalRow.getCell(6).value = Number(batch.totalAmount.toString());
  totalRow.getCell(6).numFmt = "#,##0.00";
  totalRow.font = { bold: true };
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + donations.length, column: COLUMNS.length } };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, fileName: `e-donation-${batch.batchNo}.xlsx`, batch };
}
