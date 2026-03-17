import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/cache/redis";

/**
 * Rate limiting middleware.
 *
 * Only activated when Upstash Redis is configured (UPSTASH_REDIS_REST_URL / TOKEN).
 * In local dev without Redis credentials the middleware is a no-op pass-through.
 *
 * Limits applied:
 *  - Auth routes  (/api/auth, server actions)  → 10 req / 60s per IP
 *  - Public API   (/api/public/*)               → 20 req / 60s per IP
 *  - All other API routes                       → 60 req / 60s per IP
 */

// Lazy-built limiters (only if Redis is present)
let authLimiter:   Ratelimit | null = null;
let publicLimiter: Ratelimit | null = null;
let apiLimiter:    Ratelimit | null = null;

function getLimiters() {
  const redis = getRedis();
  if (!redis) return null;

  if (!authLimiter) {
    authLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "60 s"), prefix: "rl:auth" });
    publicLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60 s"), prefix: "rl:public" });
    apiLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "60 s"), prefix: "rl:api" });
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

function rateLimitResponse(retryAfter: number) {
  return new NextResponse(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets, images, Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const limiters = getLimiters();

  // No Redis → pass through
  if (!limiters) return NextResponse.next();

  const ip = getIp(req);

  try {
    let result;

    if (pathname.startsWith("/api/auth") || pathname === "/api/public/apply") {
      // Strictest limit for auth + application submission
      result = await limiters.authLimiter.limit(ip);
    } else if (pathname.startsWith("/api/public/")) {
      result = await limiters.publicLimiter.limit(ip);
    } else if (pathname.startsWith("/api/")) {
      result = await limiters.apiLimiter.limit(ip);
    } else {
      return NextResponse.next();
    }

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      return rateLimitResponse(retryAfter);
    }
  } catch {
    // Redis error → fail open (don't block legitimate traffic)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
