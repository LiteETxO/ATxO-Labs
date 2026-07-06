// ─── License key recovery handler ────────────────────────────────────
//
// Stack-agnostic core. Mounted by a thin adapter at POST /recover for
// whichever runtime we end up on (Next.js Route Handler, Cloudflare
// Worker, Hono, Express, etc). The adapter is responsible for parsing
// the request body and returning the response — this file owns the
// business logic.
//
// Wraps three concerns:
//   1. Email lookup against the license DB
//   2. Rate limiting (per-IP and per-email)
//   3. Email delivery via the same provider as the purchase email
//
// Behavior:
//   - Always returns 202 within the rate window (don't leak whether an
//     email is in our DB to enumeration probes).
//   - Throttled requests get 429.
//   - Malformed input gets 400.
//
// The dependencies (db, mailer, rateLimiter) are injected so this file
// runs offline in tests with mocks.

const RATE_LIMIT_PER_IP_PER_HOUR    = 5;
const RATE_LIMIT_PER_EMAIL_PER_HOUR = 3;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Handle a recovery request.
 *
 * @param {object} payload      — { email: string }
 * @param {object} ctx
 * @param {string} ctx.ip       — caller IP (for rate limiting)
 * @param {object} ctx.db       — { findKeysByEmail(email) -> Promise<Array<{key, productSku, issuedAt}>> }
 * @param {object} ctx.mailer   — { sendRecoveryEmail({to, keys, agentName?}) -> Promise<void> }
 * @param {object} ctx.rateLimiter
 *   - check(key, max, windowMs) -> Promise<{ allowed: boolean, retryAfterSec?: number }>
 * @param {Function} [ctx.now]  — () => Date (injectable for tests)
 *
 * @returns {Promise<{status: number, body: object}>}
 */
async function recoverHandler(payload, ctx) {
  const now = ctx.now ? ctx.now() : new Date();

  // ── Validate input ─────────────────────────────────────────────
  const emailRaw = (payload && payload.email) || '';
  const email = String(emailRaw).trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    return { status: 400, body: { error: 'Invalid email address.' } };
  }

  // ── Rate limit ─────────────────────────────────────────────────
  // Per-IP first (cheap to compute, catches generic abuse), then per-email
  // (catches targeted enumeration that rotates IPs).
  const ipCheck = await ctx.rateLimiter.check(
    `recover:ip:${ctx.ip}`,
    RATE_LIMIT_PER_IP_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!ipCheck.allowed) {
    return {
      status: 429,
      body: { error: 'Too many requests from this address. Try again later.' },
      headers: ipCheck.retryAfterSec ? { 'Retry-After': String(ipCheck.retryAfterSec) } : undefined,
    };
  }
  const emailCheck = await ctx.rateLimiter.check(
    `recover:email:${email}`,
    RATE_LIMIT_PER_EMAIL_PER_HOUR,
    60 * 60 * 1000,
  );
  if (!emailCheck.allowed) {
    return {
      status: 429,
      body: { error: 'Too many recovery requests for this email. Try again later.' },
      headers: emailCheck.retryAfterSec ? { 'Retry-After': String(emailCheck.retryAfterSec) } : undefined,
    };
  }

  // ── DB lookup ──────────────────────────────────────────────────
  let keys = [];
  try {
    keys = await ctx.db.findKeysByEmail(email);
  } catch (e) {
    // Don't leak DB internals; log via ctx.logger if provided.
    (ctx.logger || console).error('[recover] db lookup failed:', e?.message || e);
    return { status: 500, body: { error: 'Could not look up your account. Try again in a few minutes.' } };
  }

  // ── Send email (only if we found keys) ─────────────────────────
  // We deliberately return 202 in BOTH cases — found and not-found —
  // so a probe can't tell the difference between a real customer email
  // and a guess. The email is only sent when we have keys to send.
  if (keys && keys.length > 0) {
    try {
      await ctx.mailer.sendRecoveryEmail({ to: email, keys, sentAt: now });
    } catch (e) {
      (ctx.logger || console).error('[recover] email send failed:', e?.message || e);
      // Still return 202 to the caller — failed sends are an op problem,
      // not a customer error. Alerting is set up via the mailer's hooks.
    }
  } else {
    (ctx.logger || console).info('[recover] no keys for email (silent 202):', email);
  }

  return {
    status: 202,
    body: { message: "If we have a license on file for that email, we've sent it. Check your inbox." },
  };
}

module.exports = {
  recoverHandler,
  RATE_LIMIT_PER_IP_PER_HOUR,
  RATE_LIMIT_PER_EMAIL_PER_HOUR,
  EMAIL_REGEX,
};
