import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatThaiDateTime, formatTransfer, StatusBadge } from "../../admin-shell";
import { RdPanel, ResendEmail, ReviewPanel, TaxIdReveal } from "./review-panel";

export const metadata: Metadata = { title: "ตรวจสอบสลิป | MED e-Donation" };
export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIT_LABELS: Record<string, string> = {
  APPROVE_SLIP: "อนุมัติครั้งที่ 1",
  REJECT_SLIP: "ไม่อนุมัติ",
  VIEW_TAX_ID: "ดูเลขผู้เสียภาษีเต็ม",
  APPROVE_RD_SUBMISSION: "อนุมัติครั้งที่ 2 (คีย์ e-Donation แล้ว)",
  RESEND_CERTIFICATE_EMAIL: "ส่งอีเมลใบอนุโมทนาบัตรอีกครั้ง",
  RESEND_RD_EMAIL: "ส่งอีเมลยืนยันสรรพากรอีกครั้ง",
};
const EMAIL_STATUS = { SENT: "ส่งแล้ว", FAILED: "ส่งไม่สำเร็จ", PENDING: "ยังไม่ได้ส่ง" } as const;

async function DonationDetail({ params }: { params: PageProps<"/admin/donations/[id]">["params"] }) {
  await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const donation = await prisma.donation.findUnique({
    where: { donationId: id },
    include: {
      fund: { select: { fundNameTh: true, bankName: true, bankAccountNo: true } },
      certificate: { include: { issuer: { select: { fullName: true } } } },
      slipVerifier: { select: { fullName: true } },
      rdSubmitter: { select: { fullName: true } },
    },
  });
  if (!donation) notFound();

  const [duplicates, history] = await Promise.all([
    prisma.donation.findMany({
      where: {
        donationId: { not: donation.donationId },
        OR: [...(donation.slipFileHash ? [{ slipFileHash: donation.slipFileHash }] : []), { transferDate: donation.transferDate, transferTime: donation.transferTime, amount: donation.amount }],
      },
      select: { donationId: true, referenceNo: true, donorName: true, verificationStatus: true, slipFileHash: true },
      take: 10,
    }),
    prisma.auditLog.findMany({ where: { targetTable: "donations", targetId: donation.donationId }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { fullName: true } } } }),
  ]);
  const slipUrl = `/admin/slips/${donation.donationId}`;
  const pending = donation.verificationStatus === "PENDING_SLIP_CHECK";

  return (
    <main className="admin-main">
      <Link href="/admin/donations" className="admin-back">← กลับรายการบริจาค</Link>
      <div className="admin-welcome admin-detail-title">
        <div><p className="admin-eyebrow">DONATION</p><h1>{donation.referenceNo}</h1><p>ส่งเมื่อ {formatThaiDateTime(donation.createdAt)}{donation.edonationSlaDueDate && ` · ครบกำหนด e-Donation ${donation.edonationSlaDueDate.toLocaleDateString("th-TH", { timeZone: "UTC", dateStyle: "medium" })}`}</p></div>
        <StatusBadge status={donation.verificationStatus} />
      </div>

      {duplicates.length > 0 && (
        <div className="admin-warning" role="note">
          <strong>ตรวจสอบเป็นพิเศษ: อาจเป็นสลิปซ้ำ</strong>
          <ul>{duplicates.map((dup) => <li key={dup.donationId}><Link href={`/admin/donations/${dup.donationId}`}>{dup.referenceNo}</Link> — {dup.donorName} ({dup.slipFileHash === donation.slipFileHash ? "ไฟล์สลิปเดียวกัน" : "วันเวลาและยอดเงินตรงกัน"}) <StatusBadge status={dup.verificationStatus} /></li>)}</ul>
        </div>
      )}

      <div className="admin-detail">
        <section className="admin-panel admin-slip" aria-labelledby="slip-title">
          <div className="admin-panel-head"><h2 id="slip-title">สลิปโอนเงิน</h2><a href={slipUrl} target="_blank" rel="noopener noreferrer">เปิดภาพเต็ม ↗</a></div>
          {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated image; must not go through the image optimizer cache */}
          <img src={slipUrl} alt={`สลิปโอนเงินของรายการ ${donation.referenceNo}`} />
        </section>

        <div className="admin-detail-side">
          <section className="admin-panel" aria-labelledby="compare-title">
            <div className="admin-panel-head"><h2 id="compare-title">ข้อมูลที่ต้องตรงกับสลิปและ Book Bank</h2></div>
            <dl className="admin-facts">
              <div className="admin-fact-strong"><dt>จำนวนเงิน</dt><dd>{formatBaht(donation.amount)} บาท</dd></div>
              <div className="admin-fact-strong"><dt>วัน–เวลาที่โอน</dt><dd>{formatTransfer(donation.transferDate, donation.transferTime)}</dd></div>
              <div><dt>ชื่อผู้บริจาค</dt><dd>{donation.donorPrefix} {donation.donorName}</dd></div>
              <div><dt>ประเภท</dt><dd>{donation.donorType === "CORPORATE" ? "นิติบุคคล" : "บุคคลธรรมดา"}</dd></div>
              <div><dt>เลขประจำตัวผู้เสียภาษี</dt><dd><TaxIdReveal donationId={donation.donationId} masked={donation.taxIdMasked} /></dd></div>
              <div><dt>บัญชีรับเงิน</dt><dd>{donation.fund.bankName} {donation.fund.bankAccountNo}</dd></div>
            </dl>
          </section>
          <section className="admin-panel" aria-labelledby="donor-title">
            <div className="admin-panel-head"><h2 id="donor-title">รายละเอียดการบริจาค</h2></div>
            <dl className="admin-facts">
              <div><dt>วัตถุประสงค์</dt><dd>{donation.fund.fundNameTh}</dd></div>
              {donation.studentRecipientName && <div><dt>นิสิตผู้รับทุน</dt><dd>{donation.studentRecipientName}{donation.studentRecipientCode && ` (${donation.studentRecipientCode})`}</dd></div>}
              <div><dt>อีเมล</dt><dd>{donation.email}</dd></div>
              <div><dt>โทรศัพท์</dt><dd>{donation.phone}</dd></div>
              <div><dt>ลดหย่อนภาษี e-Donation</dt><dd>{donation.needTaxDeduction ? "ต้องการ" : "ไม่ต้องการ"}</dd></div>
            </dl>
          </section>

          {pending ? (
            <ReviewPanel donationId={donation.donationId} />
          ) : (
            <section className="admin-panel" aria-labelledby="result-title">
              <div className="admin-panel-head"><h2 id="result-title">ผลการตรวจสอบ</h2></div>
              <dl className="admin-facts">
                {donation.verificationStatus === "REJECTED" ? (
                  <div><dt>เหตุผลที่ไม่อนุมัติ</dt><dd>{donation.rejectionReason}</dd></div>
                ) : (
                  <>
                    <div><dt>อนุมัติครั้งที่ 1 โดย</dt><dd>{donation.slipVerifier?.fullName ?? "—"}{donation.slipVerifiedAt && ` · ${formatThaiDateTime(donation.slipVerifiedAt)}`}</dd></div>
                    {donation.certificate && (
                      <div className="admin-fact-strong"><dt>เลขที่ใบอนุโมทนาบัตร</dt><dd>{donation.certificate.documentNo} <a className="admin-inline-link" href={`/admin/certificates/${donation.donationId}`} target="_blank" rel="noopener noreferrer">เปิด PDF ↗</a></dd></div>
                    )}
                    {donation.certificate && (
                      <div>
                        <dt>อีเมลฉบับที่ 1 (ใบอนุโมทนาบัตร)</dt>
                        <dd>
                          <span className={`admin-email admin-email-${donation.certificate.emailSentStatus.toLowerCase()}`}>{EMAIL_STATUS[donation.certificate.emailSentStatus]}</span>
                          {donation.certificate.emailSentAt && ` · ${formatThaiDateTime(donation.certificate.emailSentAt)}`}
                          <ResendEmail donationId={donation.donationId} kind="certificate" label={donation.certificate.emailSentStatus === "SENT" ? "ส่งอีเมลอีกครั้ง" : "ส่งอีเมลใบอนุโมทนาบัตร"} allowRegenerate />
                        </dd>
                      </div>
                    )}
                    {donation.verificationStatus === "COMPLETED_RD" && (
                      <>
                        <div><dt>อนุมัติครั้งที่ 2 โดย</dt><dd>{donation.rdSubmitter?.fullName ?? "—"}{donation.rdSubmittedAt && ` · ${formatThaiDateTime(donation.rdSubmittedAt)}`}</dd></div>
                        <div>
                          <dt>อีเมลฉบับที่ 2 (ยืนยันสรรพากร)</dt>
                          <dd>
                            {!donation.needTaxDeduction ? "ไม่ส่ง (ไม่ประสงค์ลดหย่อนภาษี)" : donation.rdConfirmEmailSentAt
                              ? <><span className="admin-email admin-email-sent">ส่งแล้ว</span> · {formatThaiDateTime(donation.rdConfirmEmailSentAt)}</>
                              : <span className="admin-email admin-email-failed">ยังไม่ได้ส่ง</span>}
                            {donation.needTaxDeduction && <ResendEmail donationId={donation.donationId} kind="rd" label={donation.rdConfirmEmailSentAt ? "ส่งอีเมลอีกครั้ง" : "ส่งอีเมลยืนยัน"} />}
                          </dd>
                        </div>
                      </>
                    )}
                  </>
                )}
              </dl>
            </section>
          )}

          {donation.verificationStatus === "WAITING_TREASURY_RD" && <RdPanel donationId={donation.donationId} needTaxDeduction={donation.needTaxDeduction} />}

          {history.length > 0 && (
            <section className="admin-panel" aria-labelledby="history-title">
              <div className="admin-panel-head"><h2 id="history-title">ประวัติการดำเนินการ</h2></div>
              <ol className="admin-history">{history.map((log) => <li key={String(log.logId)}><strong>{AUDIT_LABELS[log.action] ?? log.action}</strong><span>{log.user?.fullName ?? "ระบบ"} · {formatThaiDateTime(log.createdAt)}</span></li>)}</ol>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export default function DonationDetailPage(props: PageProps<"/admin/donations/[id]">) {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลดรายการ…</main>}>
      <DonationDetail params={props.params} />
    </Suspense>
  );
}
