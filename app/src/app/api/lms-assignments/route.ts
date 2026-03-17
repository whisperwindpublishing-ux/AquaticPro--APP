import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/lms-assignments  Params: userId (admin), lessonId, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms    = await resolvePermissions(user.id);
    if (!perms.modules.lms) return forbidden("LMS access required");

    const sp       = new URL(request.url).searchParams;
    const page     = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit    = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));
    const lessonId = sp.get("lessonId") ? parseInt(sp.get("lessonId")!, 10) : undefined;

    // Find assignments the user is enrolled in
    const userAssignments = await prisma.aquaticproLearningAssignmentUser.findMany({
      where: { userId: user.id },
      select: { assignmentId: true },
    });
    const assignmentIds = userAssignments.map((a) => a.assignmentId);

    const where = {
      id: { in: assignmentIds },
      ...(lessonId ? { lessonId } : {}),
    };
    const [assignments, total] = await Promise.all([
      prisma.aquaticproLearningAssignment.findMany({ where, orderBy: { dueDate: "asc" }, skip: (page - 1) * limit, take: limit }),
      prisma.aquaticproLearningAssignment.count({ where }),
    ]);
    return ok({ assignments, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/lms-assignments  Create an assignment and enroll users (admin). */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const body = await parseBody<{ lessonId: number; title: string; dueDate?: string; userIds?: number[] }>(request);
    if (!body?.lessonId || !body?.title) return badRequest("lessonId and title required");

    const assignment = await prisma.aquaticproLearningAssignment.create({
      data: {
        lessonId: body.lessonId, title: body.title,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        assignedBy: user.id,
      },
    });
    if (body.userIds?.length) {
      await prisma.aquaticproLearningAssignmentUser.createMany({
        data: body.userIds.map((uid) => ({ assignmentId: assignment.id, userId: uid })),
        skipDuplicates: true,
      });
    }
    return created(assignment);
  } catch (e) { return serverError(e); }
}
