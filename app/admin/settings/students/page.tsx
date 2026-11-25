import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStudent } from "../actions";
import { AddStudentsForm } from "../settings-forms";

export const metadata: Metadata = { title: "รายชื่อนิสิต | MED e-Donation" };
export const instant = false;

async function StudentSettings() {
  await requireAdmin(); // each page checks the session itself; the layout does not re-render on navigation
  const students = await prisma.scholarshipStudent.findMany({ orderBy: [{ isActive: "desc" }, { fullName: "asc" }] });
  const active = students.filter((student) => student.isActive).length;
  return (
    <main className="admin-main">
      <p className="admin-eyebrow">SETTINGS</p>
      <div className="admin-welcome"><div><h1>รายชื่อนิสิตผู้รับทุน</h1><p>เมื่อมีรายชื่อที่เปิดใช้งาน ทุนแบบระบุชื่อนิสิตจะให้ผู้บริจาคเลือกจากรายการนี้ ถ้าไม่มีรายชื่อ ผู้บริจาคจะพิมพ์ชื่อเอง</p></div></div>
      <div className="admin-settings-stack">
        <AddStudentsForm />
        <section className="admin-panel">
          <div className="admin-panel-head"><h2>รายชื่อทั้งหมด</h2><span className="admin-hint">แสดงบนฟอร์ม {active.toLocaleString("th-TH")} / {students.length.toLocaleString("th-TH")} คน</span></div>
          {students.length === 0 ? <p className="admin-empty">ยังไม่มีรายชื่อ ผู้บริจาคจะพิมพ์ชื่อนิสิตเอง</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th scope="col">ชื่อ–นามสกุล</th><th scope="col">รหัสนิสิต</th><th scope="col">ชั้นปี</th><th scope="col">สถานะ</th><th scope="col"><span className="admin-sr-only">จัดการ</span></th></tr></thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.fullName}</td>
                      <td>{student.studentCode ?? "—"}</td>
                      <td>{student.yearLevel ?? "—"}</td>
                      <td>{student.isActive ? <span className="admin-status admin-status-completed_rd">แสดงบนฟอร์ม</span> : <span className="admin-status admin-status-rejected">ซ่อน</span>}</td>
                      <td>
                        <form action={updateStudent} className="admin-row-actions">
                          <input type="hidden" name="studentId" value={student.studentId} />
                          <button type="submit" name="op" value={student.isActive ? "deactivate" : "activate"} className="admin-button admin-button-small admin-button-ghost" aria-label={`${student.isActive ? "ซ่อน" : "แสดง"} ${student.fullName}`}>{student.isActive ? "ซ่อน" : "แสดง"}</button>
                          <button type="submit" name="op" value="delete" className="admin-button admin-button-small admin-button-ghost admin-danger-text" aria-label={`ลบ ${student.fullName}`}>ลบ</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<main className="admin-main" role="status">กำลังโหลด…</main>}><StudentSettings /></Suspense>
  );
}
