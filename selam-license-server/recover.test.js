// Unit tests for the recover handler.
// Run: node --test license-server/

const test   = require('node:test');
const assert = require('node:assert');

const { recoverHandler } = require('./recover');
const { memoryRateLimiter } = require('./rate-limit');

function makeCtx({ ip = '1.2.3.4', dbResult = [], dbThrows = null, mailerThrows = null } = {}) {
  const calls = { findKeysByEmail: [], sendRecoveryEmail: [] };
  const ctx = {
    ip,
    db: {
      findKeysByEmail: async (email) => {
        calls.findKeysByEmail.push(email);
        if (dbThrows) throw dbThrows;
        return dbResult;
      },
    },
    mailer: {
      sendRecoveryEmail: async (msg) => {
        calls.sendRecoveryEmail.push(msg);
        if (mailerThrows) throw mailerThrows;
      },
    },
    rateLimiter: memoryRateLimiter(),
    logger: { info: () => {}, error: () => {}, warn: () => {} },
  };
  return { ctx, calls };
}

test('recover: missing email → 400', async () => {
  const { ctx, calls } = makeCtx();
  const r = await recoverHandler({}, ctx);
  assert.equal(r.status, 400);
  assert.equal(calls.findKeysByEmail.length, 0);
});

test('recover: malformed email → 400', async () => {
  const { ctx } = makeCtx();
  for (const bad of ['not-an-email', 'missing@tld', '@example.com', 'space @x.com']) {
    const r = await recoverHandler({ email: bad }, ctx);
    assert.equal(r.status, 400, `expected 400 for ${bad}`);
  }
});

test('recover: valid email + key found → 202 + email sent', async () => {
  const { ctx, calls } = makeCtx({
    dbResult: [{ key: 'SELAM-AAAAA-BBBBB-CCCCC', productSku: 'selam-v1' }],
  });
  const r = await recoverHandler({ email: 'mike@example.com' }, ctx);
  assert.equal(r.status, 202);
  assert.equal(calls.findKeysByEmail.length, 1);
  assert.equal(calls.findKeysByEmail[0], 'mike@example.com');
  assert.equal(calls.sendRecoveryEmail.length, 1);
  assert.equal(calls.sendRecoveryEmail[0].to, 'mike@example.com');
  assert.deepEqual(calls.sendRecoveryEmail[0].keys[0].key, 'SELAM-AAAAA-BBBBB-CCCCC');
});

test('recover: valid email + NO keys → 202 + no email sent (enumeration defense)', async () => {
  const { ctx, calls } = makeCtx({ dbResult: [] });
  const r = await recoverHandler({ email: 'unknown@example.com' }, ctx);
  assert.equal(r.status, 202);
  // Same response code as the success case — caller cannot tell if we have the email
  assert.equal(calls.sendRecoveryEmail.length, 0);
});

test('recover: email is normalized to lowercase + trimmed', async () => {
  const { ctx, calls } = makeCtx({ dbResult: [{ key: 'X' }] });
  const r = await recoverHandler({ email: '  Mike@Example.COM  ' }, ctx);
  assert.equal(r.status, 202);
  assert.equal(calls.findKeysByEmail[0], 'mike@example.com');
});

test('recover: per-IP rate limit caps at 5/hour', async () => {
  const { ctx } = makeCtx({ dbResult: [{ key: 'X' }] });
  // First 5 succeed
  for (let i = 0; i < 5; i++) {
    const r = await recoverHandler({ email: `u${i}@example.com` }, ctx);
    assert.equal(r.status, 202, `request ${i + 1} should succeed`);
  }
  // 6th — same IP, different email — gets throttled
  const r6 = await recoverHandler({ email: 'u6@example.com' }, ctx);
  assert.equal(r6.status, 429);
  assert.ok(r6.headers && r6.headers['Retry-After']);
});

test('recover: per-email rate limit caps at 3/hour', async () => {
  const { ctx } = makeCtx({ dbResult: [{ key: 'X' }] });
  // 3 succeed for the same email (note: same IP too — IP limit is 5)
  for (let i = 0; i < 3; i++) {
    const r = await recoverHandler({ email: 'target@example.com' }, ctx);
    assert.equal(r.status, 202, `request ${i + 1} should succeed`);
  }
  // 4th hits the per-email limit
  const r4 = await recoverHandler({ email: 'target@example.com' }, ctx);
  assert.equal(r4.status, 429);
});

test('recover: mailer failure still returns 202 (alerted by ops, not buyer)', async () => {
  const { ctx } = makeCtx({
    dbResult: [{ key: 'X' }],
    mailerThrows: new Error('Resend down'),
  });
  const r = await recoverHandler({ email: 'mike@example.com' }, ctx);
  assert.equal(r.status, 202);
});

test('recover: db failure → 500 (real error to caller)', async () => {
  const { ctx } = makeCtx({ dbThrows: new Error('connection refused') });
  const r = await recoverHandler({ email: 'mike@example.com' }, ctx);
  assert.equal(r.status, 500);
});

test('recover: multi-key email gets all keys in one send', async () => {
  const { ctx, calls } = makeCtx({
    dbResult: [
      { key: 'SELAM-AAAAA-BBBBB-CCCCC' },
      { key: 'SELAM-DDDDD-EEEEE-FFFFF' },
    ],
  });
  await recoverHandler({ email: 'whale@example.com' }, ctx);
  assert.equal(calls.sendRecoveryEmail.length, 1);
  assert.equal(calls.sendRecoveryEmail[0].keys.length, 2);
});

// Email template smoke tests
test('email template: builds subject + html + text for single key', () => {
  const { buildRecoveryEmail } = require('./email-templates/recovery');
  const msg = buildRecoveryEmail({
    to: 'mike@example.com',
    keys: [{ key: 'SELAM-AAAAA-BBBBB-CCCCC' }],
    sentAt: new Date('2026-05-03T12:00:00.000Z'),
  });
  assert.equal(msg.to, 'mike@example.com');
  assert.match(msg.subject, /license key$/);
  assert.match(msg.text, /SELAM-AAAAA-BBBBB-CCCCC/);
  assert.match(msg.html, /SELAM-AAAAA-BBBBB-CCCCC/);
});

test('email template: pluralizes for multi-key', () => {
  const { buildRecoveryEmail } = require('./email-templates/recovery');
  const msg = buildRecoveryEmail({
    to: 'whale@example.com',
    keys: [{ key: 'SELAM-A' }, { key: 'SELAM-B' }],
  });
  assert.match(msg.subject, /license keys$/);
  assert.match(msg.text, /Key 1: SELAM-A/);
  assert.match(msg.text, /Key 2: SELAM-B/);
});

test('email template: throws on empty keys', () => {
  const { buildRecoveryEmail } = require('./email-templates/recovery');
  assert.throws(() => buildRecoveryEmail({ to: 'x@y.com', keys: [] }));
});


// Purchase email template
test('purchase email: produces from/to/subject/html/text', () => {
  const { buildPurchaseEmail } = require('./email-templates/purchase.js');
  const msg = buildPurchaseEmail({
    to: 'mike@example.com',
    key: 'SELAM-AAAAA-BBBBB-CCCCC',
    productSku: 'selam-v1',
    sentAt: new Date('2026-05-25T10:00:00.000Z'),
  });
  assert.equal(msg.to, 'mike@example.com');
  assert.match(msg.subject, /Selam is ready/);
  assert.match(msg.text, /SELAM-AAAAA-BBBBB-CCCCC/);
  assert.match(msg.html, /SELAM-AAAAA-BBBBB-CCCCC/);
  assert.match(msg.text, /receipt was sent separately by Stripe/);
  assert.match(msg.text, /api\.heyselam\.app\/recover/);
});

test('purchase email: default download URL when not provided', () => {
  const { buildPurchaseEmail } = require('./email-templates/purchase.js');
  const msg = buildPurchaseEmail({ to: 'x@y.com', key: 'SELAM-X' });
  assert.match(msg.text, /heyselam\.app\/download/);
  assert.match(msg.html, /heyselam\.app\/download/);
});

test('purchase email: custom download URL respected', () => {
  const { buildPurchaseEmail } = require('./email-templates/purchase.js');
  const msg = buildPurchaseEmail({
    to: 'x@y.com',
    key: 'SELAM-X',
    downloadUrl: 'https://updates.heyselam.app/Selam-1.0.1.dmg',
  });
  assert.match(msg.text, /updates\.heyselam\.app\/Selam-1\.0\.1\.dmg/);
  assert.match(msg.html, /updates\.heyselam\.app\/Selam-1\.0\.1\.dmg/);
});

test('purchase email: throws on empty key or recipient', () => {
  const { buildPurchaseEmail } = require('./email-templates/purchase.js');
  assert.throws(() => buildPurchaseEmail({ to: '', key: 'SELAM-X' }));
  assert.throws(() => buildPurchaseEmail({ to: 'x@y.com', key: '' }));
});

test('purchase email: HTML escapes user-controlled fields', () => {
  // Defense in depth — we control the inputs today, but if email/key ever
  // came from user input, we'd want script-injection defense.
  const { buildPurchaseEmail } = require('./email-templates/purchase.js');
  const msg = buildPurchaseEmail({
    to: 'x@y.com',
    key: 'SELAM-<script>alert(1)</script>',
  });
  assert.ok(!msg.html.includes('<script>alert(1)</script>'),
    'HTML output must escape angle brackets');
  assert.ok(msg.html.includes('&lt;script&gt;'),
    'HTML output should contain escaped form');
});
