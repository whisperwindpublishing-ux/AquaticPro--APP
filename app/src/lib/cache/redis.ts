import { Redis } from "@upstash/redis";

/**
 * Whether Upstash Redis is actually configured (not a placeholder).
 * Allows the app to run without Redis in local dev.
 */
function isRedisConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  return (
    url.length > 0 &&
    !url.includes("YOUR_REDIS") &&
    token.length > 0 &&
    token !== "your-redis-token"
  );
}

/**
 * Upstash Redis client — only instantiated when credentials are present.
 * Used for caching (replaces WP Transients).
 */
let _redis: Redis | null | undefined;

/** Returns the Redis client, or null if Redis is not configured. */
export function getRedis(): Redis | null {
  if (_redis === undefined) {
    if (!isRedisConfigured()) {
      _redis = null;
    } else {
      _redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    }
  }
  return _redis;
}

/**
 * Cache helper — get or set with TTL.
 * Falls back to calling the fetcher directly when Redis is not configured.
 * Replaces `get_transient()` / `set_transient()` from WordPress.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const client = getRedis();

  if (!client) {
    // Redis not configured — bypass cache in local dev
    return fetcher();
  }

  try {
    const existing = await client.get<T>(key);
    if (existing !== null && existing !== undefined) {
      return existing;
    }

    const fresh = await fetcher();
    await client.set(key, fresh, { ex: ttlSeconds });
    return fresh;
  } catch {
    // Redis unreachable — fall back to direct fetch rather than crashing
    return fetcher();
  }
}

/**
 * Invalidate a cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.del(key);
}

/**
 * Invalidate all keys matching a pattern prefix.
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  let cursor: string | number = 0;
  do {
    const result: [string | number, string[]] = await client.scan(cursor, {
      match: `${prefix}*`,
      count: 100,
    });
    cursor = result[0];
    const keys = result[1];
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } while (cursor !== 0 && cursor !== "0");
}
