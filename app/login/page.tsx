import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import LoginForm from "./login-form";
import "./styles.css";

export const metadata: Metadata = { title: "เข้าสู่ระบบผู้ดูแล | MED UP e-Donation", robots: { index: false, follow: false } };
export const instant = false;

async function LoginContent() {
  if (await getCurrentAdmin()) redirect("/admin");
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-shell">
        <aside className="login-story">
          <Link href="/" className="login-brand"><Image src="/images/LogoMed2.png" alt="ตราคณะแพทยศาสตร์" width={52} height={58} /><span><strong>MED UP e-Donation</strong><small>คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา</small></span></Link>
          <div className="login-story-copy"><span className="login-eyebrow">SCHOLARSHIP FUND MANAGEMENT</span><h1>ทุกโอกาสที่ส่งต่อ<br />เริ่มจากการดูแล<br /><span>ที่ใส่ใจ.</span></h1><p>พื้นที่สำหรับเจ้าหน้าที่ดูแลการบริจาค<br />เพื่อส่งต่อโอกาสทางการศึกษาให้นิสิตแพทย์</p><div className="login-story-line" /></div>
          <span className="login-story-footer">ให้โอกาสทางการศึกษา สร้างอนาคตทางการแพทย์</span>
        </aside>
        <section className="login-panel" aria-labelledby="login-title">
          <Link href="/" className="login-back">← กลับหน้าเว็บไซต์</Link>
          <div className="login-panel-content"><span className="login-badge"><span /> ADMIN PORTAL</span><h2 id="login-title">ยินดีต้อนรับกลับ</h2><p className="login-description">เข้าสู่ระบบเพื่อจัดการกองทุนและรายการบริจาค</p><Suspense fallback={<p role="status">กำลังตรวจสอบการเข้าสู่ระบบ…</p>}><LoginContent /></Suspense></div>
          <p className="login-panel-footer">© 2026 คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา</p>
        </section>
      </div>
    </main>
  );
}
