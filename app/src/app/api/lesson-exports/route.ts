import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, badRequest, forbidden, serverError } from "@/lib/utils/api-helpers";

/**
 * GET /api/lesson-exports
 * Export lesson + section content for a given lessonId or courseId.
 * Used by the PDF/print export flow.
 */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms    = await resolvePermissions(user.id);
    if (!perms.modules.lms) return forbidden("LMS access required");

    const sp       = new URL(request.url).searchParams;
    const lessonId = sp.get("lessonId") ? parseInt(sp.get("lessonId")!, 10) : null;
    const courseId = sp.get("courseId") ? parseInt(sp.get("courseId")!, 10) : null;

    if (lessonId) {
      const lesson   = await prisma.aquaticproLesson.findUnique({ where: { id: lessonId } });
      if (!lesson) return badRequest("Lesson not found");
      const sections = await prisma.mpWbLessonSection.findMany({ where: { lessonId }, orderBy: { displayOrder: "asc" } });
      const whiteboard = lesson.excalidrawJson ? { excalidrawJson: lesson.excalidrawJson } : null;
      return ok({ lesson, sections, whiteboard });
    }

    if (courseId) {
      const course  = await prisma.aquaticproCourse.findUnique({ where: { id: courseId } });
      if (!course) return badRequest("Course not found");
      const sections = await prisma.aquaticproLessonSection.findMany({ where: { courseId }, orderBy: { displayOrder: "asc" } });
      const lessons  = await prisma.aquaticproLesson.findMany({ where: { courseId }, orderBy: { displayOrder: "asc" } });
      return ok({ course, sections, lessons });
    }

    return badRequest("lessonId or courseId required");
  } catch (e) { return serverError(e); }
}
