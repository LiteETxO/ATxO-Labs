// Tests for /api/validate business logic.
// Run: node --test validate-logic.test.js

const test   = require('node:test');
const assert = require('node:assert');

const { validateHandler } = require('./validate-logic');
const { memoryRateLimiter } = require('./rate-limit');

function makeCtx({ findResult, findThrows } = {}) {
  const calls = { findKeyByValue: [] };
  return {
    calls,
    ctx: {
      db: {
        findKeyByValue: async (key) => {
          calls.findKeyByValue.push(key);
          if (findThrows) throw findThrows;
          return findResult === undefined ? null : findResult;
        },
      },
      rateLimiter: memoryRateLimiter(),
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    },
  };
}

const ACTIVE_RECORD = {
  key: 'SELAM-AAAAA-BBBBB-CCCCC',
  email: 'mike@example.com',
  productSku: 'selam-v1',
  status: 'active',
  stripeSession: 'cs_test_xyz',
  issuedAt: '2026-04-30T12:00:00Z',
  revokedAt: null,
};

test('validate: missing key → 400', async () => {
  const { ctx, calls } = makeCtx();
  const r = await validateHandler({ key: '', ip: '1.2.3.4' }, ctx);
  assert.equal(r.status, 400);
  assert.equal(calls.findKeyByValue.length, 0);
});

test('validate: malformed key → 400', async () => {
  const { ctx, calls } = makeCtx();
  for (const bad of [
    'SELAM-AAAAA',
    'SELAM-AAAAA-BBBBB-CCCC',     // last segment 4 chars
    'WRONG-AAAAA-BBBBB-CCCCC',    // wrong prefix
    'selam-aaaaa-bbbbb-ccccc',    // case is normalised, this should pass actually
  ]) {
    const r = await validateHandler({ key: bad, ip: '1.2.3.4' }, ctx);
    if (bad.toLowerCase().startsWith('selam-aaaaa-bbbbb-ccccc')) {
      // case-normalisation path — KEY_PATTERN expects uppercase; we
      // upper-case before matching so this should pass to DB lookup
      assert.equal(r.status, 404, `expected 404 (uppercased + not in DB) for ${bad}`);
    } else {
      assert.equal(r.status, 400, `expected 400 for ${bad}`);
    }
  }
});

test('validate: active key found → 200 with productSku + issuedAt', async () => {
  const { ctx, calls } = makeCtx({ findResult: ACTIVE_RECORD });
  const r = await validateHandler(
    { key: 'SELAM-AAAAA-BBBBB-CCCCC', ip: '1.2.3.4' },
    ctx,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.productSku, 'selam-v1');
  assert.equal(r.body.issuedAt, '2026-04-30T12:00:00Z');
  // PII not echoed
  assert.equal(r.body.email, undefined);
  // Cache-Control set so CDNs don't serve stale validation
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(calls.findKeyByValue[0], 'SELAM-AAAAA-BBBBB-CCCCC');
});

test('validate: not found → 404', async () => {
  const { ctx } = makeCtx({ findResult: null });
  const r = await validateHandler(
    { key: 'SELAM-NOTHE-RENOT-HEREE', ip: '1.2.3.4' },
    ctx,
  );
  assert.equal(r.status, 404);
});

test('validate: revoked → 403', async () => {
  const { ctx } = makeCtx({
    findResult: { ...ACTIVE_RECORD, status: 'revoked' },
  });
  const r = await validateHandler(
    { key: 'SELAM-REVOK-EDREV-OKEDD', ip: '1.2.3.4' },
    ctx,
  );
  assert.equal(r.status, 403);
});

test('validate: db error → 500', async () => {
  const { ctx } = makeCtx({ findThrows: new Error('connection refused') });
  const r = await validateHandler(
    { key: 'SELAM-AAAAA-BBBBB-CCCCC', ip: '1.2.3.4' },
    ctx,
  );
  assert.equal(r.status, 500);
});

test('validate: rate limit at 60 per IP per min', async () => {
  const { ctx } = makeCtx({ findResult: ACTIVE_RECORD });
  for (let i = 0; i < 60; i++) {
    const r = await validateHandler(
      { key: 'SELAM-AAAAA-BBBBB-CCCCC', ip: '1.2.3.4' },
      ctx,
    );
    assert.equal(r.status, 200, `request ${i + 1} should succeed`);
  }
  const r61 = await validateHandler(
    { key: 'SELAM-AAAAA-BBBBB-CCCCC', ip: '1.2.3.4' },
    ctx,
  );
  assert.equal(r61.status, 429);
  assert.ok(r61.headers && r61.headers['Retry-After']);
});

test('validate: different IPs have independent rate limits', async () => {
  const { ctx } = makeCtx({ findResult: ACTIVE_RECORD });
  // Burn through rate limit on IP A
  for (let i = 0; i < 60; i++) {
    await validateHandler(
      { key: 'SELAM-AAAAA-BBBBB-CCCCC', ip: '1.1.1.1' },
      ctx,
    );
  }
  // IP B should still succeed
  const r = await validateHandler(
    { key: 'SELAM-AAAAA-BBBBB-CCCCC', ip: '2.2.2.2' },
    ctx,
  );
  assert.equal(r.status, 200);
});

test('validate: key gets uppercased before lookup', async () => {
  const { ctx, calls } = makeCtx({ findResult: ACTIVE_RECORD });
  await validateHandler(
    { key: 'selam-aaaaa-bbbbb-ccccc', ip: '1.2.3.4' },
    ctx,
  );
  assert.equal(calls.findKeyByValue[0], 'SELAM-AAAAA-BBBBB-CCCCC');
});

// ── Trial expiry (v4) ────────────────────────────────────────────────

test('validate: trial key before expiry → 200 with expiresAt', async () => {
  const future = new Date(Date.now() + 10 * 86400e3).toISOString();
  const { ctx } = makeCtx({ findResult: { ...ACTIVE_RECORD, purchaseType: 'trial', expiresAt: future } });
  const r = await validateHandler({ key: ACTIVE_RECORD.key, ip: '1.2.3.4' }, ctx);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.purchaseType, 'trial');
  assert.equal(r.body.expiresAt, future);
});

test('validate: trial key past expiry → 403 code=expired', async () => {
  const past = new Date(Date.now() - 86400e3).toISOString();
  const { ctx } = makeCtx({ findResult: { ...ACTIVE_RECORD, purchaseType: 'trial', expiresAt: past } });
  const r = await validateHandler({ key: ACTIVE_RECORD.key, ip: '1.2.3.4' }, ctx);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'expired');
  assert.equal(r.body.expiresAt, past);
});

test('validate: perpetual key (no expiresAt) stays valid', async () => {
  const { ctx } = makeCtx({ findResult: { ...ACTIVE_RECORD, purchaseType: 'perpetual', expiresAt: null } });
  const r = await validateHandler({ key: ACTIVE_RECORD.key, ip: '1.2.3.4' }, ctx);
  assert.equal(r.status, 200);
  assert.equal(r.body.purchaseType, 'perpetual');
  assert.equal(r.body.expiresAt, null);
});

test('validate: revoked beats expired (revoked checked first)', async () => {
  const past = new Date(Date.now() - 86400e3).toISOString();
  const { ctx } = makeCtx({ findResult: { ...ACTIVE_RECORD, status: 'revoked', purchaseType: 'trial', expiresAt: past } });
  const r = await validateHandler({ key: ACTIVE_RECORD.key, ip: '1.2.3.4' }, ctx);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'revoked');
});
