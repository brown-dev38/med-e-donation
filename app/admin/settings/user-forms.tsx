"use client";

import { Modal } from "antd";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/roles";
import type { AdminRole } from "@/generated/prisma/enums";
import { useConfirmedAction, useResultToast } from "@/app/components/feedback";
import { submitWithoutReset } from "./settings-forms";
import { createAdminUser, resetAdminPassword, updateAdminUser, updateAdminUserProfile } from "./user-actions";

export type UserRow = { userId: number; username: string; fullName: string; email: string; role: AdminRole; isActive: boolean };

function RoleOptions({ idPrefix, value, disabled }: { idPrefix: string; value: AdminRole; disabled?: boolean }) {
  return (
    <fieldset className="admin-role-options" disabled={disabled}>
      <legend className="admin-field">สิทธิ์การใช้งาน{disabled && <span className="admin-hint"> · เปลี่ยนสิทธิ์ของบัญชีตัวเองไม่ได้</span>}</legend>
      {ROLES.map((role) => (
        <label key={role} htmlFor={`${idPrefix}-role-${role}`}>
          <input type="radio" id={`${idPrefix}-role-${role}`} name="role" value={role} defaultChecked={role === value} />
          <span><strong>{ROLE_LABELS[role]}</strong><small>{ROLE_DESCRIPTIONS[role]}</small></span>
        </label>
      ))}
    </fieldset>
  );
}

function ProfileFields({ idPrefix, user }: { idPrefix: string; user?: UserRow }) {
  return (
    <>
      <div className="admin-two">
        <div className="admin-field-block"><label className="admin-field" htmlFor={`${idPrefix}-fullName`}>ชื่อ–นามสกุล</label><input className="admin-input" id={`${idPrefix}-fullName`} name="fullName" defaultValue={user?.fullName} required maxLength={255} autoComplete="off" /></div>
        <div className="admin-field-block"><label className="admin-field" htmlFor={`${idPrefix}-email`}>อีเมล (ใช้เข้าสู่ระบบ)</label><input className="admin-input" id={`${idPrefix}-email`} name="email" type="email" defaultValue={user?.email} required maxLength={255} autoComplete="off" /></div>
      </div>
      <div className="admin-field-block"><label className="admin-field" htmlFor={`${idPrefix}-username`}>ชื่อผู้ใช้</label><input className="admin-input" id={`${idPrefix}-username`} name="username" defaultValue={user?.username} required minLength={3} maxLength={100} pattern="[A-Za-z0-9._\-]+" autoComplete="off" /></div>
    </>
  );
}

export function AddUserForm() {
  const [state, action, pending] = useActionState(createAdminUser, null);
  const formRef = useRef<HTMLFormElement>(null);
  useResultToast(state);
  useEffect(() => { if (state?.status === "success") formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} onSubmit={submitWithoutReset(action)} className="admin-panel">
      <div className="admin-panel-head"><h2>เพิ่มผู้ใช้งาน</h2></div>
      <RoleOptions idPrefix="new" value="EMPLOYEE" />
      <ProfileFields idPrefix="new" />
      <div className="admin-field-block"><label className="admin-field" htmlFor="new-password">รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัว)</label><input className="admin-input" id="new-password" name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></div>
      <button type="submit" className="admin-button admin-users-submit" disabled={pending}>{pending ? "กำลังเพิ่ม…" : "เพิ่มผู้ใช้งาน"}</button>
    </form>
  );
}

/** Closes a modal once its action succeeds. */
function useCloseOnSuccess(state: { status: string } | null, close: () => void) {
  useEffect(() => { if (state?.status === "success") close(); }, [state, close]);
}

function EditUserModal({ user, isSelf, open, onClose }: { user: UserRow; isSelf: boolean; open: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateAdminUserProfile, null);
  useResultToast(state);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal open={open} onCancel={onClose} title={`แก้ไขข้อมูล ${user.fullName}`} footer={null} destroyOnHidden width={640} centered>
      <form onSubmit={submitWithoutReset(action)} className="admin-modal-form">
        <input type="hidden" name="userId" value={user.userId} />
        <ProfileFields idPrefix={`edit-${user.userId}`} user={user} />
        <RoleOptions idPrefix={`edit-${user.userId}`} value={user.role} disabled={isSelf} />
        <div className="admin-modal-actions">
          <button type="button" className="admin-button admin-button-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="admin-button" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({ user, open, onClose }: { user: UserRow; open: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState(resetAdminPassword, null);
  const [mismatch, setMismatch] = useState(false);
  useResultToast(state);
  useCloseOnSuccess(state, onClose);
  const submit = submitWithoutReset(action);
  return (
    <Modal open={open} onCancel={onClose} title={`เปลี่ยนรหัสผ่าน ${user.fullName}`} footer={null} destroyOnHidden centered>
      <form
        className="admin-modal-form"
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          if (data.get("password") !== data.get("confirm")) { event.preventDefault(); setMismatch(true); return; }
          setMismatch(false);
          submit(event);
        }}
      >
        <input type="hidden" name="userId" value={user.userId} />
        <p className="admin-hint">ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์ และต้องเข้าสู่ระบบด้วยรหัสผ่านใหม่</p>
        <div className="admin-field-block"><label className="admin-field" htmlFor={`pw-${user.userId}`}>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label><input className="admin-input" id={`pw-${user.userId}`} name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></div>
        <div className="admin-field-block"><label className="admin-field" htmlFor={`pw2-${user.userId}`}>ยืนยันรหัสผ่านใหม่</label><input className="admin-input" id={`pw2-${user.userId}`} name="confirm" type="password" required minLength={8} maxLength={256} autoComplete="new-password" aria-invalid={mismatch} aria-describedby={mismatch ? `pw2-${user.userId}-error` : undefined} /></div>
        {mismatch && <p className="admin-form-error" id={`pw2-${user.userId}-error`} role="alert">รหัสผ่านทั้งสองช่องไม่ตรงกัน</p>}
        <div className="admin-modal-actions">
          <button type="button" className="admin-button admin-button-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="admin-button" disabled={pending}>{pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Edit / password / unlock / enable-disable buttons for one row of the user table. */
export function UserRowActions({ user, isSelf, locked }: { user: UserRow; isSelf: boolean; locked: boolean }) {
  const { onSubmit, pending } = useConfirmedAction(updateAdminUser, (submitter) => {
    switch (submitter?.value) {
      case "deactivate": return { title: `ปิดใช้งานบัญชี ${user.fullName}?`, content: "ผู้ใช้จะถูกออกจากระบบทันที และเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง", okText: "ปิดใช้งาน", danger: true };
      case "activate": return { title: `เปิดใช้งานบัญชี ${user.fullName}?`, content: "ผู้ใช้จะเข้าสู่ระบบได้อีกครั้งด้วยรหัสผ่านเดิม", okText: "เปิดใช้งาน" };
      default: return { title: `ปลดล็อกบัญชี ${user.fullName}?`, content: "ล้างจำนวนครั้งที่ใส่รหัสผ่านผิด ผู้ใช้จะลองเข้าสู่ระบบได้ทันที", okText: "ปลดล็อก" };
    }
  });
  const [dialog, setDialog] = useState<"edit" | "password" | null>(null);
  const close = useCallback(() => setDialog(null), []);
  return (
    <div className="admin-row-actions admin-user-actions">
      <button type="button" className="admin-button admin-button-small admin-button-ghost" onClick={() => setDialog("edit")} aria-label={`แก้ไข ${user.fullName}`}>แก้ไข</button>
      <button type="button" className="admin-button admin-button-small admin-button-ghost" onClick={() => setDialog("password")} aria-label={`เปลี่ยนรหัสผ่าน ${user.fullName}`}>เปลี่ยนรหัสผ่าน</button>
      <form onSubmit={onSubmit} className="admin-row-actions">
        <input type="hidden" name="userId" value={user.userId} />
        {locked && <button type="submit" name="op" value="unlock" disabled={pending} className="admin-button admin-button-small admin-button-ghost" aria-label={`ปลดล็อก ${user.fullName}`}>ปลดล็อก</button>}
        {!isSelf && <button type="submit" name="op" value={user.isActive ? "deactivate" : "activate"} disabled={pending} className={`admin-button admin-button-small admin-button-ghost${user.isActive ? " admin-danger-text" : ""}`} aria-label={`${user.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"} ${user.fullName}`}>{user.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>}
      </form>
      <EditUserModal user={user} isSelf={isSelf} open={dialog === "edit"} onClose={close} />
      <PasswordModal user={user} open={dialog === "password"} onClose={close} />
    </div>
  );
}
