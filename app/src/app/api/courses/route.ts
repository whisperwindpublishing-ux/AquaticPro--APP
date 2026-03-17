import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/courses  Params: id, category, status, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms    = await resolvePermissions(user.id);
    if (!perms.modules.lms) return forbidden("LMS access required");

    const sp       = new URL(request.url).searchParams;
    const page     = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit    = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));
    const category = sp.get("category");
    const idParam  = sp.get("id");

    if (idParam) {
      const course = await prisma.aquaticproCourse.findUnique({ where: { id: parseInt(idParam, 10) } });
      if (!course) return notFound("Course not found");
      const lessons = await prisma.aquaticproLesson.findMany({ where: { courseId: course.id }, orderBy: { displayOrder: "asc" } });
      const sections = await prisma.aquaticproLessonSection.findMany({ where: { courseId: course.id }, orderBy: { displayOrder: "asc" } });
      const progress = await prisma.aquaticproProgress.findMany({ where: { userId: user.id, lessonId: { in: lessons.map((l) => l.id) } } });
      return ok({ course, lessons, sections, progress });
    }

    const where = {
      status: "published",
      ...(category ? { category } : {}),
    };
    const [courses, total] = await Promise.all([
      prisma.aquaticproCourse.findMany({ where, orderBy: { displayOrder: "asc" }, skip: (page - 1) * limit, take: limit }),
      prisma.aquaticproCourse.count({ where }),
    ]);
    const categories = await prisma.aquaticproCourseCategory.findMany({ orderBy: { displayOrder: "asc" } });
    return ok({ courses, categories, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/courses  Create a course (requires canCreateCourses). */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.lms) return forbidden("LMS access required");

    const assignments = await prisma.pgUserJobAssignment.findMany({ where: { userId: user.id }, select: { jobRoleId: true } });
    const lmsPerms = await prisma.pgLmsPermission.findMany({ where: { jobRoleId: { in: assignments.map((a) => a.jobRoleId) }, canCreateCourses: true } });
    if (!perms.isAdmin && lmsPerms.length === 0) return forbidden("canCreateCourses required");

    const body = await parseBody<{ title: string; description?: string; category?: string; isSequential?: boolean; status?: string }>(request);
    if (!body?.title) return badRequest("title required");

    const course = await prisma.aquaticproCourse.create({
      data: {
        title: body.title, description: body.description ?? null,
        category: body.category ?? null, isSequential: body.isSequential ?? false,
        status: body.status ?? "draft", createdBy: user.id,
      },
    });
    return created(course);
  } catch (e) { return serverError(e); }
}
