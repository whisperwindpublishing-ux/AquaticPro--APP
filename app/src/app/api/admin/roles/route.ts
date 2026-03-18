import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/permissions";
import { ok, created, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

/**
 * GET  /api/admin/roles — List all job roles (admin only)
 * POST /api/admin/roles — Create a new job role (admin only)
 */

export async function GET() {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const roles = await prisma.pgJobRole.findMany({
      orderBy: [{ tier: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        tier: true,
        description: true,
        inserviceHours: true,
        createdAt: true,
      },
    });

    // Attach user counts per role
    const assignmentCounts = await prisma.pgUserJobAssignment.groupBy({
      by: ["jobRoleId"],
      _count: { jobRoleId: true },
    });
    const countMap = Object.fromEntries(assignmentCounts.map((a) => [a.jobRoleId, a._count.jobRoleId]));

    return ok({
      roles: roles.map((r) => ({
        ...r,
        inserviceHours: Number(r.inserviceHours),
        userCount: countMap[r.id] ?? 0,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const body = await parseBody(request) as {
      title?: string;
      tier?: number;
      description?: string;
      inserviceHours?: number;
    };

    if (!body?.title?.trim()) return badRequest("Title is required.");
    const tier = Number(body.tier);
    if (!tier || tier < 1 || tier > 6) return badRequest("Tier must be 1–6.");

    const role = await prisma.pgJobRole.create({
      data: {
        title: body.title.trim(),
        tier,
        description: body.description?.trim() || null,
        inserviceHours: body.inserviceHours ?? 4.0,
      },
    });

    // Auto-create permission rows for all modules (defaults = safe/restrictive)
    await prisma.$transaction([
      prisma.mpDailyLogPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.pgTaskdeckPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.pgLmsPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.pgEmailPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.srmPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.awesomeAwardsPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.mpMileagePermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.aquaticproCertPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.pgLessonManagementPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
      prisma.pgScanAuditPermission.upsert({ where: { jobRoleId: role.id }, create: { jobRoleId: role.id }, update: {} }),
    ]);

    return created({ role: { ...role, inserviceHours: Number(role.inserviceHours), userCount: 0 } });
  } catch (e) {
    return serverError(e);
  }
}
