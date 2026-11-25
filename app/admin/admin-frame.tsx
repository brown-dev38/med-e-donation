"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";

// Shown in the footer of every admin page.
export const ADMIN_CREDIT = "พัฒนาระบบโดย งานเทคโนโลยีสารสนเทศ คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา";

type IconName = "dashboard" | "excel" | "slip" | "treasury" | "list" | "fund" | "students" | "certificate" | "site" | "logout";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
    slip: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
    treasury: <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" /></>,
    list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
    excel: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8.5 12.5l4 5M12.5 12.5l-4 5" /></>,
    fund: <><rect x="2.5" y="6" width="19" height="13" rx="2" /><path d="M2.5 10h19M6.5 15h4" /></>,
    students: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
    certificate: <><rect x="3" y="4" width="18" height="13" rx="1.5" /><path d="M7 9h10M7 12.5h6M15 17v4l2-1.2 2 1.2v-4" /></>,
    site: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
    logout: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h11" />,
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

type NavItem = { href: string; label: string; icon: IconName; count?: number; countLabel?: string; match: (path: string, status: string | null) => boolean };

const MOBILE_QUERY = "(max-width: 960px)";
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};

export default function AdminFrame({ admin, counts, children }: { admin: { fullName: string; email: string }; counts: { pending: number; waiting: number; toExport: number }; children: ReactNode }) {
  const pathname = usePathname();
  const status = useSearchParams().get("status");
  const isMobile = useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
  const [collapsed, setCollapsed] = useState(false); // desktop: sidebar hidden
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile: sidebar shown over the page
  const sidebarVisible = isMobile ? drawerOpen : !collapsed;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "งานประจำวัน",
      items: [
        { href: "/admin", label: "ภาพรวม", icon: "dashboard", match: (path) => path === "/admin" },
        // One menu for the whole review queue; the list page splits it into status tabs.
        { href: "/admin/donations", label: "รายการบริจาค", icon: "list", count: counts.pending + counts.waiting, countLabel: `รอตรวจสลิป ${counts.pending} รายการ รอยืนยันกองคลัง ${counts.waiting} รายการ`, match: (path) => path === "/admin/donations" || path.startsWith("/admin/donations/") },
        { href: "/admin/exports", label: "ส่งออก Excel e-Donation", icon: "excel", count: counts.toExport, countLabel: `รอส่งออก ${counts.toExport} รายการ`, match: (path) => path === "/admin/exports" },
      ],
    },
    {
      title: "ตั้งค่า",
      items: [
        { href: "/admin/settings", label: "กองทุนและการชำระเงิน", icon: "fund", match: (path) => path === "/admin/settings" },
        { href: "/admin/settings/students", label: "รายชื่อนิสิตผู้รับทุน", icon: "students", match: (path) => path === "/admin/settings/students" },
        { href: "/admin/settings/certificate", label: "ใบอนุโมทนาบัตรและอีเมล", icon: "certificate", match: (path) => path === "/admin/settings/certificate" },
      ],
    },
  ];
  const current = groups.flatMap((group) => group.items).find((item) => item.match(pathname, status));

  function toggleSidebar() {
    if (isMobile) setDrawerOpen(!drawerOpen);
    else setCollapsed(!collapsed);
  }

  return (
    <div className={`admin-app ${collapsed ? "is-collapsed" : ""} ${drawerOpen ? "is-drawer-open" : ""}`}>
      <a className="admin-skip" href="#admin-content">ข้ามไปยังเนื้อหา</a>
      <aside id="admin-sidebar" className="admin-sidebar" aria-label="เมนูผู้ดูแล" inert={!sidebarVisible || undefined}>
        <Link href="/admin" className="admin-sidebar-brand" onClick={() => setDrawerOpen(false)}>
          <Image src="/images/LogoMed2.png" alt="" width={34} height={38} />
          <span><strong>MED UP <em>e-Donation</em></strong><small>ระบบจัดการกองทุนทุนการศึกษา</small></span>
        </Link>
        <nav className="admin-sidebar-nav">
          {groups.map((group) => (
            <div key={group.title} className="admin-nav-group">
              <p className="admin-nav-title">{group.title}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={item === current ? "page" : undefined} onClick={() => setDrawerOpen(false)}>
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      {item.count ? <span className="admin-nav-count" aria-label={item.countLabel ?? `${item.count} รายการ`} title={item.countLabel}>{item.count > 99 ? "99+" : item.count}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <Link href="/" className="admin-sidebar-site" target="_blank"><Icon name="site" /><span>ดูหน้าเว็บไซต์</span></Link>
      </aside>
      {isMobile && drawerOpen && <button type="button" className="admin-backdrop" aria-label="ปิดเมนู" onClick={() => setDrawerOpen(false)} />}

      <div className="admin-body">
        <header className="admin-topbar">
          <button type="button" className="admin-hamburger" onClick={toggleSidebar} aria-controls="admin-sidebar" aria-expanded={sidebarVisible} aria-label={sidebarVisible ? "ปิดเมนูด้านข้าง" : "เปิดเมนูด้านข้าง"}>
            <span /><span /><span />
          </button>
          <div className="admin-topbar-title">
            <span>ผู้ดูแลระบบ</span>
            <strong>{pathname.startsWith("/admin/donations/") ? "รายละเอียดรายการบริจาค" : current?.label ?? "ผู้ดูแลระบบ"}</strong>
          </div>
          <div className="admin-topbar-user">
            <span className="admin-avatar" aria-hidden="true">{admin.fullName.trim().charAt(0) || "A"}</span>
            <span className="admin-user-text"><strong>{admin.fullName}</strong><small>{admin.email}</small></span>
            <form action={logout}><button type="submit" className="admin-logout"><Icon name="logout" /><span>ออกจากระบบ</span></button></form>
          </div>
        </header>
        <div id="admin-content" className="admin-content" tabIndex={-1}>{children}</div>
        <footer className="admin-footer">
          <span>© 2026 คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา · MED UP e-Donation</span>
          <span>{ADMIN_CREDIT}</span>
        </footer>
      </div>
    </div>
  );
}
