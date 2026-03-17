import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/mentorship  Params: section=requests|goals|meetings, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const sp      = new URL(request.url).searchParams;
    const section = sp.get("section") ?? "requests";
    const page    = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit   = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));

    if (section === "requests") {
      const where = { OR: [{ authorId: user.id }, { receiverId: user.id }] };
      const [requests, total] = await Promise.all([
        prisma.mentorshipRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.mentorshipRequest.count({ where }),
      ]);
      return ok({ requests, total, page, limit });
    }
    if (section === "goals") {
      const goals = await prisma.mentorshipGoal.findMany({ where: { authorId: user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit });
      return ok({ goals });
    }
    if (section === "meetings") {
      const meetings = await prisma.mentorshipMeeting.findMany({
        where: { authorId: user.id },
        orderBy: { meetingDate: "desc" }, skip: (page - 1) * limit, take: limit,
      });
      return ok({ meetings });
    }
    return badRequest("section must be requests|goals|meetings");
  } catch (e) { return serverError(e); }
}

/** POST /api/mentorship  Body: { action: "request"|"goal"|"meeting", ... } */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const body = await parseBody<{ action: string; [k: string]: unknown }>(request);
    if (!body?.action) return badRequest("action required");

    if (body.action === "request") {
      const { receiverId } = body as unknown as { receiverId: number };
      if (!receiverId) return badRequest("receiverId required");
      const req = await prisma.mentorshipRequest.create({
        data: { authorId: user.id, receiverId, status: "Pending" },
      });
      return created(req);
    }
    if (body.action === "goal") {
      const { title, content, mentorshipId } = body as unknown as { title: string; content?: string; mentorshipId: number };
      if (!title || !mentorshipId) return badRequest("title and mentorshipId required");
      const goal = await prisma.mentorshipGoal.create({
        data: { authorId: user.id, mentorshipId, title, content: content ?? null },
      });
      return created(goal);
    }
    if (body.action === "meeting") {
      const { goalId, meetingDate, title: meetingTitle, notes } = body as unknown as { goalId: number; meetingDate: string; title?: string; notes?: string };
      if (!goalId || !meetingDate) return badRequest("goalId and meetingDate required");
      const meeting = await prisma.mentorshipMeeting.create({
        data: { goalId, authorId: user.id, title: String(meetingTitle ?? "Meeting"), meetingDate: new Date(meetingDate), content: notes ?? null },
      });
      return created(meeting);
    }
    return badRequest("action must be request|goal|meeting");
  } catch (e) { return serverError(e); }
}
