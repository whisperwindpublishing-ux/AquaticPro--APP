import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, forbidden, notFound, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

async function getLog(logId: number) {
  return prisma.dailyLog.findUnique({ where: { id: logId } });
}

/**
 * GET /api/daily-logs/[id]/comments
 * Returns comments with author hydration, newest first.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) return notFound();

    const log = await getLog(logId);
    if (!log || log.status === "trash") return notFound();

    const comments = await prisma.dailyLogComment.findMany({
      where: { logId },
      orderBy: { createdAt: "asc" },
    });

    const userIds = [...new Set(comments.map((c) => c.userId))];
    const profiles = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        })
      : [];
    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

    // Reaction counts per comment
    const commentIds = comments.map((c) => c.id);
    const reactionRows = commentIds.length > 0
      ? await prisma.aqpUnifiedReaction.groupBy({
          by: ["objectId", "reactionType"],
          where: { objectId: { in: commentIds }, objectType: "comment" },
          _count: { reactionType: true },
        })
      : [];

    const commentReactionMap: Record<number, Record<string, number>> = {};
    for (const r of reactionRows) {
      if (!commentReactionMap[r.objectId]) commentReactionMap[r.objectId] = {};
      commentReactionMap[r.objectId][r.reactionType] = r._count.reactionType;
    }

    // My reactions on comments
    const myReactionRows = commentIds.length > 0
      ? await prisma.aqpUnifiedReaction.findMany({
          where: { objectId: { in: commentIds }, objectType: "comment", userId: user.id },
          select: { objectId: true, reactionType: true },
        })
      : [];
    const myCommentReactions: Record<number, string> = {};
    for (const r of myReactionRows) myCommentReactions[r.objectId] = r.reactionType;

    const hydrated = comments.map((c) => {
      const p = profileMap[c.userId];
      return {
        ...c,
        author: {
          id: c.userId,
          name: p ? (p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Unknown") : "Unknown",
          avatarUrl: p?.avatarUrl ?? null,
        },
        reactions: commentReactionMap[c.id] ?? {},
        myReaction: myCommentReactions[c.id] ?? null,
        isOwn: c.userId === user.id,
      };
    });

    return ok(hydrated);
  } catch (e) {
    return serverError(e);
  }
}

/**
 * POST /api/daily-logs/[id]/comments
 * Body: { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.dailyLogs) return forbidden("Daily logs access required");

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) return notFound();

    const log = await getLog(logId);
    if (!log || log.status === "trash") return notFound();

    const body = await parseBody<{ content: string }>(request);
    if (!body?.content?.trim()) return badRequest("content is required");

    const comment = await prisma.dailyLogComment.create({
      data: { logId, userId: user.id, content: body.content.trim() },
    });

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { displayName: true, firstName: true, lastName: true, avatarUrl: true },
    });

    return created({
      ...comment,
      author: {
        id: user.id,
        name: profile?.displayName || `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "Unknown",
        avatarUrl: profile?.avatarUrl ?? null,
      },
      reactions: {},
      myReaction: null,
      isOwn: true,
    });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * DELETE /api/daily-logs/[id]/comments
 * Query: ?commentId=123
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const { id } = await params;
    const logId = parseInt(id, 10);
    if (isNaN(logId)) return notFound();

    const perms  = await resolvePermissions(user.id);
    const commentIdStr = new URL(request.url).searchParams.get("commentId");
    if (!commentIdStr) return badRequest("commentId is required");
    const commentId = parseInt(commentIdStr, 10);

    const comment = await prisma.dailyLogComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.logId !== logId) return notFound();

    if (!perms.isAdmin && comment.userId !== user.id) return forbidden("Cannot delete another user's comment");

    await prisma.dailyLogComment.delete({ where: { id: commentId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
