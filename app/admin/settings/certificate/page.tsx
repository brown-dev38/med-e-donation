import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { getCertificateSettings } from "@/lib/certificate-settings";
import { TEMPLATE_FIELDS } from "@/lib/thai-text";
import { CertificateSettingsEditor } from "../settings-forms";

export const metadata: Metadata = { title: "ตั้งค่าใบอนุโมทนาบัตร | MED e-Donation" };
export const instant = false;

async function CertificateSettingsPage() {
  await requireAdmin(); // each page checks the session itself; the layout does not re-render on navigation
  const { signatureImagePath, ...settings } = await getCertificateSettings();
  return (
    <main className="admin-main">
      <p className="admin-eyebrow">SETTINGS</p>
      <div className="admin-welcome"><div><h1>ใบอนุโมทนาบัตรและอีเมล</h1><p>ข้อความ ผู้ลงนาม ลายเซ็น และอีเมลที่ส่งถึงผู้บริจาค ใบที่ออกไปแล้วจะไม่เปลี่ยน เว้นแต่สั่งสร้าง PDF ใหม่ตอนส่งอีเมลอีกครั้ง</p></div></div>
      <CertificateSettingsEditor settings={{ ...settings, hasSignature: !!signatureImagePath }} fields={TEMPLATE_FIELDS} />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลด…</main>}><CertificateSettingsPage /></Suspense>
  );
}
