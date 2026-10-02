// POST /api/track — first-party landing analytics collector.
//
// The landing page (heyselam.ai) beacons lightweight events here so we own the
// data in Neon and read it from our own dashboard (/analytics) — no Vercel login.
// Privacy-light: no raw IP or PII stored. Visitors are a daily salted hash so we
// can count uniques without cookies. CORS is open (the landing posts cross-origin);
// body is text/plain JSON to avoid a preflight roundtrip. Rate-limited per IP.

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getLimiter } from '@/lib/rate-limit';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Only accept known event names — keeps the table clean + abuse-resistant.
const EVENT_RE = /^(landing_view|cta_[a-z_]{1,24}|engage_[a-z_]{1,24}|section_[a-z_]{1,24}|scroll_\d{2,3})$/;

let _ensured = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensure(sql: any) {
  if (_ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS landing_events (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event TEXT NOT NULL,
    path TEXT,
    utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
    gclid TEXT, ref TEXT, country TEXT, device TEXT, visitor TEXT,
    q TEXT, label TEXT
  )`;
  await sql`CREATE INDEX IF NOT EXISTS landing_events_ts ON landing_events (ts)`;
  await sql`CREATE INDEX IF NOT EXISTS landing_events_event ON landing_events (event)`;
  await sql`CREATE INDEX IF NOT EXISTS landing_events_campaign ON landing_events (utm_campaign)`;
  // Added after launch — backfill columns on already-provisioned tables.
  await sql`ALTER TABLE landing_events ADD COLUMN IF NOT EXISTS q TEXT`;
  await sql`ALTER TABLE landing_events ADD COLUMN IF NOT EXISTS label TEXT`;
  _ensured = true;
}

const s = (v: unknown, n = 120): string | null => {
  const t = (v == null ? '' : String(v)).trim();
  return t ? t.slice(0, n) : null;
};
function device(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}
function refHost(r: string | null): string | null {
  if (!r) return null;
  try { return new URL(r).hostname.replace(/^www\./, '').slice(0, 80); } catch { return null; }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  // Always succeed fast from the client's perspective — analytics must never break the page.
  const ok = () => new NextResponse(null, { status: 204, headers: { ...CORS, 'Cache-Control': 'no-store' } });
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limiter = await getLimiter();
    const { allowed } = await limiter.check(`track:${ip}`, 240, 60 * 1000); // 240 events/min/IP
    if (!allowed) return ok();

    // text/plain body to dodge CORS preflight; parse defensively.
    const raw = await req.text();
    const b = (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() as Record<string, unknown>;

    const event = s(b.event, 40);
    if (!event || !EVENT_RE.test(event)) return ok();

    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) return ok();
    const sql = neon(url);
    await ensure(sql);

    const ua = req.headers.get('user-agent') || '';
    const day = new Date().toISOString().slice(0, 10);
    const salt = process.env.HQ_TOKEN || 'selam';
    const visitor = crypto.createHash('sha256').update(ip + '|' + ua + '|' + day + '|' + salt).digest('hex').slice(0, 16);
    const country = req.headers.get('x-vercel-ip-country') || null;

    // Accept utm keys with or without the "utm_" prefix (client strips it).
    const u = (k: string) => s(b['utm_' + k] ?? b[k], 80);

    // q = free-text question (engage_ask); label = CTA placement or game name.
    const q = event === 'engage_ask' ? s(b.q, 240) : null;
    const label = s(b.label, 60);
    await sql`INSERT INTO landing_events
      (event, path, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, ref, country, device, visitor, q, label)
      VALUES (${event}, ${s(b.path, 200)}, ${u('source')}, ${u('medium')}, ${u('campaign')}, ${u('content')},
              ${u('term')}, ${s(b.gclid, 120)}, ${refHost(s(b.ref, 300) || req.headers.get('referer'))},
              ${country}, ${device(ua)}, ${visitor}, ${q}, ${label})`;
    return ok();
  } catch {
    return ok();
  }
}
