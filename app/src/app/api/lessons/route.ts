import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/lessons  Params: id, courseId, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms   = await resolvePermissions(user.id);
    if (!perms.modules.lms) return forbidden("LMS access required");

    const sp      = new URL(request.url).searchParams;
    const idParam = sp.get("id");
    const courseId = sp.get("courseId") ? parseInt(sp.get("courseId")!, 10) : null;

    if (idParam) {
      const lesson = await prisma.aquaticproLesson.findUnique({ where: { id: parseInt(idParam, 10) } });
      if (!lesson) return notFound("Lesson not found");
      const progress = await prisma.aquaticproProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } });
      const sections = await prisma.mpWbLessonSection.findMany({ where: { lessonId: lesson.id }, orderBy: { displayOrder: "asc" } });
      return ok({ lesson, progress, sections });
    }

    if (!courseId) return badRequest("courseId or id required");
    const lessons = await prisma.aquaticproLesson.findMany({
      where: { courseId }, orderBy: { displayOrder: "asc" },
    });
    const progressRows = await prisma.aquaticproProgress.findMany({ where: { userId: user.id, lessonId: { in: lessons.map((l) => l.id) } } });
    const progressMap = Object.fromEntries(progressRows.map((p) => [p.lessonId, p]));
    return ok({ lessons: lessons.map((l) => ({ ...l, progress: progressMap[l.id] ?? null })) });
  } catch (e) { return serverError(e); }
}

/** POST /api/lessons  Create a lesson or update progress. Body contains action field. */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.lms) return forbidden("LMS access required");

    const body = await parseBody<{ action?: string; lessonId?: number; status?: string; timeSpentSeconds?: number; score?: number; courseId?: number; title?: string; displayOrder?: number; lessonType?: string; [k: string]: unknown }>(request);
    if (!body) return badRequest("Invalid body");

    // Track progress
    if (body.action === "progress" || body.lessonId) {
      if (!body.lessonId) return badRequest("lessonId required for progress");
      const record = await prisma.aquaticproProgress.upsert({
        where:  { userId_lessonId: { userId: user.id, lessonId: body.lessonId } },
        create: {
          userId: user.id, lessonId: body.lessonId,
          status: body.status ?? "in-progress",
          timeSpentSeconds: body.timeSpentSeconds ?? 0,
          completedAt: body.status === "completed" ? new Date() : null,
        },
        update: {
          status: body.status,
          timeSpentSeconds: body.timeSpentSeconds,
          lastViewed: new Date(),
          ...(body.status === "completed" ? { completedAt: new Date() } : {}),
          ...(body.score !== undefined ? { score: body.score } : {}),
        },
      });
      return ok(record);
    }

    // Create lesson (admin / canCreateLessons)
    const assignments = await prisma.pgUserJobAssignment.findMany({ where: { userId: user.id }, select: { jobRoleId: true } });
    const lmsPerms = await prisma.pgLmsPermission.findMany({ where: { jobRoleId: { in: assignments.map((a) => a.jobRoleId) }, canCreateLessons: true } });
    if (!perms.isAdmin && lmsPerms.length === 0) return forbidden("canCreateLessons required");
    if (!body.courseId || !body.title) return badRequest("courseId and title required");

    const lesson = await prisma.aquaticproLesson.create({
      data: {
        courseId: Number(body.courseId), title: String(body.title),
        lessonType: String(body.lessonType ?? "content"),
        displayOrder: Number(body.displayOrder ?? 0), createdBy: user.id,
      },
    });
    return created(lesson);
  } catch (e) { return serverError(e); }
}
