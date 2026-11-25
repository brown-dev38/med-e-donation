import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminFrame from "./admin-frame";

export const STATUS_LABELS = {
  PENDING_SLIP_CHECK: "รอตรวจสลิป",
  WAITING_TREASURY_RD: "รอยืนยันกองคลัง",
  COMPLETED_RD: "ส่งสรรพากรแล้ว",
  REJECTED: "ไม่อนุมัติ",
} as const;

export type DonationStatus = keyof typeof STATUS_LABELS;

export function StatusBadge({ status }: { status: DonationStatus }) {
  return <span className={`admin-status admin-status-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

export const formatBaht = (amount: { toString(): string }) => Number(amount.toString()).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatThaiDateTime = (date: Date) =>
  date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** transfer_date (DATE) and transfer_time (TIME) are stored as UTC wall-clock values. */
export const formatTransfer = (date: Date, time: Date) =>
  `${date.toLocaleDateString("th-TH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })} ${time.toISOString().slice(11, 16)} น.`;

/** Dashboard frame (sidebar, top bar, footer) for every admin page. Checks the session first. */
export default async function AdminShell({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const [pending, waiting, toExport] = await Promise.all([
    prisma.donation.count({ where: { verificationStatus: "PENDING_SLIP_CHECK" } }),
    prisma.donation.count({ where: { verificationStatus: "WAITING_TREASURY_RD" } }),
    prisma.donation.count({ where: { verificationStatus: "WAITING_TREASURY_RD", needTaxDeduction: true, edonationExportStatus: "PENDING" } }),
  ]);
  return (
    <AdminFrame admin={{ fullName: admin.fullName, email: admin.email }} counts={{ pending, waiting, toExport }}>
      {children}
    </AdminFrame>
  );
}
