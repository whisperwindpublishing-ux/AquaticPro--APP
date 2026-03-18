import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, forbidden, notFound, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

interface SlotBody { label?: string; slug?: string; color?: string; sortOrder?: number; isActive?: boolean; }

/** PUT /api/time-slots/[id] — update a time slot (admin only) */
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const { id } = await params;
    const slotId = parseInt(id, 10);
    if (isNaN(slotId)) return notFound();

    const existing = await prisma.mpTimeSlot.findUnique({ where: { id: slotId } });
    if (!existing) return notFound();

    const body = await parseBody<SlotBody>(request);
    if (!body) return badRequest("Request body required");

    const updated = await prisma.mpTimeSlot.update({
      where: { id: slotId },
      data: {
        ...(body.label     !== undefined ? { label: body.label.trim() }         : {}),
        ...(body.slug      !== undefined ? { slug: body.slug.trim() }           : {}),
        ...(body.color     !== undefined ? { color: body.color || null }        : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder }        : {}),
        ...(body.isActive  !== undefined ? { isActive: body.isActive }          : {}),
      },
      select: { id: true, slug: true, label: true, color: true, sortOrder: true, isActive: true },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}

/** DELETE /api/time-slots/[id] — delete a time slot (admin only) */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const { id } = await params;
    const slotId = parseInt(id, 10);
    if (isNaN(slotId)) return notFound();

    await prisma.mpTimeSlot.delete({ where: { id: slotId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
