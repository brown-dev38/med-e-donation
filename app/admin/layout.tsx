import type { Metadata } from "next";
import { Suspense } from "react";
import { UiProvider } from "@/app/components/feedback";
import AdminShell from "./admin-shell";
import "./styles.css";
import "./review.css";
import "./dashboard.css";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ | MED e-Donation", robots: { index: false, follow: false } };
// Access may redirect based on a request-only session; skip instant UI validation.
export const instant = false;

// The dashboard frame (sidebar, top bar, footer) lives in the layout so it stays mounted while
// navigating between admin pages; only the page content below it swaps and shows its own loading state.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <UiProvider>
      <Suspense fallback={<main className="admin-loading" role="status">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ…</main>}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </UiProvider>
  );
}
