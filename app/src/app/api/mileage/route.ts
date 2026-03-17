import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/mileage  Params: section=entries|locations|accounts, userId (admin), page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms    = await resolvePermissions(user.id);
    if (!perms.modules.mileage) return forbidden("Mileage access required");

    const sp       = new URL(request.url).searchParams;
    const section  = sp.get("section") ?? "entries";
    const page     = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit    = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));
    const canViewAll = perms.isAdmin || (await prisma.pgUserJobAssignment.findMany({
      where: { userId: user.id }, select: { jobRoleId: true },
    }).then((rows) => prisma.mpMileagePermission.findMany({ where: { jobRoleId: { in: rows.map((r) => r.jobRoleId) }, canViewAll: true } }))).length > 0;

    if (section === "locations") {
      const locations = await prisma.mpMileageLocation.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
      return ok({ locations });
    }
    if (section === "accounts") {
      const accounts = await prisma.mpMileageBudgetAccount.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
      return ok({ accounts });
    }

    const targetId = canViewAll && sp.get("userId") ? parseInt(sp.get("userId")!, 10) : user.id;
    const where = { ...(canViewAll ? (sp.get("userId") ? { userId: targetId } : {}) : { userId: user.id }) };
    const [entries, total] = await Promise.all([
      prisma.mpMileageEntry.findMany({ where, orderBy: { tripDate: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.mpMileageEntry.count({ where }),
    ]);
    return ok({ entries, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/mileage  Create a mileage entry. */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.mileage) return forbidden("Mileage access required");

    const body = await parseBody<{
      tripDate: string; businessPurpose?: string;
      calculatedMiles: number; routeJson?: string;
      tolls?: number; parking?: number;
      budgetAccountId?: number; notes?: string;
    }>(request);
    if (!body?.tripDate) return badRequest("tripDate required");
    if (body.calculatedMiles === undefined) return badRequest("calculatedMiles required");

    const entry = await prisma.mpMileageEntry.create({
      data: {
        userId: user.id, tripDate: new Date(body.tripDate),
        businessPurpose: body.businessPurpose ?? null,
        calculatedMiles: body.calculatedMiles,
        routeJson: body.routeJson ?? null,
        tolls: body.tolls ?? 0, parking: body.parking ?? 0,
        budgetAccountId: body.budgetAccountId ?? null,
        notes: body.notes ?? null,
      },
    });
    return created(entry);
  } catch (e) { return serverError(e); }
}
