import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/lms-auto-assign  List auto-assign rules (admin). */
export async function GET(_request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const rules = await prisma.aquaticproCourseAutoAssignRule.findMany({ orderBy: { id: "asc" } });
    return ok({ rules });
  } catch (e) { return serverError(e); }
}

/** POST /api/lms-auto-assign  Create an auto-assign rule. */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const body = await parseBody<{ courseId: number; jobRoleId: number; sendNotification?: boolean }>(request);
    if (!body?.courseId || !body?.jobRoleId) return badRequest("courseId and jobRoleId required");

    const rule = await prisma.aquaticproCourseAutoAssignRule.create({
      data: { courseId: body.courseId, jobRoleId: body.jobRoleId, sendNotification: body.sendNotification ?? true, createdBy: user.id },
    });
    return created(rule);
  } catch (e) { return serverError(e); }
}
