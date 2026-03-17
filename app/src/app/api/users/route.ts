import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { requireAdmin, resolvePermissions } from "@/lib/auth/permissions";
import { ok, badRequest, serverError, notFound, parseBody } from "@/lib/utils/api-helpers";

const USER_SELECT = {
  id: true, email: true, displayName: true, firstName: true, lastName: true,
  avatarUrl: true, phone: true, bio: true, tagline: true, mentorOptIn: true,
  skills: true, linkedinUrl: true, isMember: true, isArchived: true, createdAt: true,
} as const;

/**
 * GET /api/users
 * Admin: list all users with search + pagination.
 * Member: returns own profile only.
 * Params: search, page, limit, archived, id
 */
export async function GET(request: NextRequest) {
  try {
    const [currentUser, authErr] = await requireSession();
    if (authErr) return authErr;

    const perms = await resolvePermissions(currentUser.id);
    const { searchParams } = new URL(request.url);
    const search       = searchParams.get("search") ?? "";
    const page         = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit        = Math.min(100, parseInt(searchParams.get("limit") ?? "25", 10));
    const showArchived = searchParams.get("archived") === "true";
    const idParam      = searchParams.get("id");

    // Non-admin: return own profile only
    if (!perms.isAdmin) {
      const self = await prisma.user.findUnique({ where: { id: currentUser.id }, select: USER_SELECT });
      return ok({ users: [self], total: 1, page: 1, limit: 1 });
    }

    const where = {
      isArchived: showArchived ? undefined : false,
      ...(idParam ? { id: parseInt(idParam, 10) } : {}),
      ...(search ? {
        OR: [
          { email:       { contains: search, mode: "insensitive" as const } },
          { displayName: { contains: search, mode: "insensitive" as const } },
          { firstName:   { contains: search, mode: "insensitive" as const } },
          { lastName:    { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { displayName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return ok({ users, total, page, limit });
  } catch (e) { return serverError(e); }
}

/**
 * PATCH /api/users
 * Update own profile (or any user if admin).
 * Admin-only fields: isMember, isArchived, targeting another user via id.
 */
export async function PATCH(request: NextRequest) {
  try {
    const [currentUser, authErr] = await requireSession();
    if (authErr) return authErr;

    const body = await parseBody<{
      id?: number; displayName?: string; firstName?: string; lastName?: string;
      phone?: string; bio?: string; tagline?: string; mentorOptIn?: boolean;
      skills?: string; linkedinUrl?: string; customLinks?: string;
      isMember?: boolean; isArchived?: boolean;
    }>(request);
    if (!body) return badRequest("Invalid JSON body");

    const targetId = body.id ?? currentUser.id;
    if (targetId !== currentUser.id || body.isMember !== undefined || body.isArchived !== undefined) {
      const [, err] = await requireAdmin(currentUser);
      if (err) return err;
    }

    const existing = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!existing) return notFound("User not found");

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(body.displayName !== undefined && { displayName:  body.displayName }),
        ...(body.firstName   !== undefined && { firstName:    body.firstName }),
        ...(body.lastName    !== undefined && { lastName:     body.lastName }),
        ...(body.phone       !== undefined && { phone:        body.phone }),
        ...(body.bio         !== undefined && { bio:          body.bio }),
        ...(body.tagline     !== undefined && { tagline:      body.tagline }),
        ...(body.mentorOptIn !== undefined && { mentorOptIn:  body.mentorOptIn }),
        ...(body.skills      !== undefined && { skills:       body.skills }),
        ...(body.linkedinUrl !== undefined && { linkedinUrl:  body.linkedinUrl }),
        ...(body.customLinks !== undefined && { customLinks:  body.customLinks }),
        ...(body.isMember    !== undefined && { isMember:     body.isMember }),
        ...(body.isArchived  !== undefined && { isArchived:   body.isArchived }),
      },
      select: USER_SELECT,
    });

    return ok(updated);
  } catch (e) { return serverError(e); }
}
