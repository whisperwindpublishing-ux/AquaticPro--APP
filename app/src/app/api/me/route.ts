import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, serverError, badRequest } from "@/lib/utils/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/me
 * Returns the current user profile + resolved permissions.
 * Lightweight endpoint used by usePermissions() and the client nav.
 * Permissions are Redis-cached for 5 min — safe to call on every page load.
 */
export async function GET() {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const permissions = await resolvePermissions(user.id);
    return ok({ user, permissions });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * PATCH /api/me
 * Update the current user's profile (displayName).
 */
export async function PATCH(req: Request) {
  try {
    const [user, authErr] = await requireSession();
    if (authErr) return authErr;

    const body = await req.json() as { displayName?: string };
    const displayName = body.displayName?.trim();
    if (!displayName) return badRequest("displayName is required");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayName },
      select: { id: true, displayName: true, email: true, avatarUrl: true },
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
