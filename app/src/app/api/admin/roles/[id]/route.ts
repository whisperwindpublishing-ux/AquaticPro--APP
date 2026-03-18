import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/permissions";
import { ok, badRequest, notFound, serverError, parseBody } from "@/lib/utils/api-helpers";
import { invalidatePermissions } from "@/lib/auth/permissions";

/**
 * GET    /api/admin/roles/[id] — Get a single role
 * PUT    /api/admin/roles/[id] — Update name, tier, description
 * DELETE /api/admin/roles/[id] — Delete a role (blocks if users assigned)
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId)) return badRequest("Invalid role ID.");

    const role = await prisma.pgJobRole.findUnique({ where: { id: roleId } });
    if (!role) return notFound("Job role not found.");

    const userCount = await prisma.pgUserJobAssignment.count({ where: { jobRoleId: roleId } });
    return ok({ role: { ...role, inserviceHours: Number(role.inserviceHours), userCount } });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId)) return badRequest("Invalid role ID.");

    const body = await parseBody(request) as {
      title?: string;
      tier?: number;
      description?: string;
      inserviceHours?: number;
    };

    if (!body?.title?.trim()) return badRequest("Title is required.");
    const tier = Number(body.tier);
    if (!tier || tier < 1 || tier > 6) return badRequest("Tier must be 1–6.");

    const existing = await prisma.pgJobRole.findUnique({ where: { id: roleId } });
    if (!existing) return notFound("Job role not found.");

    const updated = await prisma.pgJobRole.update({
      where: { id: roleId },
      data: {
        title: body.title.trim(),
        tier,
        description: body.description?.trim() || null,
        inserviceHours: body.inserviceHours ?? existing.inserviceHours,
      },
    });

    // Invalidate permissions cache for all users assigned to this role
    if (existing.tier !== tier) {
      const assignments = await prisma.pgUserJobAssignment.findMany({
        where: { jobRoleId: roleId },
        select: { userId: true },
      });
      await Promise.all(assignments.map((a) => invalidatePermissions(a.userId)));
    }

    return ok({ role: { ...updated, inserviceHours: Number(updated.inserviceHours) } });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId)) return badRequest("Invalid role ID.");

    const existing = await prisma.pgJobRole.findUnique({ where: { id: roleId } });
    if (!existing) return notFound("Job role not found.");

    const userCount = await prisma.pgUserJobAssignment.count({ where: { jobRoleId: roleId } });
    if (userCount > 0) {
      return badRequest(`Cannot delete: ${userCount} user(s) are assigned to this role. Reassign them first.`);
    }

    // Delete all permission rows for this role, then the role
    await prisma.$transaction([
      prisma.mpDailyLogPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.pgTaskdeckPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.pgLmsPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.pgEmailPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.srmPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.awesomeAwardsPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.mpMileagePermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.aquaticproCertPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.pgLessonManagementPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.pgScanAuditPermission.deleteMany({ where: { jobRoleId: roleId } }),
      prisma.pgJobRole.delete({ where: { id: roleId } }),
    ]);

    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
