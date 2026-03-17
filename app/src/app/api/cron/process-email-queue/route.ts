/**
 * Cron: Process Email Queue
 * Queries pending rows from aquaticpro_email_queue, sends via Resend,
 * marks successful sends as "sent" and permanently-failed ones as "failed".
 * Triggered every 15 minutes by Vercel Cron — see vercel.json.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { genericQueueEmail } from "@/lib/email/templates";
import { ok, serverError } from "@/lib/utils/api-helpers";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const queued = await prisma.aquaticproEmailQueue.findMany({
      where: { status: "pending", attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    if (queued.length === 0) {
      return ok({ processed: 0, message: "Queue is empty" });
    }

    // Build a user-id → email map for all recipients in this batch
    const userIds = [...new Set(queued.map((q) => q.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    let sent = 0;
    let failed = 0;

    for (const item of queued) {
      const recipient = userMap.get(item.userId);
      if (!recipient?.email) {
        await prisma.aquaticproEmailQueue.update({
          where: { id: item.id },
          data: { status: "failed", attempts: { increment: 1 } },
        });
        failed++;
        continue;
      }

      try {
        const { subject, html } = genericQueueEmail(item.subject, item.body);
        await sendEmail({ to: recipient.email, subject, html });
        await prisma.aquaticproEmailQueue.update({
          where: { id: item.id },
          data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 } },
        });
        sent++;
      } catch {
        const newAttempts = item.attempts + 1;
        await prisma.aquaticproEmailQueue.update({
          where: { id: item.id },
          data: {
            attempts: { increment: 1 },
            status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          },
        });
        failed++;
      }
    }

    return ok({ processed: queued.length, sent, failed });
  } catch (error) {
    return serverError(error);
  }
}
