import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createDatabaseClient } from "../lib/database";
import { hashPassword } from "../lib/password";

// Usage: npm run admin:reset-password -- <email>
// Prompts for the new password without echoing it, so it never appears in shell history.

async function promptHidden(question: string) {
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const answer = rl.question(question);
  muted = true;
  const value = await answer;
  rl.close();
  process.stdout.write("\n");
  return value;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:reset-password -- <email>");
  const prisma = createDatabaseClient();
  try {
    const user = await prisma.adminUser.findUnique({ where: { email }, select: { userId: true } });
    if (!user) throw new Error(`No admin account with email ${email}.`);
    const password = await promptHidden("New password (8–256 characters): ");
    if (password.length < 8 || password.length > 256) throw new Error("Password must be 8–256 characters.");
    if ((await promptHidden("Repeat new password: ")) !== password) throw new Error("Passwords do not match.");
    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.adminUser.update({ where: { userId: user.userId }, data: { passwordHash, failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null } }),
      // Sign out existing sessions so only the new password grants access.
      prisma.adminSession.deleteMany({ where: { userId: user.userId } }),
      prisma.auditLog.create({ data: { userId: user.userId, action: "ADMIN_PASSWORD_RESET", targetTable: "admin_users", targetId: String(user.userId), details: { via: "cli" } } }),
    ]);
    console.log(`Password updated for ${email}. Existing sessions were signed out.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Password reset failed.");
  process.exitCode = 1;
});
