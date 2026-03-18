import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { ok, serverError } from "@/lib/utils/api-helpers";

/** GET /api/locations — list all active locations */
export async function GET(_request: NextRequest) {
  try {
    const [, authErr] = await requireSession();
    if (authErr) return authErr;

    const locations = await prisma.pgLocation.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true },
    });
    return ok(locations);
  } catch (e) {
    return serverError(e);
  }
}
