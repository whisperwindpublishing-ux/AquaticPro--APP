import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, forbidden, notFound, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function canModerateAll(userId: number): Promise<boolean> {
  const assignments = await prisma.pgUserJobAssignment.findMany({
    where: { userId }, select: { jobRoleId: true },
  });
  const roleIds = assignments.map((a) => a.jobRoleId);
  if (roleIds.length === 0) return false;
  const rows = await prisma.mpDailyLogPermission.findMany({
    where: { jobRoleId: { in: roleIds }, canModerateAll: true },
  });
  return rows.length > 0;
}

async function hydrateLog(log: {
  id: number; authorId: number; locationId: number | null;
  logDate: Date; timeSlotIds: string | null; jobRoleId: number | null;
  tags: string | null; blocksJson: string | null; status: string;
  createdAt: Date; updatedAt: Date;
}, currentUserId: number) {
  const [profile, location, reactions, commentCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: log.authorId },
      select: { displayName: true, firstName: true, lastName: true, avatarUrl: true },
    }),
    log.locationId
      ? prisma.pgLocation.findUnique({ where: { id: log.locationId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    prisma.aqpUnifiedReaction.groupBy({
      by: ["reactionType"],
      where: { objectId: log.id, objectType: "daily_log" },
      _count: { reactionType: true },
    }),
    prisma.dailyLogComment.count({ where: { logId: log.id } }),
  ]);

  // Time slot labels
  const timeSlotIds = log.timeSlotIds
    ? log.timeSlotIds.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean)
    : [];
  const timeSlots = timeSlotIds.length > 0
    ? await prisma.mpTimeSlot.findMany({
        where: { id: { in: timeSlotIds } },
        select: { id: true, label: true, color: true },
      })
    : [];

  // My reactions
  const myReactionRow = await prisma.aqpUnifiedReaction.findFirst({
    where: { objectId: log.id, objectType: "daily_log", userId: currentUserId },
    select: { reactionType: true },
  });

  const reactionMap: Record<string, number> = {};
  for (const r of reactions) {
    reactionMap[r.reactionType] = r._count.reactionType;
  }

  return {
    ...log,
    logDate: log.logDate.toISOString().slice(0, 10),
    author: {
      id: log.authorId,
      name: profile?.displayName || `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "Unknown",
      avatarUrl: profile?.avatarUrl ?? null,
    },
    location,
    timeSlots,
    reactions: reactionMap,
    myReaction: myReactionRow?.reactionType ?? null,
    commentCount,
  };
}

// ─── GET /api/daily-logs/[id] ─────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) return notFound();

    const log = await prisma.dailyLog.findUnique({ where: { id: logId } });
    if (!log || log.status === "trash") return notFound();

    const isMod = perms.isAdmin || await canModerateAll(user.id);
    if (!isMod && log.authorId !== user.id && log.status !== "publish") return forbidden();

    const hydrated = await hydrateLog(log, user.id);
    return ok(hydrated);
  } catch (e) {
    return serverError(e);
  }
}

// ─── PUT /api/daily-logs/[id] ─────────────────────────────────────────────────

interface UpdateBody {
  logDate?: string;
  locationId?: number | null;
  timeSlotIds?: string | null;
  jobRoleId?: number | null;
  tags?: string | null;
  blocksJson?: string | null;
  status?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) return notFound();

    const existing = await prisma.dailyLog.findUnique({ where: { id: logId } });
    if (!existing || existing.status === "trash") return notFound();

    const isMod = perms.isAdmin || await canModerateAll(user.id);
    if (!isMod && existing.authorId !== user.id) return forbidden("Cannot edit another user's log");

    // Check edit permission for non-admins
    if (!isMod) {
      const assignments = await prisma.pgUserJobAssignment.findMany({
        where: { userId: user.id }, select: { jobRoleId: true },
      });
      const roleIds = assignments.map((a) => a.jobRoleId);
      const editRows = await prisma.mpDailyLogPermission.findMany({
        where: { jobRoleId: { in: roleIds }, canEdit: true },
      });
      if (editRows.length === 0) return forbidden("No permission to edit daily logs");
    }

    const body = await parseBody<UpdateBody>(request);
    const updated = await prisma.dailyLog.update({
      where: { id: logId },
      data: {
        ...(body?.logDate      !== undefined && { logDate:     new Date(body.logDate!) }),
        ...(body?.locationId   !== undefined && { locationId:  body.locationId }),
        ...(body?.timeSlotIds  !== undefined && { timeSlotIds: body.timeSlotIds }),
        ...(body?.jobRoleId    !== undefined && { jobRoleId:   body.jobRoleId }),
        ...(body?.tags         !== undefined && { tags:        body.tags }),
        ...(body?.blocksJson   !== undefined && { blocksJson:  body.blocksJson }),
        ...(body?.status       !== undefined && { status:      body.status }),
      },
    });

    const hydrated = await hydrateLog(updated, user.id);
    return ok(hydrated);
  } catch (e) {
    return serverError(e);
  }
}

// ─── DELETE /api/daily-logs/[id] ─────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) return notFound();

    const existing = await prisma.dailyLog.findUnique({ where: { id: logId } });
    if (!existing || existing.status === "trash") return notFound();

    const isMod = perms.isAdmin || await canModerateAll(user.id);
    if (!isMod && existing.authorId !== user.id) return forbidden("Cannot delete another user's log");

    if (!isMod) {
      const assignments = await prisma.pgUserJobAssignment.findMany({
        where: { userId: user.id }, select: { jobRoleId: true },
      });
      const roleIds = assignments.map((a) => a.jobRoleId);
      const delRows = await prisma.mpDailyLogPermission.findMany({
        where: { jobRoleId: { in: roleIds }, canDelete: true },
      });
      if (delRows.length === 0) return forbidden("No permission to delete daily logs");
    }

    await prisma.dailyLog.update({ where: { id: logId }, data: { status: "trash" } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
