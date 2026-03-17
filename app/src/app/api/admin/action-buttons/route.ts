import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/permissions";
import { ok, created, badRequest, notFound, serverError, parseBody } from "@/lib/utils/api-helpers";

/**
 * GET  /api/admin/action-buttons — List all dashboard action buttons.
 * POST /api/admin/action-buttons — Create a new action button.
 * DELETE /api/admin/action-buttons?id=123 — Delete an action button.
 * PATCH /api/admin/action-buttons?id=123 — Update an action button.
 */

export async function GET() {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const buttons = await prisma.aqpDashboardActionButton.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return ok({ buttons });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const body = await parseBody(request) as Record<string, unknown>;
    if (!body) return badRequest("Invalid JSON.");
    const { title, url, color, thumbnailUrl, sortOrder } = body as { title: string; url: string; color?: string; thumbnailUrl?: string; sortOrder?: number };
    if (!title?.trim()) return badRequest("Title is required.");
    if (!url?.trim()) return badRequest("URL is required.");

    const button = await prisma.aqpDashboardActionButton.create({
      data: {
        title: title.trim(),
        url: url.trim(),
        color: color?.trim() || "blue",
        thumbnailUrl: thumbnailUrl?.trim() || null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });
    return created({ button });
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

    const id = parseInt(new URL(request.url).searchParams.get("id") ?? "", 10);
    if (isNaN(id)) return badRequest("id is required.");

    const body = await parseBody(request) as Record<string, unknown>;
    if (!body) return badRequest("Invalid JSON.");

    const { title, url, color, thumbnailUrl, sortOrder } = body as { title?: string; url?: string; color?: string; thumbnailUrl?: string; sortOrder?: number };
    const button = await prisma.aqpDashboardActionButton.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(url !== undefined ? { url: url.trim() } : {}),
        ...(color !== undefined ? { color: color.trim() } : {}),
        ...(thumbnailUrl !== undefined ? { thumbnailUrl: thumbnailUrl?.trim() || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      },
    });
    return ok({ button });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const [, err] = await requireAdmin(user);
    if (err) return err;

    const id = parseInt(new URL(request.url).searchParams.get("id") ?? "", 10);
    if (isNaN(id)) return badRequest("id is required.");

    const existing = await prisma.aqpDashboardActionButton.findUnique({ where: { id } });
    if (!existing) return notFound("Button not found.");

    await prisma.aqpDashboardActionButton.delete({ where: { id } });
    return ok({ deleted: id });
  } catch (e) {
    return serverError(e);
  }
}
