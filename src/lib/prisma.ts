import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// One source of truth, two runtimes:
//   • hosted (Vercel / phone) → Turso (libSQL) when TURSO_DATABASE_URL is set
//   • local (your Mac)        → the on-disk SQLite file via DATABASE_URL
// Same SQLite dialect either way, so the schema and every query are unchanged.
function makeClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
