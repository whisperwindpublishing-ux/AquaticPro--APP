import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/cache/redis";

// ─── Rate limiters (lazy, only when Redis is configured) ─────────────────────
let authLimiter:   Ratelimit | null = null;
let publicLimiter: Ratelimit | null = null;
let apiLimiter:    Ratelimit | null = null;

function getLimiters() {
  const redis = getRedis();
  if (!redis) return null;
  if (!authLimiter) {
    authLimiter   = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "60 s"), prefix: "rl:auth" });
    publicLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60 s"), prefix: "rl:public" });
    apiLimiter    = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "60 s"), prefix: "rl:api" });
  }
  return { authLimiter: authLimiter!, publicLimiter: publicLimiter!, apiLimiter: apiLimiter! };
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    const limiters = getLimiters();
    if (limiters) {
      const ip = getIp(request);
      try {
        let result;
        if (pathname.startsWith("/api/auth") || pathname === "/api/public/apply") {
          result = await limiters.authLimiter.limit(ip);
        } else if (pathname.startsWith("/api/public/")) {
          result = await limiters.publicLimiter.limit(ip);
        } else {
          result = await limiters.apiLimiter.limit(ip);
        }
        if (!result.success) {
          const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
          return new NextResponse(
            JSON.stringify({ error: "Too many requests. Please slow down." }),
            { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } }
          );
        }
      } catch {
        // Redis error → fail open
      }
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
