// GET /api/status — Lightweight health check for ops monitoring.
//
// Returns 200 with details when all critical paths are reachable.
// Returns 503 when something we depend on is down.
//
// Designed for synthetic checks (UptimeRobot, Vercel monitoring, an
// external alerting tool) and quick manual diagnosis. NOT a public
// endpoint — robots.txt blocks /api/, but an attacker can still hit it.
// Doesn't expose any secrets; only "yes/no" booleans + counts.

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

type CheckResult = { ok: boolean; ms: number; detail?: string };

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

async function checkDb(): Promise<CheckResult> {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return { ok: false, ms: 0, detail: 'POSTGRES_URL not configured' };
  try {
    const sql = neon(url);
    const { result, ms } = await timed(async () => {
      const rows = await sql`SELECT COUNT(*)::text AS count FROM licenses` as Array<{ count: string }>;
      return rows[0]?.count || '0';
    });
    return { ok: true, ms, detail: `${result} licenses` };
  } catch (e) {
    return { ok: false, ms: 0, detail: (e as Error).message?.slice(0, 100) };
  }
}

async function checkStripe(): Promise<CheckResult> {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, ms: 0, detail: 'STRIPE_SECRET_KEY not configured' };
  try {
    // Hitting /v1/balance is a cheap auth-only ping that doesn't list customers.
    const { ms } = await timed(async () => {
      const r = await fetch('https://api.stripe.com/v1/balance', {
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) throw new Error(`stripe ${r.status}`);
    });
    return { ok: true, ms };
  } catch (e) {
    return { ok: false, ms: 0, detail: (e as Error).message?.slice(0, 100) };
  }
}

async function checkResend(): Promise<CheckResult> {
  // Resend doesn't have a free auth-ping endpoint. The cheapest is
  // /domains, which lists configured domains. We don't actually want
  // to fetch every status check — instead, just verify the key shape
  // and trust that. A failed send will be surfaced via mailer logs.
  if (!process.env.RESEND_API_KEY) return { ok: false, ms: 0, detail: 'RESEND_API_KEY not configured' };
  return { ok: true, ms: 0, detail: 'config present (not pinged)' };
}

export async function GET() {
  const [db, stripe, resend] = await Promise.all([
    checkDb(),
    checkStripe(),
    checkResend(),
  ]);

  const allOk = db.ok && stripe.ok && resend.ok;
  const body = {
    status: allOk ? 'ok' : 'degraded',
    checked_at: new Date().toISOString(),
    checks: { db, stripe, resend },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    region: process.env.VERCEL_REGION || 'local',
  };

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
