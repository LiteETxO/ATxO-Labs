// Tests for the Stripe webhook business logic.
// Run: node --test webhook-logic.test.js

const test   = require('node:test');
const assert = require('node:assert');

const { processCheckoutCompleted, processChargeRefunded, mintLicenseKey, pickPurchaseVariant } = require('./webhook-logic');

// ── Test fixtures ─────────────────────────────────────────────────

function fakeSession(overrides = {}) {
  return {
    id: 'cs_test_a1b2c3d4',
    customer_details: { email: 'mike@example.com' },
    metadata: { product: 'selam-v1' },
    ...overrides,
  };
}

function fakeCharge(overrides = {}) {
  return {
    id: 'ch_test_xyz',
    payment_intent: 'pi_test_abc',
    metadata: { checkout_session_id: 'cs_test_a1b2c3d4' },
    ...overrides,
  };
}

function makeCtx({ insertResult, insertThrows, mailerThrows, revokeResult, revokeThrows } = {}) {
  const calls = { insertLicense: [], sendPurchaseEmail: [], revokeLicenseByStripeSession: [] };
  return {
    calls,
    ctx: {
      db: {
        insertLicense: async (key, email, sku, sess, tier) => {
          calls.insertLicense.push({ key, email, sku, sess, tier });
          if (insertThrows) throw insertThrows;
          return insertResult || { key, email, productSku: sku, status: 'active', stripeSession: sess, tier };
        },
        revokeLicenseByStripeSession: async (sessionId) => {
          calls.revokeLicenseByStripeSession.push(sessionId);
          if (revokeThrows) throw revokeThrows;
          return revokeResult === undefined ? { key: 'SELAM-X', email: 'm@e.com' } : revokeResult;
        },
      },
      mailer: {
        sendPurchaseEmail: async (msg) => {
          calls.sendPurchaseEmail.push(msg);
          if (mailerThrows) throw mailerThrows;
        },
      },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      // Deterministic key for assertions
      mintKey: () => 'SELAM-AAAAA-BBBBB-CCCCC',
    },
  };
}

// ── mintLicenseKey ───────────────────────────────────────────────

test('mintLicenseKey: matches SELAM-XXXXX-XXXXX-XXXXX format', () => {
  const key = mintLicenseKey();
  assert.match(key, /^SELAM-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
});

test('mintLicenseKey: avoids ambiguous characters (no O/0/I/1)', () => {
  // Run 100 times; with 32-char alphabet the probability of an
  // ambiguous char appearing in any output is zero — this is testing
  // the alphabet itself.
  for (let i = 0; i < 100; i++) {
    const key = mintLicenseKey();
    assert.ok(!/[O01I]/.test(key.slice(6)), `key ${key} contained ambiguous char`);
  }
});

test('mintLicenseKey: deterministic with injected RNG', () => {
  // RNG that returns sequential bytes — gives a predictable output
  const seq = (n) => Uint8Array.from({ length: n }, (_, i) => i);
  const key = mintLicenseKey(seq);
  // ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  // bytes 0..14 mod 32 = 0..14 → "ABCDEFGHJKLMNPQ"
  assert.equal(key, 'SELAM-ABCDE-FGHJK-LMNPQ');
});

// ── checkout.session.completed ───────────────────────────────────

test('checkout: success → inserts license + sends purchase email', async () => {
  const { ctx, calls } = makeCtx();
  const r = await processCheckoutCompleted(fakeSession(), ctx);

  assert.equal(r.status, 'ok');
  assert.equal(r.body.key, 'SELAM-AAAAA-BBBBB-CCCCC');
  assert.equal(r.body.sessionId, 'cs_test_a1b2c3d4');
  assert.ok(r.body.variant === 'a' || r.body.variant === 'b');

  assert.equal(calls.insertLicense.length, 1);
  assert.deepEqual(calls.insertLicense[0], {
    key: 'SELAM-AAAAA-BBBBB-CCCCC',
    email: 'mike@example.com',
    sku: 'selam-v1',
    sess: 'cs_test_a1b2c3d4',
    tier: 'founder',
  });

  assert.equal(calls.sendPurchaseEmail.length, 1);
  assert.equal(calls.sendPurchaseEmail[0].to, 'mike@example.com');
  assert.equal(calls.sendPurchaseEmail[0].key, 'SELAM-AAAAA-BBBBB-CCCCC');
  // Variant flows from webhook → mailer
  assert.equal(calls.sendPurchaseEmail[0].variant, r.body.variant);
});

test('checkout: missing email → error, no retry, no insert', async () => {
  const { ctx, calls } = makeCtx();
  const r = await processCheckoutCompleted(
    fakeSession({ customer_details: { email: '' }, customer_email: undefined }),
    ctx,
  );
  assert.equal(r.status, 'error');
  assert.equal(r.retry, false);
  assert.equal(calls.insertLicense.length, 0);
  assert.equal(calls.sendPurchaseEmail.length, 0);
});

test('checkout: missing session id → error, no retry', async () => {
  const { ctx, calls } = makeCtx();
  const r = await processCheckoutCompleted(fakeSession({ id: '' }), ctx);
  assert.equal(r.status, 'error');
  assert.equal(r.retry, false);
  assert.equal(calls.insertLicense.length, 0);
});

test('checkout: email lowercased before insert', async () => {
  const { ctx, calls } = makeCtx();
  await processCheckoutCompleted(
    fakeSession({ customer_details: { email: 'MIKE@example.COM' } }),
    ctx,
  );
  assert.equal(calls.insertLicense[0].email, 'mike@example.com');
});

test('checkout: falls back to customer_email if customer_details.email missing', async () => {
  const { ctx, calls } = makeCtx();
  await processCheckoutCompleted(
    fakeSession({ customer_details: undefined, customer_email: 'fallback@example.com' }),
    ctx,
  );
  assert.equal(calls.insertLicense[0].email, 'fallback@example.com');
});

test('checkout: custom product SKU honored', async () => {
  const { ctx, calls } = makeCtx();
  await processCheckoutCompleted(
    fakeSession({ metadata: { product: 'selam-business' } }),
    ctx,
  );
  assert.equal(calls.insertLicense[0].sku, 'selam-business');
});

test('checkout: metadata.tier=standard mints a standard license', async () => {
  const { ctx, calls } = makeCtx();
  await processCheckoutCompleted(
    fakeSession({ metadata: { product: 'selam-v1', tier: 'standard' } }),
    ctx,
  );
  assert.equal(calls.insertLicense[0].tier, 'standard');
});

test('checkout: missing or unknown metadata.tier defaults to founder', async () => {
  const { ctx, calls } = makeCtx();
  await processCheckoutCompleted(fakeSession({ metadata: {} }), ctx);
  assert.equal(calls.insertLicense[0].tier, 'founder');

  await processCheckoutCompleted(
    fakeSession({ id: 'cs_test_other', metadata: { tier: 'platinum' } }),
    ctx,
  );
  assert.equal(calls.insertLicense[1].tier, 'founder');
});

test('checkout: defaults SKU to selam-v1 if metadata.product missing', async () => {
  const { ctx, calls } = makeCtx();
  await processCheckoutCompleted(fakeSession({ metadata: {} }), ctx);
  assert.equal(calls.insertLicense[0].sku, 'selam-v1');
});

test('checkout: DB insert failure → retry=true, no email sent', async () => {
  const { ctx, calls } = makeCtx({ insertThrows: new Error('connection refused') });
  const r = await processCheckoutCompleted(fakeSession(), ctx);
  assert.equal(r.status, 'error');
  assert.equal(r.retry, true);
  assert.equal(calls.sendPurchaseEmail.length, 0);
});

test('checkout: mailer failure → still ok (logged, no retry)', async () => {
  // Email failures should NEVER trigger a Stripe retry — that would
  // double-mint a key. Better to silently succeed and re-send manually.
  const { ctx, calls } = makeCtx({ mailerThrows: new Error('Resend down') });
  const r = await processCheckoutCompleted(fakeSession(), ctx);
  assert.equal(r.status, 'ok');
  assert.equal(calls.insertLicense.length, 1);
  assert.equal(calls.sendPurchaseEmail.length, 1); // attempted, threw
});

test('checkout: idempotent insert — duplicate webhook delivery returns same record', async () => {
  // The DB layer's ON CONFLICT (stripe_session) makes this idempotent;
  // the webhook handler doesn't have to do anything special. We just
  // verify it doesn't crash + returns ok on the second call.
  const existingRecord = {
    key: 'SELAM-EXIST-INGGG-KEYYY',
    email: 'mike@example.com',
    productSku: 'selam-v1',
    status: 'active',
    stripeSession: 'cs_test_a1b2c3d4',
  };
  const { ctx } = makeCtx({ insertResult: existingRecord });
  const r = await processCheckoutCompleted(fakeSession(), ctx);
  assert.equal(r.status, 'ok');
  // The returned key matches what the DB returned (not what we minted —
  // because of ON CONFLICT, the DB returns the existing record).
  assert.equal(r.body.key, 'SELAM-EXIST-INGGG-KEYYY');
});


// ── A/B variant selection ─────────────────────────────────────────

test('pickPurchaseVariant: deterministic — same session always same variant', () => {
  const a = pickPurchaseVariant('cs_test_a1b2c3d4');
  const b = pickPurchaseVariant('cs_test_a1b2c3d4');
  const c = pickPurchaseVariant('cs_test_a1b2c3d4');
  assert.equal(a, b);
  assert.equal(b, c);
  assert.ok(a === 'a' || a === 'b');
});

test('pickPurchaseVariant: different sessions produce both variants over a sample', () => {
  // 1000 random session ids → expect both 'a' and 'b' to appear, and
  // each to be reasonably close to half (loose bounds — this is a
  // sanity check, not a chi-squared test).
  let aCount = 0, bCount = 0;
  for (let i = 0; i < 1000; i++) {
    const sess = `cs_test_${Math.random().toString(36).slice(2)}_${i}`;
    const v = pickPurchaseVariant(sess);
    if (v === 'a') aCount++; else bCount++;
  }
  assert.ok(aCount > 350 && aCount < 650, `a=${aCount}/1000 — split should be roughly even`);
  assert.ok(bCount > 350 && bCount < 650, `b=${bCount}/1000 — split should be roughly even`);
});

test('pickPurchaseVariant: PURCHASE_EMAIL_VARIANT=a forces variant a', () => {
  const prev = process.env.PURCHASE_EMAIL_VARIANT;
  try {
    process.env.PURCHASE_EMAIL_VARIANT = 'a';
    assert.equal(pickPurchaseVariant('cs_anything'), 'a');
    assert.equal(pickPurchaseVariant('cs_else'),     'a');
  } finally {
    if (prev === undefined) delete process.env.PURCHASE_EMAIL_VARIANT;
    else process.env.PURCHASE_EMAIL_VARIANT = prev;
  }
});

test('pickPurchaseVariant: PURCHASE_EMAIL_VARIANT=B (uppercase) forces variant b', () => {
  const prev = process.env.PURCHASE_EMAIL_VARIANT;
  try {
    process.env.PURCHASE_EMAIL_VARIANT = 'B';
    assert.equal(pickPurchaseVariant('cs_anything'), 'b');
  } finally {
    if (prev === undefined) delete process.env.PURCHASE_EMAIL_VARIANT;
    else process.env.PURCHASE_EMAIL_VARIANT = prev;
  }
});

test('pickPurchaseVariant: invalid override falls back to deterministic hash', () => {
  const prev = process.env.PURCHASE_EMAIL_VARIANT;
  try {
    process.env.PURCHASE_EMAIL_VARIANT = 'garbage';
    const v1 = pickPurchaseVariant('cs_xyz');
    const v2 = pickPurchaseVariant('cs_xyz');
    assert.equal(v1, v2);
    assert.ok(v1 === 'a' || v1 === 'b');
  } finally {
    if (prev === undefined) delete process.env.PURCHASE_EMAIL_VARIANT;
    else process.env.PURCHASE_EMAIL_VARIANT = prev;
  }
});

// ── charge.refunded ──────────────────────────────────────────────

test('refund: with checkout_session_id metadata → revokes license', async () => {
  const { ctx, calls } = makeCtx();
  const r = await processChargeRefunded(fakeCharge(), ctx);
  assert.equal(r.status, 'ok');
  assert.equal(calls.revokeLicenseByStripeSession.length, 1);
  assert.equal(calls.revokeLicenseByStripeSession[0], 'cs_test_a1b2c3d4');
  assert.equal(r.body.revoked, 'SELAM-X');
});

test('refund: falls back to payment_intent if no metadata', async () => {
  const { ctx, calls } = makeCtx();
  const r = await processChargeRefunded(
    fakeCharge({ metadata: {}, payment_intent: 'pi_fallback' }),
    ctx,
  );
  assert.equal(r.status, 'ok');
  assert.equal(calls.revokeLicenseByStripeSession[0], 'pi_fallback');
});

test('refund: no session reference → ok with note, no revoke', async () => {
  const { ctx, calls } = makeCtx();
  const r = await processChargeRefunded(
    fakeCharge({ metadata: {}, payment_intent: null }),
    ctx,
  );
  assert.equal(r.status, 'ok');
  assert.equal(calls.revokeLicenseByStripeSession.length, 0);
  assert.match(r.body.note, /no session ref/);
});

test('refund: no matching active license → ok with note, no error', async () => {
  // E.g. already revoked, or manual key with synthetic stripe_session.
  const { ctx } = makeCtx({ revokeResult: null });
  const r = await processChargeRefunded(fakeCharge(), ctx);
  assert.equal(r.status, 'ok');
  assert.match(r.body.note, /no active license/);
});

test('refund: DB error → retry=true', async () => {
  const { ctx } = makeCtx({ revokeThrows: new Error('lock timeout') });
  const r = await processChargeRefunded(fakeCharge(), ctx);
  assert.equal(r.status, 'error');
  assert.equal(r.retry, true);
});
