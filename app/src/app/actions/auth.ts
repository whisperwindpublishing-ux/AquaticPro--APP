"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function signIn(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = (formData.get("email") as string).trim();
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export async function signUp(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const email = (formData.get("email") as string).trim();
  const password = formData.get("password") as string;
  const displayName = ((formData.get("displayName") as string) ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Upsert users row — handles the case where a confirmation-flow signup
    // triggers this action twice (once on submit, once on email confirm).
    const user = await prisma.user.upsert({
      where: { supabaseUid: data.user.id },
      create: {
        email,
        displayName: displayName || email.split("@")[0],
        supabaseUid: data.user.id,
        isMember: true,
        isArchived: false,
      },
      update: {}, // no-op on second pass
    });

    // Create metadata row (userId is the PK, so upsert is safe)
    await prisma.pgUserMetadata.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  revalidatePath("/", "layout");

  // If Supabase email confirmations are enabled, the user won't be signed in
  // yet — send them to a holding page; otherwise go straight to dashboard.
  if (data.session) {
    redirect("/dashboard");
  } else {
    redirect("/login?registered=1");
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
