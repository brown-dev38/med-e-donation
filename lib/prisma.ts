import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseClient } from "./database";

// One client per process. In development the client is cached on globalThis so hot reloads do not
// open new connection pools, but it is replaced after `prisma generate`: the regenerated module has a
// new PrismaClient class, and the old cached client would not know about new models.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createDatabaseClient>;
  prismaClass?: typeof PrismaClient;
};

if (globalForPrisma.prisma && globalForPrisma.prismaClass !== PrismaClient) {
  void globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createDatabaseClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClass = PrismaClient;
}
