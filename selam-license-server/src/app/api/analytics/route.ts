// GET /api/analytics — token-gated read model over landing_events (first-party
// landing analytics collected by /api/track). Powers the /analytics dashboard.
// Guarded by HQ_TOKEN (same token as /hq). Never public.

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HQ_TOKEN = process.env.HQ_TOKEN || '';

export async function GET(req: NextRequest) {
  const key =
    req.nextUrl.searchParams.get('key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!HQ_TOKEN || key !== HQ_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30));
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: 'no db' }, { status: 500 });
  const sql = neon(url);

  try {
    // Interval is inlined per query — Neon's serverless driver can't compose sql`` fragments.
    const [byEvent, visitors, daily, funnel, campaigns, content, referrers, countries, devices, scroll] = await Promise.all([
      sql`SELECT event, COUNT(*)::int n FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day') GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT COUNT(DISTINCT visitor)::int n FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day')`,
      sql`SELECT to_char(date_trunc('day', ts),'YYYY-MM-DD') d,
                 COUNT(*) FILTER (WHERE event='landing_view')::int views,
                 COUNT(DISTINCT visitor)::int visitors
          FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day') GROUP BY 1 ORDER BY 1`,
      sql`SELECT
            COUNT(*) FILTER (WHERE event='landing_view')::int views,
            COUNT(DISTINCT visitor) FILTER (WHERE event LIKE 'cta_%')::int engaged,
            COUNT(*) FILTER (WHERE event='cta_buy')::int buy,
            COUNT(*) FILTER (WHERE event='cta_pay_crypto')::int crypto
          FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day')`,
      sql`SELECT COALESCE(utm_campaign,'(none)') campaign,
                 COUNT(*) FILTER (WHERE event='landing_view')::int views,
                 COUNT(*) FILTER (WHERE event LIKE 'cta_%')::int clicks,
                 COUNT(*) FILTER (WHERE event='cta_buy')::int buy
          FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day') GROUP BY 1 ORDER BY 2 DESC NULLS LAST LIMIT 20`,
      sql`SELECT COALESCE(utm_content,'(none)') content, COUNT(*) FILTER (WHERE event LIKE 'cta_%')::int clicks
          FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event LIKE 'cta_%' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
      sql`SELECT COALESCE(ref,'(direct)') ref, COUNT(*)::int n FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event='landing_view' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
      sql`SELECT COALESCE(country,'??') country, COUNT(*)::int n FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event='landing_view' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
      sql`SELECT COALESCE(device,'?') device, COUNT(*)::int n FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event='landing_view' GROUP BY 1 ORDER BY 2 DESC`,
      sql`SELECT event, COUNT(*)::int n FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event LIKE 'scroll_%' GROUP BY 1 ORDER BY 1`,
    ]) as unknown as [
      Array<{ event: string; n: number }>,
      Array<{ n: number }>,
      Array<{ d: string; views: number; visitors: number }>,
      Array<{ views: number; engaged: number; buy: number; crypto: number }>,
      Array<{ campaign: string; views: number; clicks: number; buy: number }>,
      Array<{ content: string; clicks: number }>,
      Array<{ ref: string; n: number }>,
      Array<{ country: string; n: number }>,
      Array<{ device: string; n: number }>,
      Array<{ event: string; n: number }>,
    ];

    const byEventMap: Record<string, number> = {};
    for (const r of byEvent) byEventMap[r.event] = r.n;
    const f = funnel[0] || { views: 0, engaged: 0, buy: 0, crypto: 0 };

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      days,
      totals: {
        views: byEventMap['landing_view'] || 0,
        visitors: visitors[0]?.n || 0,
        events: byEvent.reduce((a, r) => a + r.n, 0),
        byEvent: byEventMap,
      },
      daily,
      ctas: byEvent.filter((r) => r.event.startsWith('cta_')).map((r) => ({ name: r.event, count: r.n })),
      funnel: f,
      campaigns,
      content,
      referrers,
      countries,
      devices,
      scroll: scroll.map((r) => ({ depth: r.event.replace('scroll_', '') + '%', n: r.n })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'query failed', detail: String((e as Error)?.message || e).slice(0, 200) }, { status: 500 });
  }
}
