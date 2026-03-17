import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

interface LogBody {
  logDate: string;
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

/** GET /api/daily-logs  Params: authorId, locationId, date, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const sp = new URL(request.url).searchParams;
    const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit  = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));
    const dateP  = sp.get("date");

    const assignments = await prisma.pgUserJobAssignment.findMany({
      where: { userId: user.id }, select: { jobRoleId: true },
    });
    const roleIds  = assignments.map((a) => a.jobRoleId);
    const canSeeAll = perms.isAdmin || await canModerate(user.id, roleIds);
    const authorId  = canSeeAll ? (sp.get("authorId") ? parseInt(sp.get("authorId")!, 10) : undefined) : user.id;

    const where = {
      status: "publish",
      ...(authorId !== undefined ? { authorId } : {}),
      ...(sp.get("locationId") ? { locationId: parseInt(sp.get("locationId")!, 10) } : {}),
      ...(dateP ? { logDate: new Date(dateP) } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.dailyLog.findMany({ where, orderBy: [{ logDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * limit, take: limit }),
      prisma.dailyLog.count({ where }),
    ]);
    return ok({ logs, total, page, limit });
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
        locationId: body.locationId ?? null, timeSlotIds: body.timeSlotIds ?? null,
        jobRoleId: body.jobRoleId ?? null, tags: body.tags ?? null,
        blocksJson: body.blocksJson ?? null, status: body.status ?? "publish",
      },
    });
    return created(log);
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
