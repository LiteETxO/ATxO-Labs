// GET /api/ask-usage — HQ-gated proxy for the Ask-Selam budget snapshot.
//
// The Ask-Selam usage/budget data lives on heyselam.ai (/api/usage, in Upstash
// Redis) behind OPS_TOKEN. HQ is a different origin behind HQ_TOKEN. This route
// lets the HQ dashboard read it with the SAME HQ token: it verifies HQ_TOKEN,
// then server-side fetches heyselam.ai/api/usage using OPS_TOKEN (never exposed
// to the browser, no CORS needed).

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HQ_TOKEN = process.env.HQ_TOKEN || '';
const OPS_TOKEN = process.env.OPS_TOKEN || '';
const USAGE_URL = process.env.ASK_USAGE_URL || 'https://heyselam.ai/api/usage';

export async function GET(req: NextRequest) {
  const key =
    req.nextUrl.searchParams.get('key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  // Full HQ token or marketing-scoped token — Ask-Selam usage is marketing data.
  const MKT_TOKEN = process.env.HQ_MARKETING_TOKEN || '';
  const authed = (!!HQ_TOKEN && key === HQ_TOKEN) || (!!MKT_TOKEN && key === MKT_TOKEN);
  if (!authed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!OPS_TOKEN) {
    return NextResponse.json({ error: 'ask-usage not configured (OPS_TOKEN missing)' }, { status: 503 });
  }
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(`${USAGE_URL}?key=${encodeURIComponent(OPS_TOKEN)}`, {
      cache: 'no-store',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${OPS_TOKEN}` },
    });
    clearTimeout(to);
    if (!r.ok) {
      return NextResponse.json({ error: `upstream ${r.status}` }, { status: 502 });
    }
    const snap = await r.json();
    return NextResponse.json(snap, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 160) }, { status: 502 });
  }
}
