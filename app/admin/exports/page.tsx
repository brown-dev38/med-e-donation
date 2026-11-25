import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { EXPORT_ORDER, exportWhere, parseExportFilters } from "@/lib/edonation-export";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatThaiDateTime, formatTransfer, StatusBadge } from "../admin-shell";
import ExportButton from "./export-button";

export const metadata: Metadata = { title: "ส่งออก Excel e-Donation | MED e-Donation" };
export const instant = false;

const PREVIEW_ROWS = 20;
const formatDate = (date: Date) => date.toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

async function ExportContent({ searchParams }: { searchParams: PageProps<"/admin/exports">["searchParams"] }) {
  await requireAdmin();
  const params = await searchParams;
  const filters = parseExportFilters((name) => params[name]);
  const where = exportWhere(filters);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);

  const [summary, overdue, preview, batches] = await Promise.all([
    prisma.donation.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
    prisma.donation.count({ where: { ...where, edonationSlaDueDate: { lt: today } } }),
    prisma.donation.findMany({
      where, orderBy: EXPORT_ORDER, take: PREVIEW_ROWS,
      select: { donationId: true, referenceNo: true, donorPrefix: true, donorName: true, taxIdMasked: true, amount: true, transferDate: true, transferTime: true, verificationStatus: true, edonationExportStatus: true, edonationSlaDueDate: true, certificate: { select: { documentNo: true } } },
    }),
    prisma.edonationExportBatch.findMany({ orderBy: { exportedAt: "desc" }, take: 30, include: { exporter: { select: { fullName: true } } } }),
  ]);
  const count = summary._count._all;

  return (
    <main className="admin-main">
      <div className="admin-welcome">
        <div>
          <p className="admin-eyebrow">E-DONATION EXPORT</p>
          <h1>ส่งออก Excel สำหรับ e-Donation</h1>
          <p>ไฟล์มีชื่อและเลขผู้เสียภาษี 13 หลักของผู้บริจาคที่ผ่านอนุมัติครั้งที่ 1 และประสงค์ลดหย่อนภาษี สำหรับคีย์เข้าระบบ e-Donation ของกรมสรรพากร</p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>เลือกรายการ</h2></div>
        <form className="admin-export-filters" action="/admin/exports">
          <div>
            <label className="admin-field" htmlFor="from">โอนตั้งแต่วันที่</label>
            <input className="admin-input" id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
          </div>
          <div>
            <label className="admin-field" htmlFor="to">ถึงวันที่</label>
            <input className="admin-input" id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
          </div>
          <div className="admin-export-checks">
            <label className="admin-check"><input type="checkbox" name="includeExported" value="1" defaultChecked={filters.includeExported} /> รวมรายการที่เคยส่งออกแล้ว</label>
            <label className="admin-check"><input type="checkbox" name="includeCompleted" value="1" defaultChecked={filters.includeCompleted} /> รวมรายการที่ส่งสรรพากรแล้ว (อนุมัติครั้งที่ 2)</label>
          </div>
          <div className="admin-export-filter-actions">
            <button type="submit" className="admin-button admin-button-ghost">แสดงรายการ</button>
            {(filters.from || filters.to || filters.includeExported || filters.includeCompleted) && <Link href="/admin/exports" className="admin-inline-link">ล้างเงื่อนไข</Link>}
          </div>
        </form>
      </section>

      <div className="admin-stats admin-export-stats">
        <article className="admin-stat admin-stat-info"><p>รายการที่จะส่งออก</p><strong>{count.toLocaleString("th-TH")}</strong><span>รายการ</span></article>
        <article className="admin-stat admin-stat-ok"><p>ยอดเงินรวม</p><strong>{formatBaht(summary._sum.amount ?? 0)}</strong><span>บาท</span></article>
        <article className={`admin-stat ${overdue ? "admin-stat-warn" : "admin-stat-plain"}`}><p>เกินกำหนด 2 สัปดาห์</p><strong>{overdue.toLocaleString("th-TH")}</strong><span>รายการ</span></article>
      </div>

      <section className="admin-panel admin-export-preview">
        <div className="admin-panel-head">
          <h2>ตัวอย่างรายการ{count > PREVIEW_ROWS && ` (${PREVIEW_ROWS} จาก ${count.toLocaleString("th-TH")})`}</h2>
          <ExportButton filters={filters} count={count} />
        </div>
        <p className="admin-hint">เมื่อดาวน์โหลด ระบบจะบันทึกเป็นชุดส่งออกและทำเครื่องหมายว่า “ส่งออกแล้ว” เพื่อไม่ให้ดึงซ้ำในรอบถัดไป การดาวน์โหลดทุกครั้งถูกบันทึกในประวัติการใช้งาน</p>
        {preview.length === 0 ? (
          <p className="admin-empty">ไม่มีรายการตามเงื่อนไข{!filters.includeExported && " — รายการที่ส่งออกไปแล้วจะไม่แสดง ติ๊ก “รวมรายการที่เคยส่งออกแล้ว” เพื่อดูทั้งหมด"}</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">วัน–เวลาที่โอน</th><th scope="col">ผู้บริจาค</th><th scope="col">เลขผู้เสียภาษี</th><th scope="col" className="admin-num">จำนวนเงิน (บาท)</th><th scope="col">ใบอนุโมทนาบัตร</th><th scope="col">สถานะ</th></tr></thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.donationId}>
                    <td>{formatTransfer(row.transferDate, row.transferTime)}{row.edonationSlaDueDate && row.edonationSlaDueDate < today && <span className="admin-flag">เกิน 2 สัปดาห์</span>}</td>
                    <td><Link href={`/admin/donations/${row.donationId}`} className="admin-inline-link admin-link-plain">{row.donorPrefix} {row.donorName}</Link><small>{row.referenceNo}</small></td>
                    <td className="admin-mono">{row.taxIdMasked}</td>
                    <td className="admin-num"><strong>{formatBaht(row.amount)}</strong></td>
                    <td>{row.certificate?.documentNo ?? "—"}</td>
                    <td><StatusBadge status={row.verificationStatus} />{row.edonationExportStatus === "EXPORTED" && <small>เคยส่งออกแล้ว</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>ประวัติการส่งออก</h2></div>
        {batches.length === 0 ? <p className="admin-empty">ยังไม่เคยส่งออก</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">ชุดที่</th><th scope="col">ช่วงวันที่โอน</th><th scope="col" className="admin-num">รายการ</th><th scope="col" className="admin-num">ยอดรวม (บาท)</th><th scope="col">ส่งออกโดย</th><th scope="col"><span className="admin-sr-only">ดาวน์โหลด</span></th></tr></thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.batchId}>
                    <td><strong className="admin-ref">{batch.batchNo}</strong>{batch.remarks && <small>{batch.remarks}</small>}</td>
                    <td>{formatDate(batch.dateFrom)} – {formatDate(batch.dateTo)}</td>
                    <td className="admin-num">{batch.totalRecords.toLocaleString("th-TH")}</td>
                    <td className="admin-num">{formatBaht(batch.totalAmount)}</td>
                    <td>{batch.exporter.fullName}<small>{formatThaiDateTime(batch.exportedAt)}</small></td>
                    <td><a className="admin-button admin-button-small admin-button-ghost" href={`/admin/exports/${batch.batchId}/download`} download aria-label={`ดาวน์โหลดชุด ${batch.batchNo} อีกครั้ง`}>ดาวน์โหลดอีกครั้ง</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default function ExportsPage(props: PageProps<"/admin/exports">) {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลด…</main>}>
      <ExportContent searchParams={props.searchParams} />
    </Suspense>
  );
}
