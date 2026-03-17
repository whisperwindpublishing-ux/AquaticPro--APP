import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, created, badRequest, forbidden, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

/** GET /api/new-hires  Admin only. Params: status, search, page, limit */
export async function GET(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.newHires) return forbidden("New Hires access required");

    const sp     = new URL(request.url).searchParams;
    const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
    const limit  = Math.min(100, parseInt(sp.get("limit") ?? "25", 10));
    const status = sp.get("status");
    const search = sp.get("search") ?? "";

    const where = {
      isArchived: false,
      ...(status ? { status } : {}),
      ...(search ? { OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName:  { contains: search, mode: "insensitive" as const } },
        { email:     { contains: search, mode: "insensitive" as const } },
      ]} : {}),
    };

    const [hires, total] = await Promise.all([
      prisma.aquaticproNewHire.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.aquaticproNewHire.count({ where }),
    ]);
    return ok({ hires, total, page, limit });
  } catch (e) { return serverError(e); }
}

/** POST /api/new-hires  Create a new-hire record (admin). */
export async function POST(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.newHires) return forbidden("New Hires access required");

    const body = await parseBody<{
      firstName: string; lastName: string; email: string;
      phone?: string; position: string; needsWorkPermit?: boolean;
      dateOfBirth?: string; address?: string;
    }>(request);
    if (!body?.firstName || !body?.lastName || !body?.email || !body?.position)
      return badRequest("firstName, lastName, email, and position required");

    const hire = await prisma.aquaticproNewHire.create({
      data: {
        firstName: body.firstName, lastName: body.lastName, email: body.email,
        phone: body.phone ?? "", position: body.position,
        needsWorkPermit: body.needsWorkPermit ?? false,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        address: body.address ?? "", status: "pending",
      },
    });
    return created(hire);
  } catch (e) { return serverError(e); }
}

/** PATCH /api/new-hires  Body: { id, status?, loiSent?, notes?, isArchived? } */
export async function PATCH(request: NextRequest) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(user.id);
    if (!perms.modules.newHires) return forbidden();

    const body = await parseBody<{ id: number; status?: string; loiSent?: boolean; notes?: string; isArchived?: boolean }>(request);
    if (!body?.id) return badRequest("id required");

    const existing = await prisma.aquaticproNewHire.findUnique({ where: { id: body.id } });
    if (!existing) return notFound("New hire not found");

    const updated = await prisma.aquaticproNewHire.update({
      where: { id: body.id },
      data: {
        ...(body.status     !== undefined && { status:     body.status }),
        ...(body.loiSent    !== undefined && { loiSent:    body.loiSent, loiSentDate: body.loiSent ? new Date() : null }),
        ...(body.notes      !== undefined && { notes:      body.notes }),
        ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
      },
    });
    return ok(updated);
  } catch (e) { return serverError(e); }
}
