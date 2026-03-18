import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { ok, serverError } from "@/lib/utils/api-helpers";

/** GET /api/time-slots — list all active time slots */
export async function GET(_request: NextRequest) {
  try {
    const [, authErr] = await requireSession();
    if (authErr) return authErr;

    const slots = await prisma.mpTimeSlot.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, label: true, color: true, sortOrder: true },
    });
    return ok(slots);
  } catch (e) {
    return serverError(e);
  }
}
