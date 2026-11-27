"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { requireStaff } from "@/lib/auth";
import { bangkokNow } from "@/lib/donation-form";
import { EXPORT_ORDER, exportWhere, parseExportFilters } from "@/lib/edonation-export";
import { prisma } from "@/lib/prisma";

export type ExportState = null | { status: "error"; message: string } | { status: "success"; batchId: number; batchNo: string; count: number; message?: string };

const MAX_ROWS = 5000;

/** Saves a batch of the donations matching the filters and marks them EXPORTED; the browser then downloads it. */
export async function createExportBatch(_previous: ExportState, formData: FormData): Promise<ExportState> {
  const admin = await requireStaff();
  const filters = parseExportFilters((name) => formData.get(name));
  const ipAddress = ((await headers()).get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 45) || null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const batch = await prisma.$transaction(async (tx) => {
        const rows = await tx.donation.findMany({ where: exportWhere(filters), orderBy: EXPORT_ORDER, take: MAX_ROWS + 1, select: { donationId: true, amount: true, transferDate: true } });
        if (rows.length === 0) return null;
        if (rows.length > MAX_ROWS) throw new Error(`TOO_MANY`);

        const month = bangkokNow().date.slice(0, 7).replace("-", "");
        const prefix = `EXP-${month}-`;
        const existing = await tx.edonationExportBatch.findMany({ where: { batchNo: { startsWith: prefix } }, select: { batchNo: true } });
        const seq = existing.reduce((max, row) => Math.max(max, Number(row.batchNo.slice(prefix.length)) || 0), 0) + 1;
        const total = rows.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
        const created = await tx.edonationExportBatch.create({
          data: {
            batchNo: `${prefix}${String(seq).padStart(2, "0")}`,
            dateFrom: filters.from ? new Date(`${filters.from}T00:00:00Z`) : rows[0].transferDate,
            dateTo: filters.to ? new Date(`${filters.to}T00:00:00Z`) : rows[rows.length - 1].transferDate,
            totalRecords: rows.length,
            totalAmount: total,
            exportedBy: admin.userId,
            remarks: [filters.includeCompleted && "รวมรายการที่ส่งสรรพากรแล้ว", filters.includeExported && "รวมรายการที่เคยส่งออกแล้ว"].filter(Boolean).join(" · ") || null,
          },
        });
        await tx.edonationExportItem.createMany({ data: rows.map((row) => ({ batchId: created.batchId, donationId: row.donationId })) });
        await tx.donation.updateMany({ where: { donationId: { in: rows.map((row) => row.donationId) } }, data: { edonationExportStatus: "EXPORTED" } });
        await tx.auditLog.create({
          data: {
            userId: admin.userId, action: "EXPORT_EXCEL_EDONATION", targetTable: "edonation_export_batches", targetId: String(created.batchId),
            details: { batchNo: created.batchNo, records: rows.length, totalAmount: total.toFixed(2), filters }, ipAddress,
          },
        });
        return created;
      });
      if (!batch) return { status: "error", message: "ไม่มีรายการตามเงื่อนไขที่เลือก" };
      refresh();
      return { status: "success", batchId: batch.batchId, batchNo: batch.batchNo, count: batch.totalRecords };
    } catch (error) {
      if (error instanceof Error && error.message === "TOO_MANY") return { status: "error", message: `รายการเกิน ${MAX_ROWS.toLocaleString("th-TH")} รายการ กรุณาเลือกช่วงวันที่ให้แคบลง` };
      // Two exports took the same batch number at once; retry with the next one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
      console.error("Export failed", error instanceof Error ? error.message : "unknown error");
      return { status: "error", message: "สร้างไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
    }
  }
  return { status: "error", message: "สร้างไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
}
