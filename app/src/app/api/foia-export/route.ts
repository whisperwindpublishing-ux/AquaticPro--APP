import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, forbidden, badRequest, serverError } from "@/lib/utils/api-helpers";

/**
 * GET /api/foia-export
 * Admin-only. Returns a structured data export suitable for FOIA compliance.
 * Params: section=audit-log|users|new-hires, start, end (ISO dates), page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.foiaExport) return forbidden("FOIA Export access required");

    const sp      = new URL(request.url).searchParams;
    const section = sp.get("section") ?? "audit-log";
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit   = Math.min(500, parseInt(sp.get("limit") ?? "100", 10));
    const start   = sp.get("start") ? new Date(sp.get("start")!) : undefined;
    const end     = sp.get("end")   ? new Date(sp.get("end")!)   : undefined;

    const dateRange = (start || end)
      ? { gte: start, lte: end }
      : undefined;

    if (section === "audit-log") {
      const where = { ...(dateRange ? { createdAt: dateRange } : {}) };
      const [entries, total] = await Promise.all([
        prisma.mpAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.mpAuditLog.count({ where }),
      ]);
      return ok({ section, entries, total, page, limit });
    }
    if (section === "users") {
      const [users, total] = await Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" }, skip: (page - 1) * limit, take: limit }),
        prisma.user.count(),
      ]);
      return ok({ section, users, total, page, limit });
    }
    if (section === "new-hires") {
      const where = { ...(dateRange ? { createdAt: dateRange } : {}) };
      const [hires, total] = await Promise.all([
        prisma.aquaticproNewHire.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.aquaticproNewHire.count({ where }),
      ]);
      return ok({ section, hires, total, page, limit });
    }
    return badRequest("section must be audit-log|users|new-hires");
  } catch (e) { return serverError(e); }
}
