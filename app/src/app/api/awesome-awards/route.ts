import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/awesome-awards  Params: section=periods|categories|nominations|votes, periodId */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms   = await resolvePermissions(user.id);
    if (!perms.modules.awesomeAwards) return forbidden("Awesome Awards access required");

    const sp      = new URL(request.url).searchParams;
    const section = sp.get("section") ?? "periods";
    const periodId = sp.get("periodId") ? parseInt(sp.get("periodId")!, 10) : undefined;

    if (section === "periods") {
      const periods = await prisma.awesomeAwardsPeriod.findMany({ orderBy: { startDate: "desc" } });
      return ok({ periods });
    }
    if (section === "categories") {
      const categories = await prisma.awesomeAwardsCategory.findMany({ orderBy: { sortOrder: "asc" } });
      return ok({ categories });
    }
    if (section === "nominations") {
      const where = { ...(periodId ? { periodId } : {}), archived: false };
      const nominations = await prisma.awesomeAwardsNomination.findMany({ where, orderBy: { createdAt: "desc" } });
      return ok({ nominations });
    }
    if (section === "my-votes") {
      const votes = await prisma.awesomeAwardsVote.findMany({ where: { voterId: user.id } });
      return ok({ votes });
    }
    return badRequest("section must be periods|categories|nominations|my-votes");
  } catch (e) { return serverError(e); }
}

/** POST /api/awesome-awards  Body: { action: "nominate"|"vote", ... } */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.awesomeAwards) return forbidden("Awesome Awards access required");

    const body = await parseBody<{ action: string; [k: string]: unknown }>(request);
    if (!body?.action) return badRequest("action is required");

    if (body.action === "nominate") {
      const { periodId, categoryId, nomineeId, message } = body as unknown as { periodId: number; categoryId: number; nomineeId: number; message?: string };
      if (!periodId || !categoryId || !nomineeId) return badRequest("periodId, categoryId, nomineeId required");

      const [nomination, category, nominator] = await Promise.all([
        prisma.awesomeAwardsNomination.create({
          data: { periodId, categoryId, nomineeId, nominatorId: user.id, reason: message ?? null },
        }),
        prisma.awesomeAwardsCategory.findUnique({ where: { id: categoryId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: user.id }, select: { displayName: true } }),
      ]);

      // Queue a notification email to the nominee
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await prisma.aquaticproEmailQueue.create({
        data: {
          userId: nomineeId,
          emailType: "awards_nomination",
          subject: `You've been nominated for an Awesome Award! 🏆`,
          body: `<p><strong>${nominator?.displayName ?? "A colleague"}</strong> has nominated you for the <strong>${category?.name ?? ""}</strong> award.</p>${message ? `<blockquote>${message}</blockquote>` : ""}<p><a href="${appUrl}/awards">View Awards &rarr;</a></p>`,
          contextId: nomination.id,
          status: "pending",
        },
      });

      return created(nomination);
    }

    if (body.action === "vote") {
      const { nominationId } = body as unknown as { nominationId: number };
      if (!nominationId) return badRequest("nominationId required");
      const vote = await prisma.awesomeAwardsVote.upsert({
        where:  { nominationId_voterId: { nominationId, voterId: user.id } },
        create: { voterId: user.id, nominationId },
        update: {},
      });
      return ok(vote);
    }

    return badRequest("action must be nominate or vote");
  } catch (e) { return serverError(e); }
}
