import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError, parseBody } from "@/lib/utils/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/public/return/[token] — Load invitation data for the return form. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const es = await prisma.srmEmployeeSeason.findFirst({
      where: { returnToken: token },
    });
    if (!es) return notFound("Invalid or expired invitation link.");
    if (es.tokenExpiresAt && es.tokenExpiresAt < new Date()) {
      return badRequest("This invitation link has expired. Please contact your supervisor.");
    }

    const [user, season] = await Promise.all([
      prisma.user.findUnique({
        where: { id: es.userId },
        select: { displayName: true, email: true },
      }),
      prisma.srmSeason.findUnique({
        where: { id: es.seasonId },
        select: { name: true, year: true, startDate: true, endDate: true },
      }),
    ]);

    if (!user || !season) return notFound("Associated record not found.");

    return ok({
      employeeSeasonId: es.id,
      status: es.status,
      alreadyResponded: !!es.responseDate,
      responseDate: es.responseDate?.toISOString() ?? null,
      longevityYears: es.longevityYears,
      employeeName: user.displayName,
      email: user.email,
      season: {
        name: season.name,
        year: season.year,
        startDate: season.startDate.toISOString(),
        endDate: season.endDate.toISOString(),
      },
    });
  } catch (e) {
    return serverError(e);
  }
}

/** POST /api/public/return/[token] — Submit the seasonal return response. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await parseBody(request);
    if (!body) return badRequest("Invalid JSON.");

    const es = await prisma.srmEmployeeSeason.findFirst({
      where: { returnToken: token },
    });
    if (!es) return notFound("Invalid or expired invitation link.");
    if (es.tokenExpiresAt && es.tokenExpiresAt < new Date()) {
      return badRequest("This invitation link has expired.");
    }
    if (es.responseDate) {
      return badRequest("You have already submitted your response.");
    }

    const { returning, signatureText, comments } = body as { returning?: boolean | string; signatureText?: string; comments?: string };
    if (returning === undefined || returning === null) {
      return badRequest("Please indicate whether you are returning.");
    }
    if (!signatureText?.trim()) {
      return badRequest("Please type your full name as your electronic signature.");
    }

    const isReturning = returning === true || returning === "true";
    const status = isReturning ? "returning" : "declined";

    await prisma.srmEmployeeSeason.update({
      where: { id: es.id },
      data: {
        status,
        signatureText: signatureText.trim(),
        comments: comments?.trim() ?? null,
        responseDate: new Date(),
      },
    });

    return ok({
      status,
      message: isReturning
        ? "Welcome back! Your response has been recorded. We look forward to seeing you this season."
        : "Thank you for letting us know. Your response has been recorded and we wish you the best.",
    });
  } catch (e) {
    return serverError(e);
  }
}
