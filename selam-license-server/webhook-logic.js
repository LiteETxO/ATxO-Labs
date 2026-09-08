// ─── Stripe webhook business logic ───────────────────────────────────
//
// Pure functions extracted from src/app/api/stripe/webhook/route.ts for
// testability. The route file owns:
//   - Stripe signature verification
//   - HTTP response shape
//
// This file owns:
//   - License key generation
//   - DB insertion (via injected ctx.db)
//   - Email delivery (via injected ctx.mailer)
//   - Error handling that maps to "should we ask Stripe to retry?"
//
// Returns: { status: 'ok' | 'error', retry?: boolean, body?: object }
//   retry=true  → caller should respond 5xx so Stripe retries
//   retry=false → caller should respond 2xx (we acked but couldn't proceed)

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no O/0/I/1

// ── A/B variant selection for the purchase email ──────────────────
//
// Deterministic so a re-delivered webhook never flips the variant on the
// same buyer. Even split (~50/50) over a large sample because we hash
// the full session id which has high entropy.
//
// `force` env override (PURCHASE_EMAIL_VARIANT=a|b) lets us pin a variant
// during a holdout period or roll back without a deploy.
function pickPurchaseVariant(stripeSession) {
  const forced = (process.env.PURCHASE_EMAIL_VARIANT || '').toLowerCase();
  if (forced === 'a' || forced === 'b') return forced;
  // FNV-1a 32-bit hash, mod 2 — small + dependency-free + adequate for split.
  let h = 0x811c9dc5;
  const s = String(stripeSession || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return (h & 1) === 0 ? 'a' : 'b';
}

// Crypto-strong key generation. SELAM-XXXXX-XXXXX-XXXXX, 32^15 ≈ 4×10^22 keyspace.
function mintLicenseKey(rng) {
  const random = rng || _defaultRng;
  const bytes = random(15);
  const chars = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]);
  return `SELAM-${chars.slice(0, 5).join('')}-${chars.slice(5, 10).join('')}-${chars.slice(10, 15).join('')}`;
}

function _defaultRng(n) {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

// ── checkout.session.completed ─────────────────────────────────────
//
// Inputs:
//   session — Stripe Checkout Session object (we read customer_details,
//             id, metadata.product)
//   ctx.db.insertLicense(key, email, productSku, stripeSession) → record
//   ctx.mailer.sendPurchaseEmail({ to, key, productSku }) → void
//   ctx.mintKey — optional override for testing (defaults to mintLicenseKey)
//   ctx.logger
//
// Behavior:
//   - Missing email → return error, don't retry (Stripe won't fix this)
//   - DB insert fails → retry (likely transient)
//   - Email send fails → ack ok (don't retry; we've got the license, mailer
//     issues are tracked separately via Resend dashboards/webhooks)
//   - Idempotency: insertLicense uses ON CONFLICT (stripe_session) so a
//     duplicate webhook delivery returns the SAME record. We send the
//     email once on successful insert; if Stripe re-delivers after a
//     successful processing, the email goes again. That's a known minor
//     duplicate-email risk; preferable to dropping the email.

async function processCheckoutCompleted(session, ctx) {
  const log = ctx.logger || console;
  const email = (session?.customer_details?.email
              || session?.customer_email
              || '').toLowerCase();
  const stripeSession = session?.id || '';
  const productSku    = session?.metadata?.product || 'selam-v1';
  // Tier is stamped on the session by /api/checkout/session at creation
  // time — the buyer gets the tier they were shown and charged for, even
  // if the cap flips between checkout start and webhook delivery.
  // Sessions without the stamp predate the cap → founder ($199 lifetime
  // promise).
  const tier = session?.metadata?.tier === 'standard' ? 'standard' : 'founder';
  // Purchase type is stamped by /api/checkout/session. Older sessions have
  // no stamp → perpetual (they were sold as such).
  const rawType = session?.metadata?.purchase_type;
  const purchaseType = rawType === 'trial' || rawType === 'update_pass' ? rawType : 'perpetual';

  // Update-pass is an updates entitlement (subscription), not a Selam key —
  // don't mint a license for it. Ack so Stripe doesn't retry.
  if (purchaseType === 'update_pass') {
    log.info('[webhook] update-pass checkout — no license minted', stripeSession);
    return { status: 'ok', body: { updatePass: true, sessionId: stripeSession } };
  }

  // Trials expire 30 days after purchase; /api/validate enforces it.
  const TRIAL_DAYS = 30;
  const expiresAt = purchaseType === 'trial'
    ? new Date((ctx.now ? ctx.now() : Date.now()) + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null;

  if (!email) {
    log.error('[webhook] checkout.session.completed: no email on session', stripeSession);
    return {
      status: 'error',
      retry:  false,
      body:   { error: 'Missing customer email.', sessionId: stripeSession },
    };
  }
  if (!stripeSession) {
    log.error('[webhook] checkout.session.completed: no session id');
    return {
      status: 'error',
      retry:  false,
      body:   { error: 'Missing session id.' },
    };
  }

  const key = (ctx.mintKey || mintLicenseKey)();
  let record;
  try {
    record = await ctx.db.insertLicense(key, email, productSku, stripeSession, tier, purchaseType, expiresAt);
  } catch (e) {
    log.error('[webhook] insertLicense failed:', e?.message || e);
    return {
      status: 'error',
      retry:  true,
      body:   { error: 'DB insert failed; will retry.' },
    };
  }

  const variant = pickPurchaseVariant(stripeSession);
  log.info?.('[webhook] purchase email variant:', variant, 'for', stripeSession);

  try {
    await ctx.mailer.sendPurchaseEmail({
      to: email,
      purchaseType,
      expiresAt,
      key: record.key,
      productSku: record.productSku,
      variant,
    });
  } catch (e) {
    log.warn('[webhook] purchase email failed (non-fatal):', e?.message || e);
    // Don't trigger retry — duplicate email is worse than missed email
    // we can resend manually.
  }

  return {
    status: 'ok',
    body: { received: true, key: record.key, sessionId: stripeSession, variant },
  };
}

// ── charge.refunded ────────────────────────────────────────────────
//
// Inputs:
//   charge — Stripe Charge object
//   ctx.db.revokeLicenseByStripeSession(sessionId) → record | null
//   ctx.logger
//
// Behavior:
//   - Only a FULL refund revokes (charge.refunded === true). Stripe fires
//     this event on partial refunds too; a goodwill partial credit must
//     not kill the buyer's key.
//   - The DB stores cs_… checkout-session ids, and charge objects don't
//     carry one: charge.metadata comes from the PaymentIntent (which we
//     don't stamp), and charge.payment_intent is a pi_… id that can never
//     match the stripe_session column. So the session id is resolved via
//     ctx.stripe.findSessionIdByPaymentIntent (Stripe: which checkout
//     session owns this payment_intent?).
//   - Lookup failure → retry (5xx): a refund must not silently leave the
//     license active.
//   - No session found → ack with a warning (manual key, or a charge that
//     didn't come from Checkout).

async function processChargeRefunded(charge, ctx) {
  const log = ctx.logger || console;

  if (charge?.refunded !== true) {
    log.info?.('[webhook] charge.refunded: partial refund, license kept', charge?.id);
    return { status: 'ok', body: { received: true, note: 'partial refund; license kept' } };
  }

  // Accept a stamped session id if a future flow adds one, but never let
  // a non-cs_ value reach the revoke query.
  let sessionId = charge?.metadata?.checkout_session_id || null;
  if (sessionId && !String(sessionId).startsWith('cs_')) sessionId = null;

  if (!sessionId && charge?.payment_intent && ctx.stripe?.findSessionIdByPaymentIntent) {
    try {
      sessionId = await ctx.stripe.findSessionIdByPaymentIntent(String(charge.payment_intent));
    } catch (e) {
      log.error('[webhook] charge.refunded: session lookup failed:', e?.message || e);
      return {
        status: 'error',
        retry:  true,
        body:   { error: 'Could not resolve checkout session; will retry.' },
      };
    }
  }

  if (!sessionId) {
    log.warn('[webhook] charge.refunded: no checkout-session reference', charge?.id);
    return { status: 'ok', body: { received: true, note: 'no session ref' } };
  }
  try {
    const revoked = await ctx.db.revokeLicenseByStripeSession(String(sessionId));
    if (revoked) {
      log.info('[webhook] revoked license for refund:', revoked.key);
      return { status: 'ok', body: { received: true, revoked: revoked.key } };
    }
    log.warn('[webhook] charge.refunded: no matching active license for', sessionId);
    return { status: 'ok', body: { received: true, note: 'no active license matched' } };
  } catch (e) {
    log.error('[webhook] revokeLicenseByStripeSession failed:', e?.message || e);
    return {
      status: 'error',
      retry:  true,
      body:   { error: 'DB update failed; will retry.' },
    };
  }
}

module.exports = {
  mintLicenseKey,
  processCheckoutCompleted,
  processChargeRefunded,
  pickPurchaseVariant,
  ALPHABET,
};
