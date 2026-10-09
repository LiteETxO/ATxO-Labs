// /api/ad-spend — manual / CSV Google-Ads spend, joined to attributed revenue
// elsewhere (the HQ "Ads" tab computes ROAS by matching campaign names against
// /api/analytics campaign revenue). No Google Ads API — spend is entered by
// the owner or the marketer.
//   GET  (key = HQ_TOKEN or HQ_MARKETING_TOKEN) → spend by campaign for a window
//   POST (same)  → upsert one row or a batch (CSV paste) of {campaign, day, spend}
//   DELETE (same) → remove all rows for a campaign (cleanup / correction)
//
// Data lives in Neon (ad_spend table, self-provisioned on first use).

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HQ_TOKEN = process.env.HQ_TOKEN || '';
const MKT_TOKEN = process.env.HQ_MARKETING_TOKEN || '';
const dbUrl = () => process.env.POSTGRES_URL || process.env.DATABASE_URL;

function authed(req: NextRequest): boolean {
  const key =
    req.nextUrl.searchParams.get('key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return (!!HQ_TOKEN && key === HQ_TOKEN) || (!!MKT_TOKEN && key === MKT_TOKEN);
}

let _ensured = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensure(sql: any) {
  if (_ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS ad_spend (
    source TEXT NOT NULL DEFAULT 'google',
    campaign TEXT NOT NULL,
    day DATE NOT NULL,
    spend NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source, campaign, day)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS ad_spend_day ON ad_spend (day DESC)`;
  _ensured = true;
}

const today = () => new Date().toISOString().slice(0, 10);
const clampDay = (v: unknown): string => {
  const t = String(v ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : today();
};
const money = (v: unknown): number => {
  // tolerate "$1,234.56", "1 234,56", bare numbers
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
};
const camp = (v: unknown): string => String(v ?? '').trim().slice(0, 160);

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = dbUrl(); if (!url) return NextResponse.json({ error: 'no db' }, { status: 500 });
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30));
  try {
    const sql = neon(url);
    await ensure(sql);
    const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const [byCampaign, daily, tot] = await Promise.all([
      sql`SELECT campaign, SUM(spend)::float spend FROM ad_spend
          WHERE source='google' AND day >= ${since} GROUP BY campaign ORDER BY spend DESC`,
      sql`SELECT to_char(day,'YYYY-MM-DD') AS d, SUM(spend)::float AS spend FROM ad_spend
          WHERE source='google' AND day >= ${since} GROUP BY day ORDER BY day`,
      sql`SELECT COALESCE(SUM(spend),0)::float spend FROM ad_spend
          WHERE source='google' AND day >= ${since}`,
    ]);
    const spendByCampaign: Record<string, number> = {};
    for (const r of byCampaign as Array<{ campaign: string; spend: number }>) spendByCampaign[r.campaign] = r.spend;
    return NextResponse.json({
      ok: true, days, generatedAt: new Date().toISOString(),
      totalSpend: (tot as Array<{ spend: number }>)[0]?.spend || 0,
      spendByCampaign,
      daily: (daily as Array<{ d: string; spend: number }>).map((r) => ({ day: r.d, spend: r.spend })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = dbUrl(); if (!url) return NextResponse.json({ error: 'no db' }, { status: 500 });
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  // Normalize to a list of {campaign, day, spend}. A batch carries `rows`;
  // a single entry carries campaign/day/spend at the top level. A shared
  // fallback `day` applies to any row that doesn't name its own.
  const fallbackDay = clampDay(b.day);
  const raw = Array.isArray(b.rows) ? (b.rows as unknown[]) : [b];
  const rows = raw
    .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : {}))
    .map((r) => ({ campaign: camp(r.campaign), day: r.day ? clampDay(r.day) : fallbackDay, spend: money(r.spend ?? r.cost) }))
    .filter((r) => r.campaign.length > 0);

  if (!rows.length) return NextResponse.json({ error: 'no valid rows (need campaign + spend)' }, { status: 400 });
  if (rows.length > 500) return NextResponse.json({ error: 'too many rows (max 500)' }, { status: 400 });

  try {
    const sql = neon(url);
    await ensure(sql);
    for (const r of rows) {
      await sql`INSERT INTO ad_spend (source, campaign, day, spend, updated_at)
                VALUES ('google', ${r.campaign}, ${r.day}, ${r.spend}, NOW())
                ON CONFLICT (source, campaign, day)
                DO UPDATE SET spend = EXCLUDED.spend, updated_at = NOW()`;
    }
    return NextResponse.json({ ok: true, upserted: rows.length }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 200) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = dbUrl(); if (!url) return NextResponse.json({ error: 'no db' }, { status: 500 });
  const campaign = camp(req.nextUrl.searchParams.get('campaign'));
  if (!campaign) return NextResponse.json({ error: 'campaign required' }, { status: 400 });
  try {
    const sql = neon(url);
    await ensure(sql);
    await sql`DELETE FROM ad_spend WHERE source='google' AND campaign = ${campaign}`;
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 200) }, { status: 500 });
  }
}
