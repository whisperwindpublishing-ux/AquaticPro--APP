import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

interface LogBody {
  logDate: string;
  title?: string;
  locationId?: number;
  timeSlotIds?: string;
  jobRoleId?: number;
  tags?: string;
  blocksJson?: string;
  status?: string;
}

async function canModerate(userId: number, roleIds: number[]): Promise<boolean> {
  if (roleIds.length === 0) return false;
  const rows = await prisma.mpDailyLogPermission.findMany({
    where: { jobRoleId: { in: roleIds }, canModerateAll: true },
  });
  return rows.length > 0;
}

type RawLog = {
  id: number; authorId: number; locationId: number | null; logDate: Date;
  timeSlotIds: string | null; jobRoleId: number | null; title: string | null;
  tags: string | null; blocksJson: string | null; status: string; createdAt: Date; updatedAt: Date;
};

async function hydrateLogs(logs: RawLog[], currentUserId: number) {
  if (logs.length === 0) return [];

  const authorIds    = [...new Set(logs.map((l) => l.authorId))];
  const locationIds  = [...new Set(logs.map((l) => l.locationId).filter(Boolean) as number[])];
  const allTsIds     = [...new Set(
    logs.flatMap((l) => l.timeSlotIds
      ? l.timeSlotIds.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean)
      : []
    )
  )];
  const logIds = logs.map((l) => l.id);

  const [profiles, locations, timeSlots, reactions, commentCounts, myReactions] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
    }),
    locationIds.length > 0
      ? prisma.pgLocation.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    allTsIds.length > 0
      ? prisma.mpTimeSlot.findMany({ where: { id: { in: allTsIds } }, select: { id: true, label: true, color: true } })
      : Promise.resolve([]),
    prisma.aqpUnifiedReaction.groupBy({
      by: ["objectId", "reactionType"],
      where: { objectId: { in: logIds }, objectType: "daily_log" },
      _count: { reactionType: true },
    }),
    prisma.dailyLogComment.groupBy({
      by: ["logId"],
      where: { logId: { in: logIds } },
      _count: { id: true },
    }),
    prisma.aqpUnifiedReaction.findMany({
      where: { objectId: { in: logIds }, objectType: "daily_log", userId: currentUserId },
      select: { objectId: true, reactionType: true },
    }),
  ]);

  const profileMap  = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l]));
  const tsMap       = Object.fromEntries(timeSlots.map((t) => [t.id, t]));

  const reactionMap: Record<number, Record<string, number>> = {};
  for (const r of reactions) {
    if (!reactionMap[r.objectId]) reactionMap[r.objectId] = {};
    reactionMap[r.objectId][r.reactionType] = r._count.reactionType;
  }
  const commentCountMap: Record<number, number> = {};
  for (const c of commentCounts) commentCountMap[c.logId] = c._count.id;
  const myReactionMap: Record<number, string> = {};
  for (const r of myReactions) myReactionMap[r.objectId] = r.reactionType;

  return logs.map((log) => {
    const p    = profileMap[log.authorId];
    const tsIds = log.timeSlotIds
      ? log.timeSlotIds.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean)
      : [];
    return {
      ...log,
      logDate: log.logDate.toISOString().slice(0, 10),
      author: {
        id: log.authorId,
        name: p ? (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Unknown") : "Unknown",
        avatarUrl: p?.avatarUrl ?? null,
      },
      location:     log.locationId ? (locationMap[log.locationId] ?? null) : null,
      timeSlots:    tsIds.map((id) => tsMap[id]).filter(Boolean),
      reactions:    reactionMap[log.id] ?? {},
      myReaction:   myReactionMap[log.id] ?? null,
      commentCount: commentCountMap[log.id] ?? 0,
    };
  });
}

/**
 * GET /api/daily-logs
 * Params: authorId, locationId, date, dateFrom, dateTo, search, page, limit, grouped
 * grouped=true → returns { groups: [{ date, logs }], total }
 */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const sp      = new URL(request.url).searchParams;
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit   = Math.min(100, parseInt(sp.get("limit") ?? "30", 10));
    const grouped = sp.get("grouped") === "true";

    const assignments = await prisma.pgUserJobAssignment.findMany({
      where: { userId: user.id }, select: { jobRoleId: true },
    });
    const roleIds   = assignments.map((a) => a.jobRoleId);
    const canSeeAll = perms.isAdmin || await canModerate(user.id, roleIds);

    const authorIdParam = sp.get("authorId");
    const authorId: number | undefined = canSeeAll
      ? (authorIdParam ? parseInt(authorIdParam, 10) : undefined)
      : user.id;

    const dateP     = sp.get("date");
    const dateFrom  = sp.get("dateFrom");
    const dateTo    = sp.get("dateTo");
    const locationP = sp.get("locationId");
    const search    = sp.get("search");

    const where = {
      status: "publish",
      ...(authorId !== undefined ? { authorId } : {}),
      ...(locationP ? { locationId: parseInt(locationP, 10) } : {}),
      ...(dateP  ? { logDate: new Date(dateP) } : {}),
      ...(!dateP && (dateFrom || dateTo) ? {
        logDate: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
        },
      } : {}),
      ...(search ? { tags: { contains: search } } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.dailyLog.findMany({
        where,
        orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dailyLog.count({ where }),
    ]);

    const hydrated = await hydrateLogs(logs as RawLog[], user.id);

    if (grouped) {
      // Group by logDate string
      const groupMap = new Map<string, typeof hydrated>();
      for (const log of hydrated) {
        const d = log.logDate as string;
        if (!groupMap.has(d)) groupMap.set(d, []);
        groupMap.get(d)!.push(log);
      }
      const groups = [...groupMap.entries()].map(([date, logs]) => ({ date, logs }));
      return ok({ groups, total, page, limit });
    }

    return ok({ logs: hydrated, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/daily-logs */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const assignments = await prisma.pgUserJobAssignment.findMany({ where: { userId: user.id }, select: { jobRoleId: true } });
    const roleIds = assignments.map((a) => a.jobRoleId);
    const createRows = await prisma.mpDailyLogPermission.findMany({ where: { jobRoleId: { in: roleIds }, canCreate: true } });
    if (!perms.isAdmin && createRows.length === 0) return forbidden("No permission to create daily logs");

    const body = await parseBody<LogBody>(request);
    if (!body?.logDate) return badRequest("logDate is required");

    const log = await prisma.dailyLog.create({
      data: {
        authorId: user.id, logDate: new Date(body.logDate),
        title: body.title?.trim() || null,
        locationId: body.locationId ?? null, timeSlotIds: body.timeSlotIds ?? null,
        jobRoleId: body.jobRoleId ?? null, tags: body.tags ?? null,
        blocksJson: body.blocksJson ?? null, status: body.status ?? "publish",
      },
    });
    const [hydrated] = await hydrateLogs([log as RawLog], user.id);
    return created(hydrated);
  } catch (e) { return serverError(e); }
}

/** PATCH /api/daily-logs  Body: { id, ...fields } */
export async function PATCH(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden();

    const body = await parseBody<Partial<LogBody> & { id: number }>(request);
    if (!body?.id) return badRequest("id is required");

    const existing = await prisma.dailyLog.findUnique({ where: { id: body.id } });
    if (!existing) return badRequest("Log not found");
    if (!perms.isAdmin && existing.authorId !== user.id) return forbidden("Cannot edit another user's log");

    const updated = await prisma.dailyLog.update({
      where: { id: body.id },
      data: {
        ...(body.logDate    && { logDate:     new Date(body.logDate) }),
        ...(body.locationId !== undefined && { locationId:  body.locationId }),
        ...(body.timeSlotIds !== undefined && { timeSlotIds: body.timeSlotIds }),
        ...(body.jobRoleId  !== undefined && { jobRoleId:   body.jobRoleId }),
        ...(body.tags       !== undefined && { tags:        body.tags }),
        ...(body.blocksJson !== undefined && { blocksJson:  body.blocksJson }),
        ...(body.status     !== undefined && { status:      body.status }),
      },
    });
    return ok(updated);
  } catch (e) { return serverError(e); }
}

/** DELETE /api/daily-logs?id=N  (soft-delete via status=trash) */
export async function DELETE(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    const id = parseInt(new URL(request.url).searchParams.get("id") ?? "", 10);
    if (!id) return badRequest("id query param required");

    const existing = await prisma.dailyLog.findUnique({ where: { id } });
    if (!existing) return badRequest("Log not found");
    if (!perms.isAdmin && existing.authorId !== user.id) return forbidden("Cannot delete another user's log");

    await prisma.dailyLog.update({ where: { id }, data: { status: "trash" } });
    return ok({ deleted: id });
  } catch (e) { return serverError(e); }
}
