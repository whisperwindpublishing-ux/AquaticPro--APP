/**
 * Cron: Weekly Webhook — Daily Logs Export
 * Queries daily logs from the past 7 days, formats them with reactions
 * and comments, and POSTs the payload to the configured n8n webhook.
 *
 * Replaces class-daily-logs-webhook.php from the WordPress plugin.
 * Triggered every Friday at 4 AM ET by Vercel Cron — see vercel.json.
 */

import { prisma } from "@/lib/prisma";
import { ok, serverError } from "@/lib/utils/api-helpers";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[WeeklyWebhook] N8N_WEBHOOK_URL is not configured — skipping");
    return ok({ skipped: true, reason: "N8N_WEBHOOK_URL not configured" });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch logs (no author relation — resolve separately)
    const logs = await prisma.dailyLog.findMany({
      where: {
        status: { in: ["publish", "draft"] },
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { logDate: "desc" },
    });

    if (logs.length === 0) {
      return ok({ sent: false, reason: "No logs in the past 7 days" });
    }

    // Resolve author display names
    const authorIds = [...new Set(logs.map((l) => l.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, displayName: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a.displayName]));

    // Fetch all location names for the relevant locationIds
    const locationIds = [...new Set(logs.map((l) => l.locationId).filter(Boolean))] as number[];
    const locations = await prisma.pgLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    });
    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    const logIds = logs.map((l) => l.id);

    // Fetch all reactions and comments for the batch
    const [allReactions, allComments] = await Promise.all([
      prisma.aqpUnifiedReaction.findMany({
        where: { objectId: { in: logIds }, objectType: "daily_log" },
        select: { objectId: true, reactionType: true },
      }),
      prisma.dailyLogComment.findMany({
        where: { logId: { in: logIds } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Index reactions by logId
    const reactionsByLog = new Map<number, typeof allReactions>();
    for (const r of allReactions) {
      if (!reactionsByLog.has(r.objectId)) reactionsByLog.set(r.objectId, []);
      reactionsByLog.get(r.objectId)!.push(r);
    }

    // Resolve comment author display names
    const commentUserIds = [...new Set(allComments.map((c) => c.userId))];
    const commentUsers = commentUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: commentUserIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const commentAuthorMap = new Map(commentUsers.map((u) => [u.id, u.displayName]));

    // Fetch comment reactions
    const commentIds = allComments.map((c) => c.id);
    const commentReactions = commentIds.length
      ? await prisma.aqpUnifiedReaction.findMany({
          where: { objectId: { in: commentIds }, objectType: "comment" },
          select: { objectId: true, reactionType: true },
        })
      : [];
    const reactionsByComment = new Map<number, typeof commentReactions>();
    for (const r of commentReactions) {
      if (!reactionsByComment.has(r.objectId)) reactionsByComment.set(r.objectId, []);
      reactionsByComment.get(r.objectId)!.push(r);
    }

    function countReactions(reactions: { reactionType: string }[]) {
      const counts: Record<string, number> = {};
      for (const r of reactions) {
        counts[r.reactionType] = (counts[r.reactionType] ?? 0) + 1;
      }
      return { ...counts, total: reactions.length };
    }

    // Index comments by logId
    const commentsByLog = new Map<number, typeof allComments>();
    for (const c of allComments) {
      if (!commentsByLog.has(c.logId)) commentsByLog.set(c.logId, []);
      commentsByLog.get(c.logId)!.push(c);
    }

    const formattedLogs = logs.map((log) => {
      const logReactions = reactionsByLog.get(log.id) ?? [];
      const logComments = commentsByLog.get(log.id) ?? [];

      return {
        id: log.id,
        author_name: authorMap.get(log.authorId) ?? "Unknown",
        location: log.locationId ? (locationMap.get(log.locationId) ?? "") : "",
        log_date: log.logDate,
        status: log.status,
        reaction_counts: countReactions(logReactions),
        comment_count: logComments.length,
        comments: logComments.map((c) => ({
          id: c.id,
          author_name: commentAuthorMap.get(c.userId) ?? "Anonymous",
          content: c.content,
          reaction_counts: countReactions(reactionsByComment.get(c.id) ?? []),
          created_at: c.createdAt,
        })),
        created_at: log.createdAt,
      };
    });

    const now = new Date();
    const payload = {
      source: "aquaticpro",
      export_type: "weekly_daily_logs",
      export_date: now.toISOString(),
      date_range: {
        from: sevenDaysAgo.toISOString().split("T")[0],
        to: now.toISOString().split("T")[0],
      },
      total_logs: formattedLogs.length,
      logs: formattedLogs,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.error(`[WeeklyWebhook] n8n returned ${response.status}`);
      return ok({ sent: false, status: response.status });
    }

    return ok({ sent: true, total: formattedLogs.length });
  } catch (error) {
    return serverError(error);
  }
}
