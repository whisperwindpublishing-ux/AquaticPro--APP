import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";
import { cached } from "@/lib/cache/redis";

/**
 * GET /api/professional-growth
 * Returns job roles, user's current assignments, promotion criteria, and progress.
 * Params: userId (admin only), section=roles|assignments|criteria|progress
 */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms   = await resolvePermissions(user.id);
    if (!perms.modules.professionalGrowth) return forbidden("Professional Growth access required");

    const sp      = new URL(request.url).searchParams;
    const section = sp.get("section") ?? "all";
    const targetId = perms.isAdmin && sp.get("userId")
      ? parseInt(sp.get("userId")!, 10)
      : user.id;

    const [roles, assignments, criteria, progress] = await Promise.all([
      section === "all" || section === "roles"
        ? cached("roles:all", () => prisma.pgJobRole.findMany({ orderBy: { tier: "asc" } }), 3600)
        : Promise.resolve([]),
      section === "all" || section === "assignments"
        ? prisma.pgUserJobAssignment.findMany({
            where: { userId: targetId },
            orderBy: { assignedDate: "desc" },
          })
        : Promise.resolve([]),
      section === "all" || section === "criteria"
        ? prisma.pgPromotionCriterion.findMany({ orderBy: [{ jobRoleId: "asc" }, { sortOrder: "asc" }] })
        : Promise.resolve([]),
      section === "all" || section === "progress"
        ? prisma.pgUserProgress.findMany({
            where: { userId: targetId },
            orderBy: { criterionId: "asc" },
          })
        : Promise.resolve([]),
    ]);

    return ok({ roles, assignments, criteria, progress, targetUserId: targetId });
  } catch (e) { return serverError(e); }
}

/**
 * POST /api/professional-growth
 * Assign a job role to a user (admin only).
 * Body: { userId, jobRoleId, isPrimary?, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const body = await parseBody<{ userId: number; jobRoleId: number; isPrimary?: boolean; notes?: string }>(request);
    if (!body?.userId || !body?.jobRoleId) return badRequest("userId and jobRoleId are required");

    const assignment = await prisma.pgUserJobAssignment.upsert({
      where:  { userId_jobRoleId: { userId: body.userId, jobRoleId: body.jobRoleId } },
      create: { userId: body.userId, jobRoleId: body.jobRoleId, assignedBy: user.id, isPrimary: body.isPrimary ?? false, notes: body.notes ?? null },
      update: { isPrimary: body.isPrimary ?? false, notes: body.notes ?? null, assignedBy: user.id },
    });

    // Invalidate cached permissions for the affected user
    await import("@/lib/auth/permissions").then((m) => m.invalidatePermissions(body.userId));

    return created(assignment);
  } catch (e) { return serverError(e); }
}

/**
 * DELETE /api/professional-growth?userId=N&jobRoleId=N  (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const sp        = new URL(request.url).searchParams;
    const userId    = parseInt(sp.get("userId") ?? "", 10);
    const jobRoleId = parseInt(sp.get("jobRoleId") ?? "", 10);
    if (!userId || !jobRoleId) return badRequest("userId and jobRoleId are required");

    const existing = await prisma.pgUserJobAssignment.findUnique({
      where: { userId_jobRoleId: { userId, jobRoleId } },
    });
    if (!existing) return notFound("Assignment not found");

    await prisma.pgUserJobAssignment.delete({ where: { userId_jobRoleId: { userId, jobRoleId } } });
    await import("@/lib/auth/permissions").then((m) => m.invalidatePermissions(userId));

    return ok({ deleted: true });
  } catch (e) { return serverError(e); }
}
