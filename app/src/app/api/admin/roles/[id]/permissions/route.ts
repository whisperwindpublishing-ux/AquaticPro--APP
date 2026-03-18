import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { requireAdmin, invalidatePermissions } from "@/lib/auth/permissions";
import { ok, badRequest, notFound, serverError, parseBody } from "@/lib/utils/api-helpers";

/**
 * GET /api/admin/roles/[id]/permissions — Get all module permissions for a role
 * PUT /api/admin/roles/[id]/permissions — Update all module permissions for a role
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

    const [
      dailyLogs, taskdeck, lms, email, srm,
      awards, mileage, certs, lessonMgmt, scanAudit,
    ] = await Promise.all([
      prisma.mpDailyLogPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.pgTaskdeckPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.pgLmsPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.pgEmailPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.srmPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.awesomeAwardsPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.mpMileagePermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.aquaticproCertPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.pgLessonManagementPermission.findUnique({ where: { jobRoleId: roleId } }),
      prisma.pgScanAuditPermission.findUnique({ where: { jobRoleId: roleId } }),
    ]);

    return ok({
      role: { id: role.id, title: role.title, tier: role.tier },
      permissions: { dailyLogs, taskdeck, lms, email, srm, awards, mileage, certs, lessonMgmt, scanAudit },
    });
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

    const role = await prisma.pgJobRole.findUnique({ where: { id: roleId } });
    if (!role) return notFound("Job role not found.");

    const body = await parseBody(request) as {
      dailyLogs?: Record<string, boolean>;
      taskdeck?: Record<string, boolean>;
      lms?: Record<string, boolean>;
      email?: Record<string, boolean>;
      srm?: Record<string, boolean>;
      awards?: Record<string, boolean>;
      mileage?: Record<string, boolean>;
      certs?: Record<string, boolean>;
      lessonMgmt?: Record<string, boolean>;
      scanAudit?: Record<string, boolean>;
    };

    if (!body) return badRequest("Request body required.");

    // Build upsert operations for each module that was sent
    const ops = [];

    if (body.dailyLogs) {
      ops.push(prisma.mpDailyLogPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.dailyLogs },
        update: body.dailyLogs,
      }));
    }
    if (body.taskdeck) {
      ops.push(prisma.pgTaskdeckPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.taskdeck },
        update: body.taskdeck,
      }));
    }
    if (body.lms) {
      ops.push(prisma.pgLmsPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.lms },
        update: body.lms,
      }));
    }
    if (body.email) {
      ops.push(prisma.pgEmailPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.email },
        update: body.email,
      }));
    }
    if (body.srm) {
      ops.push(prisma.srmPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.srm },
        update: body.srm,
      }));
    }
    if (body.awards) {
      ops.push(prisma.awesomeAwardsPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.awards },
        update: body.awards,
      }));
    }
    if (body.mileage) {
      ops.push(prisma.mpMileagePermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.mileage },
        update: body.mileage,
      }));
    }
    if (body.certs) {
      ops.push(prisma.aquaticproCertPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.certs },
        update: body.certs,
      }));
    }
    if (body.lessonMgmt) {
      ops.push(prisma.pgLessonManagementPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.lessonMgmt },
        update: body.lessonMgmt,
      }));
    }
    if (body.scanAudit) {
      ops.push(prisma.pgScanAuditPermission.upsert({
        where: { jobRoleId: roleId },
        create: { jobRoleId: roleId, ...body.scanAudit },
        update: body.scanAudit,
      }));
    }

    if (ops.length === 0) return badRequest("No permission modules provided.");

    await prisma.$transaction(ops);

    // Invalidate permissions cache for all users with this role
    const assignments = await prisma.pgUserJobAssignment.findMany({
      where: { jobRoleId: roleId },
      select: { userId: true },
    });
    await Promise.all(assignments.map((a) => invalidatePermissions(a.userId)));

    return ok({ updated: true });
  } catch (e) {
    return serverError(e);
  }
}
