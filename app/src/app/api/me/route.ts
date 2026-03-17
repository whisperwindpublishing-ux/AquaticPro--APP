import { requireSession } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/auth/permissions";
import { ok, serverError } from "@/lib/utils/api-helpers";

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
