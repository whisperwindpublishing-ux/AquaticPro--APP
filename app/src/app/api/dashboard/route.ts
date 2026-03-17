import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, serverError } from "@/lib/utils/api-helpers";

/**
 * GET /api/dashboard
 * Returns the current user's personalised dashboard summary.
 */
export async function GET(_request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const [perms, notifications, recentLogs, openTaskCount, actionButtons] =
      await Promise.all([
        resolvePermissions(user.id),
        prisma.mentorshipNotification.findMany({
          where: { userId: user.id },
          orderBy: { time: "desc" },
          take: 10,
          select: { id: true, message: true, contextUrl: true, time: true },
        }),
        prisma.dailyLog.findMany({
          where: { authorId: user.id, status: "publish" },
          orderBy: { logDate: "desc" },
          take: 5,
          select: { id: true, logDate: true, status: true, createdAt: true },
        }),
        prisma.aqpTaskcard.count({ where: { assignedTo: user.id, isComplete: false } }),
        prisma.aqpDashboardActionButton.findMany({
          orderBy: { sortOrder: "asc" },
          select: {
            id: true, title: true, url: true, color: true,
            thumbnailUrl: true, visibleToRoles: true, sortOrder: true,
          },
        }),
      ]);

    // Filter action buttons by the user's assigned job roles
    const assignments = await prisma.pgUserJobAssignment.findMany({
      where: { userId: user.id },
      select: { jobRoleId: true },
    });
    const myRoleIds = new Set(assignments.map((a) => a.jobRoleId));
    const visibleButtons = actionButtons.filter((b) => {
      if (!b.visibleToRoles) return true;
      return b.visibleToRoles.split(",").map(Number).some((r) => myRoleIds.has(r));
    });

    return ok({
      user: {
        id: user.id, displayName: user.displayName,
        avatarUrl: user.avatarUrl, tier: perms.tier, isAdmin: perms.isAdmin,
      },
      modules: perms.modules,
      notifications,
      recentLogs,
      openTaskCount,
      actionButtons: visibleButtons,
    });
  } catch (e) { return serverError(e); }
}
