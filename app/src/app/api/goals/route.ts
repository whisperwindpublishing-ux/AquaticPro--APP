import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { ok, created, badRequest, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/goals  Returns mentorship goals for the current user. Params: page, limit, status */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const sp     = new URL(request.url).searchParams;
    const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit  = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));
    const status = sp.get("status");

    const where = { authorId: user.id, ...(status ? { status } : {}) };
    const [goals, total] = await Promise.all([
      prisma.mentorshipGoal.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.mentorshipGoal.count({ where }),
    ]);
    return ok({ goals, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/goals  Create a goal. Body: { title, description?, status? } */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const body = await parseBody<{ title: string; content?: string; status?: string; mentorshipId: number }>(request);
    if (!body?.title || !body?.mentorshipId) return badRequest("title and mentorshipId required");

    const goal = await prisma.mentorshipGoal.create({
      data: { authorId: user.id, mentorshipId: body.mentorshipId, title: body.title, content: body.content ?? null },
    });
    return created(goal);
  } catch (e) { return serverError(e); }
}

/** PATCH /api/goals  Body: { id, title?, content?, status? } */
export async function PATCH(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const body = await parseBody<{ id: number; title?: string; content?: string; status?: string }>(request);
    if (!body?.id) return badRequest("id required");

    const goal = await prisma.mentorshipGoal.findUnique({ where: { id: body.id } });
    if (!goal) return notFound("Goal not found");
    if (goal.authorId !== user.id) return badRequest("Cannot edit another user's goal");

    const updated = await prisma.mentorshipGoal.update({
      where: { id: body.id },
      data: {
        ...(body.title       !== undefined && { title:       body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.status      !== undefined && { status:      body.status }),
      },
    });
    return ok(updated);
  } catch (e) { return serverError(e); }
}
