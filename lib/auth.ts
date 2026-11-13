import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";

const COOKIE_NAME = "medup_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
const LOCK_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS = "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับชั่วคราว กรุณาลองใหม่ภายหลัง";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const dummyHash = `scrypt:32768:8:3:${"0".repeat(32)}:${"0".repeat(128)}`;

export async function authenticateAdmin(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  const validPassword = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  const now = new Date();
  if (!user || !user.isActive || user.role !== "ADMIN" || (user.lockedUntil && user.lockedUntil > now)) {
    return { error: INVALID_CREDENTIALS };
  }

  if (!validPassword) {
    await prisma.$transaction(async (tx) => {
      // Reset an old failure window, then increment atomically for concurrent requests.
      await tx.adminUser.updateMany({
        where: { userId: user.userId, OR: [{ lastFailedLoginAt: null }, { lastFailedLoginAt: { lt: new Date(now.getTime() - LOCK_MS) } }] },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      const failed = await tx.adminUser.update({
        where: { userId: user.userId },
        data: { failedLoginAttempts: { increment: 1 }, lastFailedLoginAt: now },
      });
      if (failed.failedLoginAttempts >= 5) {
        await tx.adminUser.update({ where: { userId: user.userId }, data: { lockedUntil: new Date(now.getTime() + LOCK_MS) } });
      }
      await tx.auditLog.create({ data: { userId: user.userId, action: "ADMIN_LOGIN_FAILED", targetTable: "admin_users", targetId: String(user.userId) } });
    });
    return { error: INVALID_CREDENTIALS };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000);
  const cookieStore = await cookies();
  const oldToken = cookieStore.get(COOKIE_NAME)?.value;
  await prisma.$transaction(async (tx) => {
    if (oldToken && /^[a-f0-9]{64}$/.test(oldToken)) {
      await tx.adminSession.deleteMany({ where: { tokenHash: tokenHash(oldToken) } });
    }
    await tx.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
    await tx.adminSession.create({ data: { tokenHash: tokenHash(token), userId: user.userId, expiresAt } });
    await tx.adminUser.update({ where: { userId: user.userId }, data: { lastLoginAt: now, failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null } });
    await tx.auditLog.create({ data: { userId: user.userId, action: "ADMIN_LOGIN", targetTable: "admin_users", targetId: String(user.userId) } });
  });
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    expires: expiresAt,
  });
  return { success: true };
}

export const getCurrentAdmin = cache(async () => {
  // Session expiry and database access must run at request time, including prefetches.
  await connection();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: {
      expiresAt: true,
      user: { select: { userId: true, username: true, fullName: true, email: true, role: true, isActive: true, lastLoginAt: true } },
    },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive || session.user.role !== "ADMIN") return null;
  return session.user;
});

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function deleteAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await prisma.$transaction(async (tx) => {
      const session = await tx.adminSession.findUnique({ where: { tokenHash: tokenHash(token) } });
      await tx.adminSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
      if (session) await tx.auditLog.create({ data: { userId: session.userId, action: "ADMIN_LOGOUT", targetTable: "admin_users", targetId: String(session.userId) } });
    });
  }
  cookieStore.delete(COOKIE_NAME);
}
