import type { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { buildExportWorkbook } from "@/lib/edonation-export";
import { prisma } from "@/lib/prisma";

// The file contains full 13-digit tax IDs: admin session required, every download audited (PDPA).
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/exports/[id]/download">) {
  const admin = await getCurrentAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const batchId = Number((await ctx.params).id);
  if (!Number.isInteger(batchId) || batchId < 1) return new Response("Not found", { status: 404 });

  let file;
  try {
    file = await buildExportWorkbook(batchId);
  } catch (error) {
    console.error("Excel export build failed", error instanceof Error ? error.message : "unknown error");
    return new Response("Could not build the file", { status: 500 });
  }
  if (!file) return new Response("Not found", { status: 404 });

  await prisma.auditLog.create({
    data: {
      userId: admin.userId, action: "DOWNLOAD_EXCEL_EDONATION", targetTable: "edonation_export_batches", targetId: String(batchId),
      details: { batchNo: file.batch.batchNo, records: file.batch.totalRecords },
      ipAddress: (request.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 45) || null,
    },
  });
  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
