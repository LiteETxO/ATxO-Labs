// ─── Rate limiter ────────────────────────────────────────────────────
//
// Two implementations:
//
//   memoryRateLimiter() — single-process, in-memory. Safe for dev and for
//                         single-instance deployments (DO VPS with one
//                         PM2 worker, single-region Cloudflare worker
//                         with no replicas).
//
//   redisRateLimiter(client) — distributed, suitable for multi-instance
//                              deployments. Caller passes a Redis-like
//                              client with INCR + EXPIRE.
//
// Both expose the same `check(key, max, windowMs)` interface that
// recoverHandler depends on.

function memoryRateLimiter() {
  // bucket: key -> [{ ts: ms, count: n }]
  const buckets = new Map();

  return {
    async check(key, max, windowMs, now = Date.now()) {
      const cutoff = now - windowMs;
      let entries = buckets.get(key) || [];
      entries = entries.filter(e => e.ts >= cutoff);
      entries.push({ ts: now });
      buckets.set(key, entries);

      if (entries.length > max) {
        const oldest = entries[0].ts;
        const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return { allowed: false, retryAfterSec };
      }
      return { allowed: true };
    },
    // Test-only — clear all buckets
    _reset() { buckets.clear(); },
  };
}

// Redis flavor. Uses a fixed-window counter via INCR + EXPIRE.
// `client` is any object with `.incr(key)` and `.expire(key, sec)` —
// works with `ioredis`, `redis`, and `@upstash/redis`.
function redisRateLimiter(client) {
  return {
    async check(key, max, windowMs) {
      const winSec = Math.ceil(windowMs / 1000);
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, winSec);
      }
      if (count > max) {
        // Approximate retry-after — could refine via TTL lookup
        return { allowed: false, retryAfterSec: winSec };
      }
      return { allowed: true };
    },
  };
}

module.exports = { memoryRateLimiter, redisRateLimiter };
