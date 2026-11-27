"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState, useSyncExternalStore } from "react";
import type { FocusEvent, FormEvent, MouseEvent, ReactNode } from "react";
import { logout } from "@/app/login/actions";
import type { AdminRole } from "@/generated/prisma/enums";
import { useConfirm } from "@/app/components/feedback";

type IconName = "dashboard" | "excel" | "slip" | "treasury" | "list" | "fund" | "students" | "certificate" | "site" | "logout" | "users";

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
    users: <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 10.6-5M18 14v6M15 17h6" /></>,
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

export default function AdminFrame({ admin, counts, children }: { admin: { fullName: string; email: string; role: AdminRole }; counts: { pending: number; waiting: number; toExport: number }; children: ReactNode }) {
  const pathname = usePathname();
  const status = useSearchParams().get("status");
  const isMobile = useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
  const [collapsed, setCollapsed] = useState(false); // desktop: sidebar hidden
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile: sidebar shown over the page
  const sidebarVisible = isMobile ? drawerOpen : !collapsed;
  const rail = collapsed && !isMobile; // desktop collapse keeps a narrow icon rail
  const confirm = useConfirm();
  // Hover/focus label for rail icons. Drawn with position: fixed so the scrolling menu cannot clip it.
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const allGroups: { title: string; adminOnly?: boolean; items: NavItem[] }[] = [
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
      adminOnly: true, // employees handle daily work only
      items: [
        { href: "/admin/settings", label: "กองทุนและการชำระเงิน", icon: "fund", match: (path) => path === "/admin/settings" },
        { href: "/admin/settings/students", label: "รายชื่อนิสิตผู้รับทุน", icon: "students", match: (path) => path === "/admin/settings/students" },
        { href: "/admin/settings/certificate", label: "ใบอนุโมทนาบัตรและอีเมล", icon: "certificate", match: (path) => path === "/admin/settings/certificate" },
        { href: "/admin/settings/users", label: "ผู้ใช้งานระบบ", icon: "users", match: (path) => path === "/admin/settings/users" },
      ],
    },
  ];
  const groups = allGroups.filter((group) => !group.adminOnly || admin.role === "ADMIN");
  const current = groups.flatMap((group) => group.items).find((item) => item.match(pathname, status));

  function toggleSidebar() {
    if (isMobile) setDrawerOpen(!drawerOpen);
    else setCollapsed(!collapsed);
    setTip(null);
  }

  function showTip(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) {
    const target = rail ? (event.target as Element).closest<HTMLElement>("[data-tip]") : null;
    if (!target) return setTip(null);
    const rect = target.getBoundingClientRect();
    setTip({ label: target.dataset.tip ?? "", top: rect.top + rect.height / 2, left: rect.right + 10 });
  }

  async function confirmLogout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await confirm({ title: "ออกจากระบบ?", content: "คุณต้องเข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ", okText: "ออกจากระบบ" })) startTransition(() => logout());
  }

  return (
    <div className={`admin-app ${rail ? "is-collapsed" : ""} ${drawerOpen ? "is-drawer-open" : ""}`}>
      <a className="admin-skip" href="#admin-content">ข้ามไปยังเนื้อหา</a>
      <aside id="admin-sidebar" className="admin-sidebar" aria-label="เมนูผู้ดูแล" inert={(isMobile && !drawerOpen) || undefined} onMouseOver={showTip} onMouseLeave={() => setTip(null)} onFocus={showTip} onBlur={() => setTip(null)}>
        <Link href="/admin" className="admin-sidebar-brand" onClick={() => setDrawerOpen(false)} data-tip="คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา">
          <span className="admin-sidebar-logo"><Image src="/images/LogoMed2.png" alt="" width={30} height={34} /></span>
          <span className="admin-sidebar-label"><strong>คณะแพทยศาสตร์</strong><small>มหาวิทยาลัยพะเยา</small></span>
        </Link>
        <nav className="admin-sidebar-nav" onScroll={() => setTip(null)}>
          {groups.map((group) => (
            <div key={group.title} className="admin-nav-group">
              <p className="admin-nav-title">{group.title}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={item === current ? "page" : undefined} onClick={() => setDrawerOpen(false)} data-tip={item.label}>
                      <Icon name={item.icon} />
                      <span className="admin-sidebar-label">{item.label}</span>
                      {item.count ? <span className="admin-nav-count" aria-label={item.countLabel ?? `${item.count} รายการ`} title={item.countLabel}>{item.count > 99 ? "99+" : item.count}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-sidebar-site" target="_blank" data-tip="ดูหน้าเว็บไซต์"><Icon name="site" /><span className="admin-sidebar-label">ดูหน้าเว็บไซต์</span></Link>
          <form onSubmit={confirmLogout}><button type="submit" className="admin-sidebar-logout" data-tip="ออกจากระบบ"><Icon name="logout" /><span className="admin-sidebar-label">ออกจากระบบ</span></button></form>
        </div>
      </aside>
      {rail && tip && <div className="admin-rail-tip" style={{ top: tip.top, left: tip.left }} aria-hidden="true">{tip.label}</div>}
      {isMobile && drawerOpen && <button type="button" className="admin-backdrop" aria-label="ปิดเมนู" onClick={() => setDrawerOpen(false)} />}

      <div className="admin-body">
        <header className="admin-topbar">
          <button type="button" className="admin-hamburger" onClick={toggleSidebar} aria-controls="admin-sidebar" aria-expanded={sidebarVisible} aria-label={sidebarVisible ? "ปิดเมนูด้านข้าง" : "เปิดเมนูด้านข้าง"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M9 4v16" />
              <path className="admin-hamburger-chevron" d="m15.5 10-2 2 2 2" />
            </svg>
          </button>
          <div className="admin-topbar-title">
            <strong>MED UP <em>e-Donation</em></strong>
            <span>ระบบจัดการทุนการศึกษา</span>
          </div>
          <div className="admin-topbar-user">
            <span className="admin-avatar" aria-hidden="true">{admin.fullName.trim().charAt(0) || "A"}</span>
            <span className="admin-user-text"><strong>{admin.fullName}</strong><small>{admin.email}</small></span>
          </div>
        </header>
        <div id="admin-content" className="admin-content" tabIndex={-1}>{children}</div>
        <footer className="admin-footer">
          <span>MED UP e-Donation · ระบบจัดการทุนการศึกษา</span>
          <span>© 2026 คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา</span>
        </footer>
      </div>
    </div>
  );
}
