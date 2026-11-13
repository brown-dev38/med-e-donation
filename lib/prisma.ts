import "server-only";
import { createDatabaseClient } from "./database";

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createDatabaseClient>;
};

export const prisma = globalForPrisma.prisma ?? createDatabaseClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
