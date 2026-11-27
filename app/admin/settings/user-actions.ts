"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import type { AdminRole } from "@/generated/prisma/enums";
import type { SettingsState } from "./actions";

const str = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};
const readRole = (formData: FormData): AdminRole | null => {
  const value = formData.get("role");
  return ROLES.find((role) => role === value) ?? null;
};
const passwordError = (password: string) => (password.length < 8 || password.length > 256 ? "รหัสผ่านต้องมี 8–256 ตัวอักษร" : null);
const error = (message: string) => ({ status: "error", message }) as const;

/** Validates the profile fields shared by the add and edit forms. */
function readProfile(formData: FormData): { error: string } | { username: string; fullName: string; email: string; role: AdminRole } {
  const username = str(formData, "username", 100);
  const fullName = str(formData, "fullName", 255).replace(/\s+/g, " ");
  const email = str(formData, "email", 255).toLowerCase();
  const role = readRole(formData);
  if (!role) return { error: "กรุณาเลือกสิทธิ์การใช้งาน" };
  if (fullName.length < 2) return { error: "กรุณากรอกชื่อ–นามสกุล" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "กรุณากรอกอีเมลให้ถูกต้อง" };
  if (!/^[A-Za-z0-9._-]{3,100}$/.test(username)) return { error: "ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข . _ - อย่างน้อย 3 ตัว" };
  return { username, fullName, email, role };
}

/** Returns an error message when the username or email already belongs to another account. */
async function duplicateError(username: string, email: string, exceptUserId?: number) {
  const taken = await prisma.adminUser.findFirst({
    where: { OR: [{ username }, { email }], ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
    select: { username: true },
  });
  if (!taken) return null;
  return taken.username === username ? "ชื่อผู้ใช้นี้มีอยู่แล้ว" : "อีเมลนี้มีผู้ใช้งานแล้ว";
}

export async function createAdminUser(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const profile = readProfile(formData);
  if ("error" in profile) return error(profile.error);
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const invalidPassword = passwordError(password);
  if (invalidPassword) return error(invalidPassword);
  const duplicate = await duplicateError(profile.username, profile.email);
  if (duplicate) return error(duplicate);

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const user = await tx.adminUser.create({ data: { ...profile, passwordHash } });
    await tx.auditLog.create({ data: { userId: admin.userId, action: "ADMIN_USER_CREATE", targetTable: "admin_users", targetId: String(user.userId), details: { username: profile.username, email: profile.email, role: profile.role } } });
  });
  refresh();
  return { status: "success", message: `เพิ่มผู้ใช้งาน ${profile.fullName} แล้ว` };
}

/** Edit name, email, username and role. Admins cannot change their own role, so one admin always remains. */
export async function updateAdminUserProfile(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId < 1) return error("ไม่พบผู้ใช้งาน");
  if (userId === admin.userId) formData.set("role", admin.role); // the role field is locked for your own account
  const profile = readProfile(formData);
  if ("error" in profile) return error(profile.error);
  const duplicate = await duplicateError(profile.username, profile.email, userId);
  if (duplicate) return error(duplicate);
  const before = await prisma.adminUser.findUnique({ where: { userId }, select: { username: true, fullName: true, email: true, role: true } });
  if (!before) return error("ไม่พบผู้ใช้งาน");
  const changed = (Object.keys(profile) as (keyof typeof profile)[]).filter((key) => before[key] !== profile[key]);
  if (changed.length === 0) return { status: "success", message: "ไม่มีข้อมูลที่เปลี่ยนแปลง" };
  await prisma.$transaction([
    prisma.adminUser.update({ where: { userId }, data: profile }),
    prisma.auditLog.create({ data: { userId: admin.userId, action: "ADMIN_USER_UPDATE", targetTable: "admin_users", targetId: String(userId), details: { changed } } }),
  ]);
  refresh();
  return { status: "success", message: `บันทึกข้อมูล ${profile.fullName} แล้ว` };
}

const USER_DONE = { deactivate: "ปิดใช้งานบัญชีแล้ว", activate: "เปิดใช้งานบัญชีแล้ว", unlock: "ปลดล็อกบัญชีแล้ว" } as const;

/** Enable, disable or unlock an account. Admins cannot disable themselves, so one active admin always remains. */
export async function updateAdminUser(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const op = formData.get("op");
  if (!Number.isInteger(userId) || userId < 1 || (op !== "deactivate" && op !== "activate" && op !== "unlock")) return error("ไม่พบผู้ใช้งาน");
  if (op === "deactivate" && userId === admin.userId) return error("ไม่สามารถปิดใช้งานบัญชีของตัวเองได้");
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.adminUser.updateMany({
      where: { userId },
      data: op === "unlock" ? { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null } : { isActive: op === "activate" },
    });
    if (result.count === 0) return false;
    if (op === "deactivate") await tx.adminSession.deleteMany({ where: { userId } }); // sign the user out everywhere
    await tx.auditLog.create({ data: { userId: admin.userId, action: `ADMIN_USER_${op.toUpperCase()}`, targetTable: "admin_users", targetId: String(userId) } });
    return true;
  });
  if (!updated) return error("ไม่พบผู้ใช้งาน");
  refresh();
  return { status: "success", message: USER_DONE[op] };
}

export async function resetAdminPassword(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  if (!Number.isInteger(userId) || userId < 1) return error("ไม่พบผู้ใช้งาน");
  const invalidPassword = passwordError(password);
  if (invalidPassword) return error(invalidPassword);
  const passwordHash = await hashPassword(password);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.adminUser.updateMany({ where: { userId }, data: { passwordHash, failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null } });
    if (result.count === 0) return false;
    // Sign the user out of other devices; keep the current admin's own session when resetting their own password.
    if (userId !== admin.userId) await tx.adminSession.deleteMany({ where: { userId } });
    await tx.auditLog.create({ data: { userId: admin.userId, action: "ADMIN_USER_RESET_PASSWORD", targetTable: "admin_users", targetId: String(userId) } });
    return true;
  });
  if (!updated) return error("ไม่พบผู้ใช้งาน");
  refresh();
  return { status: "success", message: "เปลี่ยนรหัสผ่านแล้ว" };
}
