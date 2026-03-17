import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Supabase Auth callback handler.
 *
 * Handles:
 *  - Email confirmation links
 *  - OAuth redirects (Google, GitHub, etc.)
 *  - Magic link sign-ins
 *
 * After exchanging the code for a session, we ensure the user row
 * exists in our `users` table (needed for OAuth sign-ups where we
 * never ran the signUp server action).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Ensure a users row exists (covers OAuth sign-ups)
      const existing = await prisma.user.findUnique({
        where: { supabaseUid: data.user.id },
        select: { id: true },
      });

      if (!existing) {
        const email =
          data.user.email ??
          `user-${data.user.id.slice(0, 8)}@placeholder.internal`;

        const user = await prisma.user.create({
          data: {
            email,
            displayName:
              data.user.user_metadata?.full_name ??
              data.user.user_metadata?.name ??
              email.split("@")[0],
            avatarUrl: data.user.user_metadata?.avatar_url ?? null,
            supabaseUid: data.user.id,
            isMember: true,
            isArchived: false,
          },
        });

        await prisma.pgUserMetadata.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {},
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Exchange failed — redirect to login with error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
