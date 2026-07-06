// ─── Rate limit adapter ──────────────────────────────────────────────
//
// Two implementations:
//
//   - memoryLimiter (default for dev) — fixed window, in-process. Safe for
//     local dev and for Vercel's preview deployments. NOT safe across
//     serverless instances in production.
//
//   - kvLimiter (when KV_REST_API_URL is set) — Vercel KV / Upstash Redis
//     fixed window. Multi-instance correct. Recommended for prod.
//
// Selected at module load via env: presence of KV_REST_API_URL flips on
// the KV path. Both expose the same `check()` interface that the
// recoverHandler depends on.

interface Limiter {
  check(key: string, max: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSec?: number }>;
}

// ─── In-memory ──────────────────────────────────────────────────────
function memoryLimiter(): Limiter {
  const buckets = new Map<string, number[]>();
  return {
    async check(key, max, windowMs) {
      const now = Date.now();
      const cutoff = now - windowMs;
      let entries = buckets.get(key) || [];
      entries = entries.filter(ts => ts >= cutoff);
      entries.push(now);
      buckets.set(key, entries);
      if (entries.length > max) {
        const oldest = entries[0];
        const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return { allowed: false, retryAfterSec };
      }
      return { allowed: true };
    },
  };
}

// ─── Vercel KV / Upstash ────────────────────────────────────────────
//
// Uses the @upstash/redis HTTP client which is what Vercel KV exposes.
// Avoids the synchronous Redis protocol so this works on Edge Runtime.
//
// We dynamically import @upstash/redis only when we know KV is configured;
// keeps it as an optional dep so dev installs don't pull it in.
async function kvLimiter(): Promise<Limiter> {
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({
    url:   process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
  return {
    async check(key, max, windowMs) {
      const winSec = Math.ceil(windowMs / 1000);
      const fullKey = `rl:${key}`;
      const count = await redis.incr(fullKey);
      if (count === 1) {
        await redis.expire(fullKey, winSec);
      }
      if (count > max) {
        const ttl = await redis.ttl(fullKey);
        return { allowed: false, retryAfterSec: ttl > 0 ? ttl : winSec };
      }
      return { allowed: true };
    },
  };
}

// Lazily instantiated. `getLimiter()` is async because the KV path
// dynamic-imports @upstash/redis only when configured.
let _limiterPromise: Promise<Limiter> | null = null;

export function getLimiter(): Promise<Limiter> {
  if (!_limiterPromise) {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      _limiterPromise = kvLimiter().catch(e => {
        console.warn('[rate-limit] KV init failed, falling back to memory:', e);
        return memoryLimiter();
      });
    } else {
      _limiterPromise = Promise.resolve(memoryLimiter());
    }
  }
  return _limiterPromise;
}
