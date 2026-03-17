import { Redis } from "@upstash/redis";

/**
 * Upstash Redis client — serverless-compatible REST-based Redis.
 * Used for caching (replaces WP Transients).
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Cache helper — get or set with TTL.
 * Replaces `get_transient()` / `set_transient()` from WordPress.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const existing = await redis.get<T>(key);
  if (existing !== null && existing !== undefined) {
    return existing;
  }

  const fresh = await fetcher();
  await redis.set(key, fresh, { ex: ttlSeconds });
  return fresh;
}

/**
 * Invalidate a cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Invalidate all keys matching a pattern prefix.
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  let cursor: string | number = 0;
  do {
    const result: [string | number, string[]] = await redis.scan(cursor, {
      match: `${prefix}*`,
      count: 100,
    });
    cursor = result[0];
    const keys = result[1];
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== 0 && cursor !== "0");
}
