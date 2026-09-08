// ─── License validation business logic ───────────────────────────────
//
// Pure handler extracted from src/app/api/validate/route.ts for testability.
// Inputs are normalised; no Next.js or @vercel/postgres imports.
//
// Returns: { status: number, body: object, headers?: object }

const KEY_PATTERN = /^SELAM-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
const MAX_PER_IP_PER_MIN = 60;

async function validateHandler({ key: rawKey, ip }, ctx) {
  const key = String(rawKey || '').trim().toUpperCase();
  if (!key || !KEY_PATTERN.test(key)) {
    return { status: 400, body: { error: 'Invalid license key format.' } };
  }

  const limCheck = await ctx.rateLimiter.check(`validate:ip:${ip}`, MAX_PER_IP_PER_MIN, 60 * 1000);
  if (!limCheck.allowed) {
    return {
      status: 429,
      body: { error: 'Too many requests. Try again shortly.' },
      headers: limCheck.retryAfterSec ? { 'Retry-After': String(limCheck.retryAfterSec) } : undefined,
    };
  }

  let record;
  try {
    record = await ctx.db.findKeyByValue(key);
  } catch (e) {
    (ctx.logger || console).error('[validate] db error:', e?.message || e);
    return { status: 500, body: { error: 'Validation server error.' } };
  }

  if (!record) {
    return { status: 404, body: { error: 'License not found.' } };
  }
  if (record.status === 'revoked') {
    return { status: 403, body: { error: 'License revoked.', code: 'revoked' } };
  }

  // Trial expiry — a trial key past its expires_at is rejected with a
  // distinct code so the app can show "trial ended — own it for $89"
  // instead of "revoked".
  if (record.expiresAt) {
    const expiresMs = Date.parse(record.expiresAt);
    const nowMs = ctx.now ? ctx.now() : Date.now();
    if (Number.isFinite(expiresMs) && nowMs >= expiresMs) {
      return {
        status: 403,
        body: {
          error: 'Trial expired. Own Selam forever for $89 more (your $10 is credited) at https://api.heyselam.app/buy',
          code: 'expired',
          expiresAt: record.expiresAt,
          purchaseType: record.purchaseType || 'trial',
        },
      };
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      productSku: record.productSku,
      issuedAt:   record.issuedAt,
      purchaseType: record.purchaseType || 'perpetual',
      expiresAt: record.expiresAt || null,
    },
    headers: { 'Cache-Control': 'no-store' },
  };
}

module.exports = {
  validateHandler,
  KEY_PATTERN,
  MAX_PER_IP_PER_MIN,
};
