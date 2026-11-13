import type { Metadata } from "next";
import { Suspense } from "react";
import "./styles.css";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ | MED e-Donation", robots: { index: false, follow: false } };
// Access may redirect based on a request-only session; skip instant UI validation.
export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="admin-loading" role="status">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ…</main>}>{children}</Suspense>;
}
