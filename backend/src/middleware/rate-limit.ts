import type { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();

  // Cleanup expired entries every 5 minutes (prevent memory leak)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
  // Don't hold process open
  if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    (cleanupInterval as NodeJS.Timeout).unref?.();
  }

  function cleanup() {
    if (store.size > 500) {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
          store.delete(key);
        }
      }
    }
  }

  return async function rateLimitMiddleware(c: Context, next: Next) {
    cleanup();

    const ip =
      c.req.header("x-forwarded-for") ||
      c.req.header("cf-connecting-ip") ||
      "unknown";

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + config.windowMs });
      c.header("X-RateLimit-Limit", String(config.maxRequests));
      c.header("X-RateLimit-Remaining", String(config.maxRequests - 1));
      return next();
    }

    if (entry.count >= config.maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfterSeconds));
      c.header("X-RateLimit-Limit", String(config.maxRequests));
      c.header("X-RateLimit-Remaining", "0");
      return c.json(
        {
          error: {
            message: "יותר מדי ניסיונות. נסה שוב מאוחר יותר.",
            code: "RATE_LIMIT_EXCEEDED",
          },
        },
        429
      );
    }

    entry.count++;
    c.header("X-RateLimit-Limit", String(config.maxRequests));
    c.header("X-RateLimit-Remaining", String(config.maxRequests - entry.count));
    return next();
  };
}

// 10 requests per 15 minutes per IP
export const authRateLimit = createRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
});

// 5 requests per hour per IP
export const resetRateLimit = createRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
});
