import { ok } from "@/lib/utils/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let dbStatus = "unreachable";

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "error";
  }

  return ok({
    status: "ok",
    version: "14.0.0",
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
    },
  });
}
