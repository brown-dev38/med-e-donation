import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "../../admin-shell";
import { ROLE_LABELS } from "@/lib/roles";
import { AddUserForm, UserRowActions } from "../user-forms";

export const metadata: Metadata = { title: "ผู้ใช้งานระบบ | MED e-Donation" };
export const instant = false;

async function UserSettings() {
  const admin = await requireAdmin(); // each page checks the session itself; the layout does not re-render on navigation
  const users = await prisma.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { fullName: "asc" }],
    select: { userId: true, username: true, fullName: true, email: true, role: true, isActive: true, lastLoginAt: true, lockedUntil: true },
  });
  const now = new Date();
  const active = users.filter((user) => user.isActive).length;
  return (
    <main className="admin-main">
      <p className="admin-eyebrow">SETTINGS</p>
      <div className="admin-welcome"><div><h1>ผู้ใช้งานระบบ</h1><p>เพิ่มบัญชีและกำหนดสิทธิ์ ผู้ดูแลระบบทำได้ทุกอย่าง ส่วนเจ้าหน้าที่ตรวจรายการบริจาคและส่งออก Excel ได้แต่ไม่เห็นเมนูตั้งค่า</p></div></div>
      <div className="admin-settings-stack">
        <AddUserForm />
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>รายชื่อผู้ใช้งาน</h2><span className="admin-hint">ใช้งานอยู่ {active.toLocaleString("th-TH")} / {users.length.toLocaleString("th-TH")} บัญชี</span></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">ชื่อ–นามสกุล</th><th scope="col">ชื่อผู้ใช้</th><th scope="col">สิทธิ์</th><th scope="col">เข้าสู่ระบบล่าสุด</th><th scope="col">สถานะ</th><th scope="col"><span className="admin-sr-only">จัดการ</span></th></tr></thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.userId === admin.userId;
                  const locked = !!user.lockedUntil && user.lockedUntil > now;
                  return (
                    <tr key={user.userId}>
                      <td>{user.fullName}{isSelf && <span className="admin-user-self">คุณ</span>}<small>{user.email}</small></td>
                      <td>{user.username}</td>
                      <td className="admin-nowrap"><span className={`admin-role-badge admin-role-${user.role.toLowerCase()}`}>{ROLE_LABELS[user.role]}</span></td>
                      <td>{user.lastLoginAt ? formatThaiDateTime(user.lastLoginAt) : "—"}</td>
                      <td>
                        {user.isActive ? <span className="admin-status admin-status-completed_rd">ใช้งาน</span> : <span className="admin-status admin-status-rejected">ปิดใช้งาน</span>}
                        {locked && <small>ถูกล็อกชั่วคราว</small>}
                      </td>
                      <td>
                        <UserRowActions user={{ userId: user.userId, username: user.username, fullName: user.fullName, email: user.email, role: user.role, isActive: user.isActive }} isSelf={isSelf} locked={locked} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลด…</main>}><UserSettings /></Suspense>
  );
}
