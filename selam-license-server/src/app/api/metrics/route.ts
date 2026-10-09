// /api/metrics — token-gated sales snapshot for the HQ dashboard (/hq).
// Real data: Stripe (revenue, tax-accurate, refund-aware) + Neon Postgres
// (licenses, subscribers). Guarded by HQ_TOKEN — never public.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HQ_TOKEN = process.env.HQ_TOKEN || '';

function maskEmail(e: string): string {
  if (!e || !e.includes('@')) return '—';
  const [u, d] = e.split('@');
  return (u.slice(0, 1) || '') + '***@' + d;
}
function dayKeys(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  return out;
}

export async function GET(req: NextRequest) {
  const key =
    req.nextUrl.searchParams.get('key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  // Accept the full HQ token or the second (marketing) token — both have
  // full access, including revenue. The second token exists so a contractor
  // can be granted and later revoked independently of the owner's token.
  const MKT_TOKEN = process.env.HQ_MARKETING_TOKEN || '';
  const authed = (!!HQ_TOKEN && key === HQ_TOKEN) || (!!MKT_TOKEN && key === MKT_TOKEN);
  if (!authed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const out: Record<string, unknown> = { ok: true, generatedAt: new Date().toISOString() };

  // ── Postgres: licenses + subscribers ──
  try {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) throw new Error('no db');
    const sql = neon(url);

    const [byType, byTier, licDaily, subTotal, sub30, subDaily, subRecent, recentLic] = await Promise.all([
      sql`SELECT purchase_type, status, COUNT(*)::int n FROM licenses GROUP BY 1,2`,
      sql`SELECT tier, COUNT(*)::int n FROM licenses WHERE status='active' GROUP BY 1`,
      sql`SELECT to_char(date_trunc('day', issued_at),'YYYY-MM-DD') d, COUNT(*)::int n
          FROM licenses WHERE issued_at >= NOW() - INTERVAL '30 days' GROUP BY 1`,
      sql`SELECT COUNT(*)::int n FROM subscribers`,
      sql`SELECT COUNT(*)::int n FROM subscribers WHERE created_at >= NOW() - INTERVAL '30 days'`,
      sql`SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') d, COUNT(*)::int n
          FROM subscribers WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY 1`,
      sql`SELECT email, source, to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') at
          FROM subscribers ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT email, purchase_type, tier, status, to_char(issued_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') at
          FROM licenses ORDER BY issued_at DESC LIMIT 12`,
    ]) as unknown as [
      Array<{ purchase_type: string; status: string; n: number }>,
      Array<{ tier: string; n: number }>,
      Array<{ d: string; n: number }>,
      Array<{ n: number }>,
      Array<{ n: number }>,
      Array<{ d: string; n: number }>,
      Array<{ email: string; source: string | null; at: string }>,
      Array<{ email: string; purchase_type: string; tier: string; status: string; at: string }>,
    ];

    const orders = { trial: 0, perpetual: 0, update_pass: 0 };
    let refunded = 0, activeTotal = 0;
    for (const r of byType) {
      if (r.status === 'active') { activeTotal += r.n; if (r.purchase_type in orders) (orders as Record<string, number>)[r.purchase_type] += r.n; }
      if (r.status === 'revoked') refunded += r.n;
    }
    const tierCounts = { founder: 0, standard: 0 };
    for (const r of byTier) if (r.tier in tierCounts) (tierCounts as Record<string, number>)[r.tier] = r.n;

    const owners = orders.perpetual;
    const trials = orders.trial;
    out.orders = orders;
    out.licenses = { active: activeTotal, refunded, founder: tierCounts.founder, standard: tierCounts.standard, founderCap: 100, founderLeft: Math.max(0, 100 - tierCounts.founder) };
    out.signups = {
      total: subTotal[0]?.n ?? 0,
      d30: sub30[0]?.n ?? 0,
      recent: subRecent.map((s) => ({ email: maskEmail(s.email), source: s.source || 'direct', at: s.at })),
    };
    out.conversion = { signups: subTotal[0]?.n ?? 0, trials, owners, trialToOwn: trials + owners > 0 ? Math.round((owners / (trials + owners)) * 100) : 0 };
    out.recentSales = recentLic.map((r) => ({ email: maskEmail(r.email), type: r.purchase_type, tier: r.tier, status: r.status, at: r.at }));

    // daily new-license + signup series (30d, zero-filled)
    const licMap = new Map(licDaily.map((r) => [r.d, r.n]));
    const subMap = new Map(subDaily.map((r) => [r.d, r.n]));
    out.dailyLicenses = dayKeys(30).map((d) => ({ day: d, n: licMap.get(d) || 0 }));
    out.dailySignups = dayKeys(30).map((d) => ({ day: d, n: subMap.get(d) || 0 }));
  } catch (e) {
    out.dbError = String(e).slice(0, 140);
  }

  // ── Stripe: real revenue (net of refunds) ──
  try {
    const skey = process.env.STRIPE_SECRET_KEY;
    if (!skey) throw new Error('no stripe');
    const stripe = new Stripe(skey);
    const charges = await stripe.charges.list({ limit: 100 }).autoPagingToArray({ limit: 1000 });

    const now = Date.now() / 1000;
    const d30 = now - 30 * 86400;
    let allTime = 0, rev30 = 0, count = 0;
    const revByDay = new Map<string, number>();
    let currency = 'usd';
    for (const c of charges) {
      if (c.status !== 'succeeded' || !c.paid) continue;
      const net = (c.amount - (c.amount_refunded || 0)) / 100;
      if (net <= 0) continue;
      currency = c.currency || currency;
      allTime += net; count += 1;
      if (c.created >= d30) rev30 += net;
      const day = new Date(c.created * 1000).toISOString().slice(0, 10);
      revByDay.set(day, (revByDay.get(day) || 0) + net);
    }
    out.revenue = {
      currency,
      allTime: Math.round(allTime * 100) / 100,
      d30: Math.round(rev30 * 100) / 100,
      paidCount: count,
      capped: charges.length >= 1000,
      daily: dayKeys(30).map((d) => ({ day: d, usd: Math.round((revByDay.get(d) || 0) * 100) / 100 })),
    };
  } catch (e) {
    out.stripeError = String(e).slice(0, 140);
  }

  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
