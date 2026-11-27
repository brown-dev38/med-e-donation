import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { formatBaht } from "./admin-shell";

export const instant = false;

async function AdminDashboard() {
  const admin = await requireStaff();
  const [donations, pending, waiting, completed, funds, raised, overdue] = await Promise.all([
    prisma.donation.count(),
    prisma.donation.count({ where: { verificationStatus: "PENDING_SLIP_CHECK" } }),
    prisma.donation.count({ where: { verificationStatus: "WAITING_TREASURY_RD" } }),
    prisma.donation.count({ where: { verificationStatus: "COMPLETED_RD" } }),
    prisma.scholarshipFund.count({ where: { isActive: true } }),
    prisma.donation.aggregate({ where: { verificationStatus: { in: ["WAITING_TREASURY_RD", "COMPLETED_RD"] } }, _sum: { amount: true } }),
    prisma.donation.count({ where: { verificationStatus: { in: ["PENDING_SLIP_CHECK", "WAITING_TREASURY_RD"] }, edonationSlaDueDate: { lt: new Date() } } }),
  ]);
  const stats = [
    { label: "รอตรวจสลิป", value: pending, unit: "รายการ", href: "/admin/donations", tone: "warn" },
    { label: "รอยืนยันกองคลัง", value: waiting, unit: "รายการ", href: "/admin/donations?status=WAITING_TREASURY_RD", tone: "info" },
    { label: "นำส่งสรรพากรแล้ว", value: completed, unit: "รายการ", href: "/admin/donations?status=COMPLETED_RD", tone: "ok" },
    { label: "รายการบริจาคทั้งหมด", value: donations, unit: "รายการ", href: "/admin/donations?status=ALL", tone: "plain" },
  ];

  return (
    <main className="admin-main">
      <div className="admin-welcome">
        <div><p className="admin-eyebrow">ADMIN DASHBOARD</p><h1>สวัสดี, {admin.fullName}</h1><p>ภาพรวมกองทุนและรายการบริจาคทุนการศึกษา</p></div>
        <span className="admin-role">{ROLE_LABELS[admin.role]}</span>
      </div>
      <div className="admin-stats">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className={`admin-stat admin-stat-${stat.tone}`}>
            <p>{stat.label}</p>
            <strong>{stat.value.toLocaleString("th-TH")}</strong>
            <span>{stat.unit}</span>
          </Link>
        ))}
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>ยอดบริจาคที่ตรวจสอบแล้ว</h2></div>
          <p className="admin-big-number">{formatBaht(raised._sum.amount ?? 0)} <span>บาท</span></p>
          <p className="admin-hint">รวมรายการที่ผ่านอนุมัติครั้งที่ 1 ขึ้นไป · กองทุนที่เปิดรับบริจาค {funds.toLocaleString("th-TH")} กองทุน{funds === 0 && <> — <Link href="/admin/settings" className="admin-inline-link">ตั้งค่ากองทุน</Link></>}</p>
        </section>
        <section className={`admin-panel ${overdue > 0 ? "admin-panel-alert" : ""}`}>
          <div className="admin-panel-head"><h2>กรอบเวลา e-Donation 2 สัปดาห์</h2></div>
          <p className="admin-big-number">{overdue.toLocaleString("th-TH")} <span>รายการเกินกำหนด</span></p>
          <p className="admin-hint">{overdue > 0 ? "มีรายการที่ยังไม่นำส่งสรรพากรเกิน 14 วันนับจากวันโอน" : "ไม่มีรายการเกินกำหนด"}</p>
        </section>
      </div>
      {pending > 0 && (
        <section className="admin-account admin-pending-callout">
          <div className="admin-account-icon" aria-hidden="true">!</div>
          <div><h2>มีสลิปรอตรวจสอบ {pending.toLocaleString("th-TH")} รายการ</h2><p>ตรวจชื่อ สลิป และเลขผู้เสียภาษีให้ตรงกับ Book Bank แล้วกดอนุมัติครั้งที่ 1</p></div>
          <Link href="/admin/donations" className="admin-button">ไปตรวจสอบ →</Link>
        </section>
      )}
      <section className="admin-account">
        <div className="admin-account-icon" aria-hidden="true">✓</div>
        <div><h2>เข้าสู่ระบบสำเร็จ</h2><p>บัญชี {admin.email}</p><p>สิทธิ์{ROLE_LABELS[admin.role]} · การเชื่อมต่อฐานข้อมูลพร้อมใช้งาน</p></div>
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลด…</main>}><AdminDashboard /></Suspense>
  );
}
