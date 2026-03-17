import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/utils/api-helpers";
import { resolvePermissions, type UserPermissions } from "./permissions";

export interface SessionUser {
  id: number;
  supabaseUid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isMember: boolean;
  isArchived: boolean;
}

export interface SessionWithPermissions {
  user: SessionUser;
  permissions: UserPermissions;
}

/**
 * Get the current authenticated user from the Supabase session.
 * Replaces get_current_user_id() + get_userdata() from WordPress.
 *
 * Returns null if unauthenticated — callers should return unauthorized().
 */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { supabaseUid: user.id },
    select: {
      id: true,
      supabaseUid: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      isMember: true,
      isArchived: true,
    },
  });

  return dbUser;
}

/**
 * Get session + resolved permissions in one call.
 * Use in Server Components that need to gate entire pages.
 */
export async function getSessionWithPermissions(): Promise<SessionWithPermissions | null> {
  const user = await getSession();
  if (!user) return null;
  const permissions = await resolvePermissions(user.id);
  return { user, permissions };
}

/**
 * Require authentication — returns [user, null] or [null, errorResponse].
 * Use in API routes:
 *   const [user, err] = await requireSession();
 *   if (err) return err;
 */
export async function requireSession(): Promise<
  [SessionUser, null] | [null, ReturnType<typeof unauthorized>]
> {
  const user = await getSession();
  if (!user) return [null, unauthorized()];
  return [user, null];
}
