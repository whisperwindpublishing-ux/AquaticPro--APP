import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/whiteboard  Params: id, section=boards|sections, lessonId */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms   = await resolvePermissions(user.id);
    if (!perms.modules.whiteboard) return forbidden("Whiteboard access required");

    const sp      = new URL(request.url).searchParams;
    const idParam = sp.get("id");
    const lessonId = sp.get("lessonId") ? parseInt(sp.get("lessonId")!, 10) : null;

    if (idParam) {
      const board = await prisma.mpWbWhiteboard.findUnique({ where: { id: parseInt(idParam, 10) } });
      if (!board) return notFound("Whiteboard not found");
      return ok({ board });
    }
    if (lessonId) {
      const sections = await prisma.mpWbLessonSection.findMany({
        where: { lessonId }, orderBy: { displayOrder: "asc" },
      });
      const progress = await prisma.mpWbLessonProgress.findUnique({
        where: { userId_lessonId: { userId: user.id, lessonId } },
      });
      const sectionProgress = await prisma.mpWbSectionProgress.findMany({
        where: { userId: user.id, lessonSectionId: { in: sections.map((s) => s.id) } },
      });
      return ok({ sections, progress, sectionProgress });
    }
    return badRequest("id or lessonId required");
  } catch (e) { return serverError(e); }
}

/** POST /api/whiteboard  Create a whiteboard or save progress. */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.whiteboard) return forbidden();

    const body = await parseBody<{ action?: string; lessonId?: number; sectionId?: number; progress?: unknown; title?: string; lessonSectionId?: number }>(request);
    if (!body) return badRequest("Invalid body");

    if (body.action === "progress" && body.lessonId) {
      const record = await prisma.mpWbLessonProgress.upsert({
        where:  { userId_lessonId: { userId: user.id, lessonId: body.lessonId } },
        create: { userId: user.id, lessonId: body.lessonId, status: "in-progress" },
        update: { status: "in-progress", lastAccessedAt: new Date() },
      });
      return ok(record);
    }

    if (body.title && body.lessonSectionId) {
      const assignments = await prisma.pgUserJobAssignment.findMany({ where: { userId: user.id }, select: { jobRoleId: true } });
      const lmPerms = await prisma.pgLessonManagementPermission.findMany({ where: { jobRoleId: { in: assignments.map((a) => a.jobRoleId) }, canCreate: true } });
      if (!perms.isAdmin && lmPerms.length === 0) return forbidden("canCreate lessons required");
      const board = await prisma.mpWbWhiteboard.create({
        data: { title: body.title, lessonSectionId: body.lessonSectionId!, data: "{}" },
      });
      return created(board);
    }

    return badRequest("Provide action=progress or a title to create a board");
  } catch (e) { return serverError(e); }
}
