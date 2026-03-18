import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, forbidden, badRequest, serverError, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/time-slots — list time slots; pass ?all=true to include inactive (admin only) */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const showAll = request.nextUrl.searchParams.get("all") === "true";
    if (showAll) {
      const perms = await resolvePermissions(user.id);
      if (!perms.isAdmin) return forbidden("Admin access required");
    }

    const slots = await prisma.mpTimeSlot.findMany({
      where: showAll ? undefined : { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, label: true, color: true, sortOrder: true, isActive: true },
    });
    return ok(slots);
  } catch (e) {
    return serverError(e);
  }
}

interface SlotBody { label?: string; slug?: string; color?: string; sortOrder?: number; isActive?: boolean; }

/** POST /api/time-slots — create a new time slot (admin only) */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;
    const perms = await resolvePermissions(user.id);
    if (!perms.isAdmin) return forbidden("Admin access required");

    const body = await parseBody<SlotBody>(request);
    if (!body?.label?.trim()) return badRequest("label is required");

    const label = body.label.trim();
    const slug  = (body.slug?.trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));

    const existing = await prisma.mpTimeSlot.findFirst({ where: { slug } });
    if (existing) return badRequest("A time slot with this slug already exists");

    const lastSlot = await prisma.mpTimeSlot.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const nextOrder = (lastSlot?.sortOrder ?? 0) + 1;

    const slot = await prisma.mpTimeSlot.create({
      data: {
        label,
        slug,
        color:     body.color     ?? null,
        sortOrder: body.sortOrder ?? nextOrder,
        isActive:  body.isActive  ?? true,
      },
      select: { id: true, slug: true, label: true, color: true, sortOrder: true, isActive: true },
    });
    return created(slot);
  } catch (e) {
    return serverError(e);
  }
}
