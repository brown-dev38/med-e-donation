"use server";

import { redirect } from "next/navigation";
import { authenticateAdmin, deleteAdminSession } from "@/lib/auth";

export type LoginState = { error: string } | null;

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const password = formData.get("password");
  if (typeof rawEmail !== "string" || typeof password !== "string") return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  const email = rawEmail.trim().toLowerCase();
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 256) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง" };
  }
  try {
    const result = await authenticateAdmin(email, password);
    if (result.error) return { error: result.error };
  } catch {
    return { error: "ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองอีกครั้ง" };
  }
  redirect("/admin");
}

export async function logout() {
  await deleteAdminSession();
  redirect("/login");
}
