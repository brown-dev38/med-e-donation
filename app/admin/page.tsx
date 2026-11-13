import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logout } from "@/app/login/actions";

export const instant = false;

async function AdminDashboard() {
  const admin = await requireAdmin();
  const [donations, pending, completed, funds] = await Promise.all([
    prisma.donation.count(),
    prisma.donation.count({ where: { verificationStatus: "PENDING_SLIP_CHECK" } }),
    prisma.donation.count({ where: { verificationStatus: "COMPLETED_RD" } }),
    prisma.scholarshipFund.count({ where: { isActive: true } }),
  ]);
  const stats = [{ label: "รายการบริจาคทั้งหมด", value: donations }, { label: "รอตรวจสอบสลิป", value: pending }, { label: "นำส่งสรรพากรแล้ว", value: completed }, { label: "กองทุนที่เปิดใช้งาน", value: funds }];
  return (
    <div className="admin-page">
      <header className="admin-header"><Link href="/admin" className="admin-brand"><Image src="/images/LogoMed2.png" alt="ตราคณะแพทยศาสตร์" width={38} height={44} /><span><strong>MED UP e-Donation</strong><small>ระบบจัดการกองทุนทุนการศึกษา</small></span></Link><div className="admin-header-actions"><Link href="/">ดูหน้าเว็บไซต์ ↗</Link><form action={logout}><button type="submit">ออกจากระบบ</button></form></div></header>
      <main className="admin-main"><p className="admin-eyebrow">ADMIN DASHBOARD</p><div className="admin-welcome"><div><h1>สวัสดี, {admin.fullName}</h1><p>ภาพรวมกองทุนและรายการบริจาคทุนการศึกษา</p></div><span className="admin-role">ผู้ดูแลระบบ</span></div><div className="admin-stats">{stats.map(stat => <article key={stat.label}><p>{stat.label}</p><strong>{stat.value.toLocaleString("th-TH")}</strong><span>รายการ</span></article>)}</div><section className="admin-account"><div className="admin-account-icon" aria-hidden="true">✓</div><div><h2>เข้าสู่ระบบสำเร็จ</h2><p>บัญชี {admin.email}</p><p>สิทธิ์ผู้ดูแลระบบ · การเชื่อมต่อฐานข้อมูลพร้อมใช้งาน</p></div></section></main>
    </div>
  );
}

export default function AdminPage() {
  return <Suspense fallback={<main className="admin-loading" role="status">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ…</main>}><AdminDashboard /></Suspense>;
}
