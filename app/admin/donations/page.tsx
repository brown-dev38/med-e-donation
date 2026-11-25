import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatThaiDateTime, formatTransfer, STATUS_LABELS, StatusBadge, type DonationStatus } from "../admin-shell";

export const metadata: Metadata = { title: "ตรวจสอบรายการบริจาค | MED e-Donation" };
export const instant = false;

const PAGE_SIZE = 30;
const STATUSES = Object.keys(STATUS_LABELS) as DonationStatus[];
const TAB_STEP: Record<string, string> = { PENDING_SLIP_CHECK: "อนุมัติครั้งที่ 1", WAITING_TREASURY_RD: "อนุมัติครั้งที่ 2" };
const TAB_HELP: Record<string, string> = {
  PENDING_SLIP_CHECK: "เปิดรายการเพื่อดูสลิป ตรวจชื่อ–สลิป–เลขผู้เสียภาษีกับ Book Bank แล้วกดอนุมัติครั้งที่ 1 ระบบจะส่งใบอนุโมทนาบัตรทางอีเมล",
  WAITING_TREASURY_RD: "รายการที่ส่งใบอนุโมทนาบัตรแล้ว เมื่อกองคลังยืนยันและคีย์ข้อมูลเข้าระบบ e-Donation กรมสรรพากรแล้ว ให้กดอนุมัติครั้งที่ 2",
  COMPLETED_RD: "รายการที่นำส่งข้อมูลกรมสรรพากรและส่งอีเมลยืนยันผู้บริจาคเรียบร้อยแล้ว",
  REJECTED: "รายการที่ตรวจแล้วไม่อนุมัติ พร้อมเหตุผล",
  ALL: "รายการบริจาคทุกสถานะ",
};

function buildHref(params: { status: string; q: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.status !== "PENDING_SLIP_CHECK") search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return `/admin/donations${query ? `?${query}` : ""}`;
}

async function DonationList({ searchParams }: { searchParams: PageProps<"/admin/donations">["searchParams"] }) {
  await requireAdmin();
  const params = await searchParams;
  const status = typeof params.status === "string" && (params.status === "ALL" || STATUSES.includes(params.status as DonationStatus)) ? params.status : "PENDING_SLIP_CHECK";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));

  const where: Prisma.DonationWhereInput = {
    ...(status !== "ALL" && { verificationStatus: status as DonationStatus }),
    ...(q && { OR: [{ referenceNo: { contains: q } }, { donorName: { contains: q } }, { email: { contains: q.toLowerCase() } }, { certificate: { documentNo: { contains: q } } }] }),
  };
  const [rows, total, counts] = await Promise.all([
    prisma.donation.findMany({
      where,
      // Oldest first while waiting, so the 2-week deadline is worked in order.
      orderBy: status === "PENDING_SLIP_CHECK" ? { createdAt: "asc" } : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        donationId: true, referenceNo: true, donorPrefix: true, donorName: true, taxIdMasked: true, amount: true, transferDate: true, transferTime: true,
        studentRecipientName: true, verificationStatus: true, createdAt: true, edonationSlaDueDate: true,
        fund: { select: { fundCode: true } }, certificate: { select: { documentNo: true } },
        notifications: { where: { notifyType: "POSSIBLE_DUPLICATE_SLIP" }, select: { notificationId: true }, take: 1 },
      },
    }),
    prisma.donation.count({ where }),
    prisma.donation.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
  ]);
  const countFor = (key: string) => key === "ALL" ? counts.reduce((sum, row) => sum + row._count._all, 0) : counts.find((row) => row.verificationStatus === key)?._count._all ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="admin-main">
      <p className="admin-eyebrow">DONATIONS</p>
      <div className="admin-welcome"><div><h1>ตรวจสอบรายการบริจาค</h1><p>{TAB_HELP[status]}</p></div></div>
      <nav className="admin-tabs" aria-label="กรองตามสถานะ">
        {[...STATUSES, "ALL"].map((key) => (
          <Link key={key} href={buildHref({ status: key, q })} aria-current={status === key ? "page" : undefined}>
            {key === "ALL" ? "ทั้งหมด" : STATUS_LABELS[key as DonationStatus]}
            {TAB_STEP[key] && <small className="admin-tab-step">{TAB_STEP[key]}</small>}
            <span>{countFor(key).toLocaleString("th-TH")}</span>
          </Link>
        ))}
      </nav>
      <form className="admin-search" action="/admin/donations" role="search">
        {status !== "PENDING_SLIP_CHECK" && <input type="hidden" name="status" value={status} />}
        <label htmlFor="q" className="admin-sr-only">ค้นหา</label>
        <input id="q" name="q" defaultValue={q} placeholder="ค้นหาเลขอ้างอิง, เลขใบอนุโมทนาบัตร, ชื่อผู้บริจาค หรืออีเมล" maxLength={100} />
        <button type="submit">ค้นหา</button>
        {q && <Link href={buildHref({ status, q: "" })}>ล้าง</Link>}
      </form>

      {rows.length === 0 ? (
        <p className="admin-empty">{q ? "ไม่พบรายการที่ตรงกับคำค้นหา" : status === "PENDING_SLIP_CHECK" ? "ไม่มีสลิปรอตรวจสอบ" : "ยังไม่มีรายการในสถานะนี้"}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">เลขอ้างอิง</th><th scope="col">วัน–เวลาที่โอน</th><th scope="col">ผู้บริจาค</th><th scope="col">ทุน / นิสิต</th><th scope="col" className="admin-num">จำนวนเงิน (บาท)</th><th scope="col">สถานะ</th><th scope="col"><span className="admin-sr-only">ดำเนินการ</span></th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const overdue = row.verificationStatus !== "COMPLETED_RD" && row.verificationStatus !== "REJECTED" && row.edonationSlaDueDate && row.edonationSlaDueDate.toISOString().slice(0, 10) < today;
                return (
                  <tr key={row.donationId}>
                    <td><strong className="admin-ref">{row.referenceNo}</strong>{row.certificate && <small>{row.certificate.documentNo}</small>}<small>ส่งเมื่อ {formatThaiDateTime(row.createdAt)}</small></td>
                    <td>{formatTransfer(row.transferDate, row.transferTime)}</td>
                    <td>{row.donorPrefix} {row.donorName}<small>{row.taxIdMasked}</small></td>
                    <td>{row.fund.fundCode === "SPECIFIC_STUDENT" || row.studentRecipientName ? <>ระบุชื่อนิสิต<small>{row.studentRecipientName}</small></> : "คณะจัดสรร"}</td>
                    <td className="admin-num"><strong>{formatBaht(row.amount)}</strong></td>
                    <td><StatusBadge status={row.verificationStatus} />{row.notifications.length > 0 && <span className="admin-flag">สลิปอาจซ้ำ</span>}{overdue && <span className="admin-flag">เกิน 2 สัปดาห์</span>}</td>
                    <td><Link className="admin-button admin-button-small" href={`/admin/donations/${row.donationId}`} aria-label={`เปิดรายการ ${row.referenceNo}`}>{row.verificationStatus === "PENDING_SLIP_CHECK" ? "ตรวจสอบ" : "ดู"}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="admin-pager" aria-label="หน้า">
          {page > 1 ? <Link href={buildHref({ status, q, page: page - 1 })}>← ก่อนหน้า</Link> : <span />}
          <span>หน้า {page} / {pages} · {total.toLocaleString("th-TH")} รายการ</span>
          {page < pages ? <Link href={buildHref({ status, q, page: page + 1 })}>ถัดไป →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}

export default function DonationsPage(props: PageProps<"/admin/donations">) {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลดรายการ…</main>}>
      <DonationList searchParams={props.searchParams} />
    </Suspense>
  );
}
