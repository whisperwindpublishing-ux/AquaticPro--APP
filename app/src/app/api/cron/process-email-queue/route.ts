/**
 * Cron: Process Email Queue
 * Replaces WordPress cron job for queued email sending.
 * Triggered by Vercel Cron — see vercel.json
 */

import { ok, serverError } from "@/lib/utils/api-helpers";

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (not public)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // TODO Phase 5: implement email queue processing
    // Query queued emails from DB, send via Resend, mark as sent
    return ok({ processed: 0, message: "Email queue cron stub — not yet implemented" });
  } catch (error) {
    return serverError(error);
  }
}
