// ─── License database adapter ────────────────────────────────────────
//
// Wraps Neon serverless Postgres for the recover/validate/webhook
// handlers. Pure SQL — no ORM. Schema lives in `../../db/schema.sql`.
//
// Vercel Postgres was deprecated 2024Q4 in favor of Neon as a native
// integration. The Neon SDK is HTTP-based and edge-compatible, so it
// works in both Node and Edge runtimes without driver-version juggling.
//
// In dev with `vercel env pull` the POSTGRES_* env vars come down to
// .env.local automatically. In prod they're injected by the Vercel-Neon
// integration. We accept the legacy POSTGRES_URL as the canonical name
// (the integration sets it) and fall back to DATABASE_URL.

import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;
function db() {
  if (!_sql) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) throw new Error('POSTGRES_URL not set (configure Neon integration in Vercel)');
    _sql = neon(url);
  }
  return _sql;
}

// Founder cohort: the first 100 licenses sell at $99 with lifetime
// updates. After that, checkout flips to the standard tier ($149 launch, later $199, one
// year of updates). Revoked (refunded) licenses free their slot.
export const FOUNDER_CAP = 100;

export type LicenseTier = 'founder' | 'standard';

export type LicenseRecord = {
  key: string;
  email: string;
  productSku: string;
  status: 'active' | 'revoked';
  tier: LicenseTier;
  stripeSession: string | null;
  issuedAt: string;        // ISO
  revokedAt: string | null; // ISO
};

type RawRow = {
  key: string;
  email: string;
  product_sku: string;
  status: 'active' | 'revoked';
  tier: LicenseTier;
  stripe_session: string | null;
  issued_at: string;
  revoked_at: string | null;
};

function fromRow(r: RawRow): LicenseRecord {
  return {
    key: r.key,
    email: r.email,
    productSku: r.product_sku,
    status: r.status,
    tier: r.tier,
    stripeSession: r.stripe_session,
    issuedAt: r.issued_at,
    revokedAt: r.revoked_at,
  };
}

// Used by checkout + the public founder-count endpoint. Counts every
// active license (all SKUs — comped/press keys occupy founder slots too;
// undercounting would oversell the cohort, overcounting is the safe side).
export async function countActiveLicenses(): Promise<number> {
  const rows = await db()`
    SELECT COUNT(*)::int AS count FROM licenses WHERE status = 'active'
  ` as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

// Used by recover.js — returns active licenses for a given email
// (lowercase, trimmed by the caller). Revoked keys are not surfaced.
export async function findKeysByEmail(email: string): Promise<LicenseRecord[]> {
  const rows = await db()`
    SELECT
      key,
      email,
      product_sku,
      status,
      tier,
      stripe_session,
      to_char(issued_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as issued_at,
      to_char(revoked_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as revoked_at
    FROM licenses
    WHERE LOWER(email) = ${email}
      AND status = 'active'
    ORDER BY issued_at DESC
  ` as RawRow[];
  return rows.map(fromRow);
}

// Used by validate.js — single-key lookup. Returns null if not found.
export async function findKeyByValue(key: string): Promise<LicenseRecord | null> {
  const rows = await db()`
    SELECT
      key, email, product_sku, status, tier, stripe_session,
      to_char(issued_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as issued_at,
      to_char(revoked_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as revoked_at
    FROM licenses
    WHERE key = ${key}
    LIMIT 1
  ` as RawRow[];
  return rows.length === 0 ? null : fromRow(rows[0]);
}

// Used by stripe-webhook on checkout.session.completed — insert a freshly
// minted license. Idempotent on stripe_session: if the same Stripe checkout
// session has already produced a key, returns the existing record.
export async function insertLicense(
  key: string,
  email: string,
  productSku: string,
  stripeSession: string,
  tier: LicenseTier = 'founder',
): Promise<LicenseRecord> {
  const rows = await db()`
    INSERT INTO licenses (key, email, product_sku, stripe_session, status, tier)
    VALUES (${key}, ${email.toLowerCase()}, ${productSku}, ${stripeSession}, 'active', ${tier})
    ON CONFLICT (stripe_session) DO UPDATE SET
      stripe_session = EXCLUDED.stripe_session
    RETURNING
      key, email, product_sku, status, tier, stripe_session,
      to_char(issued_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as issued_at,
      to_char(revoked_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as revoked_at
  ` as RawRow[];
  return fromRow(rows[0]);
}

// Used by stripe-webhook on charge.refunded — flip license to revoked.
// Returns null if no matching active license exists.
export async function revokeLicenseByStripeSession(
  stripeSession: string,
): Promise<LicenseRecord | null> {
  const rows = await db()`
    UPDATE licenses
    SET status = 'revoked', revoked_at = NOW()
    WHERE stripe_session = ${stripeSession}
      AND status = 'active'
    RETURNING
      key, email, product_sku, status, tier, stripe_session,
      to_char(issued_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as issued_at,
      to_char(revoked_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as revoked_at
  ` as RawRow[];
  return rows.length === 0 ? null : fromRow(rows[0]);
}
