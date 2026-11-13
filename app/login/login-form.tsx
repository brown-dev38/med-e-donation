"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="login-form">
      <div className="login-field">
        <label htmlFor="email">อีเมลผู้ดูแลระบบ</label>
        <input id="email" name="email" type="email" autoComplete="username" placeholder="name@up.ac.th" maxLength={255} required aria-describedby={state?.error ? "login-error" : undefined} />
      </div>
      <div className="login-field">
        <label htmlFor="password">รหัสผ่าน</label>
        <div className="login-password">
          <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" maxLength={256} required aria-describedby={state?.error ? "login-error" : undefined} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword}>{showPassword ? "ซ่อน" : "แสดง"}</button>
        </div>
      </div>
      {state?.error && <p id="login-error" className="login-error" role="alert">{state.error}</p>}
      <button type="submit" className="login-submit" disabled={pending}>{pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}<span aria-hidden="true">→</span></button>
      <p className="login-help">สำหรับเจ้าหน้าที่ที่ได้รับสิทธิ์ดูแลระบบเท่านั้น<br />หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ</p>
    </form>
  );
}
