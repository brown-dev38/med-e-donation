"use client";

import { useActionState, useEffect } from "react";
import type { ExportFilters } from "@/lib/edonation-export";
import { createExportBatch } from "./actions";

export default function ExportButton({ filters, count }: { filters: ExportFilters; count: number }) {
  const [state, action, pending] = useActionState(createExportBatch, null);

  // Start the download as soon as the batch is saved.
  useEffect(() => {
    if (state?.status !== "success") return;
    const link = document.createElement("a");
    link.href = `/admin/exports/${state.batchId}/download`;
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
  }, [state]);

  return (
    <form action={action} className="admin-export-action">
      {filters.from && <input type="hidden" name="from" value={filters.from} />}
      {filters.to && <input type="hidden" name="to" value={filters.to} />}
      {filters.includeCompleted && <input type="hidden" name="includeCompleted" value="on" />}
      {filters.includeExported && <input type="hidden" name="includeExported" value="on" />}
      <button type="submit" className="admin-button" disabled={pending || count === 0}>
        {pending ? "กำลังสร้างไฟล์…" : `ดาวน์โหลด Excel (${count.toLocaleString("th-TH")} รายการ)`}
      </button>
      {state?.status === "error" && <p className="admin-form-error" role="alert">{state.message}</p>}
      {state?.status === "success" && (
        <p className="admin-form-success" role="status">
          สร้างชุด {state.batchNo} ({state.count.toLocaleString("th-TH")} รายการ) แล้ว ถ้าไฟล์ไม่ดาวน์โหลดอัตโนมัติ <a href={`/admin/exports/${state.batchId}/download`} download className="admin-inline-link">คลิกที่นี่</a>
        </p>
      )}
    </form>
  );
}
