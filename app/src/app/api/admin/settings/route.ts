import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/permissions";
import { ok, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

/**
 * GET /api/admin/settings — Return all app settings as a key→value object.
 * PATCH /api/admin/settings — Update one or more settings by key.
 */

export async function GET() {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const rows = await prisma.appSetting.findMany({ orderBy: { key: "asc" } });
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    return ok({ settings });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const body = await parseBody(request);
    if (!body || typeof body !== "object") return badRequest("Expected JSON object of { key: value } pairs.");

    const updates = Object.entries(body as Record<string, string>);
    if (updates.length === 0) return badRequest("No settings provided.");

    await prisma.$transaction(
      updates.map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        })
      )
    );

    return ok({ updated: updates.map(([k]) => k) });
  } catch (e) {
    return serverError(e);
  }
}
