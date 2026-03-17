import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/seasonal-returns  Params: section=seasons|employees|stats, seasonId, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms   = await resolvePermissions(user.id);
    if (!perms.modules.seasonalReturns) return forbidden("Seasonal Returns access required");

    const sp      = new URL(request.url).searchParams;
    const section = sp.get("section") ?? "seasons";
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit   = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));
    const seasonId = sp.get("seasonId") ? parseInt(sp.get("seasonId")!, 10) : undefined;

    if (section === "seasons") {
      const seasons = await prisma.srmSeason.findMany({ orderBy: { startDate: "desc" } });
      return ok({ seasons });
    }
    if (section === "stats" && seasonId) {
      const stats = await prisma.srmRetentionStats.findFirst({ where: { seasonId }, orderBy: { calculatedAt: "desc" } });
      return ok({ stats });
    }

    // employees: admin sees all; member sees only themselves
    const isManager = perms.isAdmin || await (async () => {
      const rows = await prisma.pgUserJobAssignment.findMany({ where: { userId: user.id }, select: { jobRoleId: true } });
      const p = await prisma.srmPermission.findMany({ where: { jobRoleId: { in: rows.map((r) => r.jobRoleId) }, srmViewAllPay: true } });
      return p.length > 0;
    })();

    const where = {
      ...(seasonId ? { seasonId } : {}),
      ...(!isManager ? { userId: user.id } : {}),
    };
    const [employees, total] = await Promise.all([
      prisma.srmEmployeeSeason.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.srmEmployeeSeason.count({ where }),
    ]);
    return ok({ employees, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/seasonal-returns  Body: { action: "update-status", userId, seasonId, status, eligibleForRehire? } */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);

    const body = await parseBody<{ action: string; userId?: number; seasonId: number; status?: string; eligibleForRehire?: boolean; comments?: string }>(request);
    if (!body?.seasonId) return badRequest("seasonId required");

    if (body.action === "update-status") {
      const targetId = body.userId ?? user.id;
      if (targetId !== user.id && !perms.isAdmin) return forbidden();
      const record = await prisma.srmEmployeeSeason.upsert({
        where:  { userId_seasonId: { userId: targetId, seasonId: body.seasonId } },
        create: { userId: targetId, seasonId: body.seasonId, status: body.status ?? "pending", eligibleForRehire: body.eligibleForRehire ?? true, comments: body.comments ?? null },
        update: { status: body.status, eligibleForRehire: body.eligibleForRehire, comments: body.comments },
      });
      return ok(record);
    }

    return badRequest("Unknown action");
  } catch (e) { return serverError(e); }
}
