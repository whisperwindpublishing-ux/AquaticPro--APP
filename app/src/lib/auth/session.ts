import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/utils/api-helpers";

export interface SessionUser {
  id: number;
  supabaseUid: string;
  email: string;
  displayName: string;
  isMember: boolean;
  isArchived: boolean;
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
      isMember: true,
      isArchived: true,
    },
  });

  return dbUser;
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
