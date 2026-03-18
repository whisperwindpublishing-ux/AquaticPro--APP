import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, forbidden, notFound, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

const VALID_REACTIONS = new Set(["thumbs_up", "thumbs_down", "heart"]);

/**
 * POST /api/daily-logs/[id]/reactions
 * Body: { reactionType: "thumbs_up" | "thumbs_down" | "heart", objectType?: "daily_log" | "comment", objectId?: number }
 *
 * Behaviour:
 *  - If user has the same reaction → remove it (toggle off)
 *  - If user has a different reaction → replace it
 *  - If no existing reaction → add it
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

    const log = await prisma.dailyLog.findUnique({ where: { id: logId } });
    if (!log || log.status === "trash") return notFound();

    const body = await parseBody<{
      reactionType: string;
      objectType?: "daily_log" | "comment";
      objectId?: number;
    }>(request);

    if (!body?.reactionType) return badRequest("reactionType is required");
    if (!VALID_REACTIONS.has(body.reactionType)) {
      return badRequest(`reactionType must be one of: ${[...VALID_REACTIONS].join(", ")}`);
    }

    // objectType/objectId allow reacting to comments via this same endpoint
    const objectType = body.objectType ?? "daily_log";
    const objectId   = body.objectId   ?? logId;

    const existing = await prisma.aqpUnifiedReaction.findFirst({
      where: { userId: user.id, objectId, objectType },
    });

    let myReaction: string | null = null;

    if (existing?.reactionType === body.reactionType) {
      // Toggle off
      await prisma.aqpUnifiedReaction.delete({ where: { id: existing.id } });
      myReaction = null;
    } else if (existing) {
      // Replace
      await prisma.aqpUnifiedReaction.update({
        where: { id: existing.id },
        data: { reactionType: body.reactionType },
      });
      myReaction = body.reactionType;
    } else {
      // Add
      await prisma.aqpUnifiedReaction.create({
        data: {
          userId: user.id,
          objectId,
          objectType,
          reactionType: body.reactionType,
          itemAuthorId: log.authorId,
        },
      });
      myReaction = body.reactionType;
    }

    // Return updated count map for the reacted object
    const reactions = await prisma.aqpUnifiedReaction.groupBy({
      by: ["reactionType"],
      where: { objectId, objectType },
      _count: { reactionType: true },
    });
    const reactionMap: Record<string, number> = {};
    for (const r of reactions) reactionMap[r.reactionType] = r._count.reactionType;

    return ok({ reactions: reactionMap, myReaction });
  } catch (e) {
    return serverError(e);
  }
}
