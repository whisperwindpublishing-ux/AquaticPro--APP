/**
 * Cron: Refresh Caches
 * Clears and warms Redis caches on a schedule.
 * Triggered by Vercel Cron — see vercel.json
 */

import { ok, serverError } from "@/lib/utils/api-helpers";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // TODO Phase 5: invalidate stale cache keys
    return ok({ message: "Cache refresh cron stub — not yet implemented" });
  } catch (error) {
    return serverError(error);
  }
}
