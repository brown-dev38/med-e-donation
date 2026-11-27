"use client";

import { useEffect } from "react";
import type { ExportFilters } from "@/lib/edonation-export";
import { useConfirmedAction } from "@/app/components/feedback";
import { createExportBatch, type ExportState } from "./actions";

/** Adds a toast message to the export result (the success result carries batch details instead of text). */
async function exportWithMessage(previous: ExportState, formData: FormData): Promise<ExportState> {
  const result = await createExportBatch(previous, formData);
  return result?.status === "success"
    ? { ...result, message: `สร้างชุด ${result.batchNo} (${result.count.toLocaleString("th-TH")} รายการ) แล้ว กำลังดาวน์โหลด` }
    : result;
}

export default function ExportButton({ filters, count }: { filters: ExportFilters; count: number }) {
  const { onSubmit, pending, result } = useConfirmedAction(exportWithMessage, {
    title: `ส่งออก Excel ${count.toLocaleString("th-TH")} รายการ?`,
    content: "รายการในไฟล์จะถูกบันทึกว่าส่งออกแล้ว และจะไม่ถูกส่งออกซ้ำในครั้งถัดไป (เว้นแต่เลือกรวมรายการที่ส่งออกแล้ว)",
    okText: "ส่งออก",
  });

  // Start the download as soon as the batch is saved.
  useEffect(() => {
    if (result?.status !== "success") return;
    const link = document.createElement("a");
    link.href = `/admin/exports/${result.batchId}/download`;
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
  }, [result]);

  return (
    <form onSubmit={onSubmit} className="admin-export-action">
      {filters.from && <input type="hidden" name="from" value={filters.from} />}
      {filters.to && <input type="hidden" name="to" value={filters.to} />}
      {filters.includeCompleted && <input type="hidden" name="includeCompleted" value="on" />}
      {filters.includeExported && <input type="hidden" name="includeExported" value="on" />}
      <button type="submit" className="admin-button" disabled={pending || count === 0}>
        {pending ? "กำลังสร้างไฟล์…" : `ดาวน์โหลด Excel (${count.toLocaleString("th-TH")} รายการ)`}
      </button>
      {result?.status === "success" && (
        <p className="admin-form-success" role="status">
          ถ้าไฟล์ไม่ดาวน์โหลดอัตโนมัติ <a href={`/admin/exports/${result.batchId}/download`} download className="admin-inline-link">คลิกที่นี่</a>
        </p>
      )}
    </form>
  );
}
