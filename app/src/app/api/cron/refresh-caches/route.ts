/**
 * Cron: Refresh Caches
 * Invalidates stale Redis cache keys every hour.
 * Triggered by Vercel Cron — see vercel.json.
 *
 * Patterns cleared:
 *   weather:*  — 30-min weather data (let it re-fetch on next request)
 *   users:*    — user directory listing
 *   roles:*    — job roles list
 */

import { invalidateCachePrefix } from "@/lib/cache/redis";
import { ok, serverError } from "@/lib/utils/api-helpers";

const PREFIXES = ["weather:", "users:", "roles:"];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const results: Record<string, string> = {};

    for (const prefix of PREFIXES) {
      try {
        await invalidateCachePrefix(prefix);
        results[prefix] = "cleared";
      } catch (err) {
        console.warn(`[CacheRefresh] Failed to clear prefix "${prefix}":`, err);
        results[prefix] = "error";
      }
    }

    return ok({ cleared: results, timestamp: new Date().toISOString() });
  } catch (error) {
    return serverError(error);
  }
}
