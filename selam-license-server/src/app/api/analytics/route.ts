// GET /api/analytics — token-gated read model over landing_events (first-party
// landing analytics collected by /api/track). Powers the /analytics dashboard.
// Guarded by HQ_TOKEN (same token as /hq). Never public.

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HQ_TOKEN = process.env.HQ_TOKEN || '';

export async function GET(req: NextRequest) {
  const key =
    req.nextUrl.searchParams.get('key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  // Accept the full HQ token or the marketing-scoped token — landing
  // analytics is marketing data, so both roles may read it.
  const MKT_TOKEN = process.env.HQ_MARKETING_TOKEN || '';
  const authed = (!!HQ_TOKEN && key === HQ_TOKEN) || (!!MKT_TOKEN && key === MKT_TOKEN);
  if (!authed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30));
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: 'no db' }, { status: 500 });
  const sql = neon(url);

  try {
    // Interval is inlined per query — Neon's serverless driver can't compose sql`` fragments.
    const [byEvent, visitors, daily, funnel, campaigns, content, referrers, countries, devices, scroll,
           questions, engagement, games, sections, ctaPlacement, sources] = await Promise.all([
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
      // Voice-of-customer: the questions visitors actually ask.
      sql`SELECT q, COUNT(*)::int n, COUNT(DISTINCT visitor)::int u FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event='engage_ask' AND q IS NOT NULL AND q <> ''
          GROUP BY q ORDER BY 2 DESC LIMIT 40`,
      // Interactive-hero engagement (asks / voice / games / tour …).
      sql`SELECT event, COUNT(*)::int n, COUNT(DISTINCT visitor)::int u FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event LIKE 'engage_%' GROUP BY 1 ORDER BY 2 DESC`,
      // Which games get played.
      sql`SELECT COALESCE(label,'?') game, COUNT(*)::int n FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event='engage_game' GROUP BY 1 ORDER BY 2 DESC`,
      // Sections actually reached (unique visitors).
      sql`SELECT event, COUNT(DISTINCT visitor)::int n FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event LIKE 'section_%' GROUP BY 1 ORDER BY 2 DESC`,
      // Which buy button (placement) gets the click.
      sql`SELECT COALESCE(label,'(unknown)') placement, COUNT(*)::int n FROM landing_events
          WHERE ts >= NOW() - (${days} * INTERVAL '1 day') AND event='cta_buy' GROUP BY 1 ORDER BY 2 DESC`,
      // Traffic quality per source — views → clicks → buy, not just volume.
      sql`SELECT COALESCE(ref,'(direct)') ref,
                 COUNT(*) FILTER (WHERE event='landing_view')::int views,
                 COUNT(*) FILTER (WHERE event LIKE 'cta_%')::int clicks,
                 COUNT(*) FILTER (WHERE event='cta_buy')::int buy
          FROM landing_events WHERE ts >= NOW() - (${days} * INTERVAL '1 day')
          GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
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
      Array<{ q: string; n: number; u: number }>,
      Array<{ event: string; n: number; u: number }>,
      Array<{ game: string; n: number }>,
      Array<{ event: string; n: number }>,
      Array<{ placement: string; n: number }>,
      Array<{ ref: string; views: number; clicks: number; buy: number }>,
    ];

    const byEventMap: Record<string, number> = {};
    for (const r of byEvent) byEventMap[r.event] = r.n;
    const f = funnel[0] || { views: 0, engaged: 0, buy: 0, crypto: 0 };

    // Revenue attribution — real paid $ by campaign, from Stripe charges
    // (refund-aware; charges carry ref/campaign via payment_intent metadata).
    const revByCampaign: Record<string, { paid: number; revenue: number }> = {};
    const revByDay: Record<string, number> = {};
    let attributedRevenue = 0, currency = 'usd', stripeError: string | undefined;
    try {
      const skey = process.env.STRIPE_SECRET_KEY;
      if (skey) {
        const stripe = new Stripe(skey);
        const since = Math.floor(Date.now() / 1000 - days * 86400);
        const charges = await stripe.charges.list({ limit: 100, created: { gte: since } }).autoPagingToArray({ limit: 1000 });
        for (const c of charges) {
          if (c.status !== 'succeeded' || !c.paid) continue;
          const net = (c.amount - (c.amount_refunded || 0)) / 100;
          if (net <= 0) continue;
          currency = c.currency || currency;
          const camp = (c.metadata && c.metadata.campaign) || '(none)';
          const e = revByCampaign[camp] || { paid: 0, revenue: 0 };
          e.paid += 1; e.revenue += net; revByCampaign[camp] = e;
          attributedRevenue += net;
          const day = new Date(c.created * 1000).toISOString().slice(0, 10);
          revByDay[day] = (revByDay[day] || 0) + net;
        }
      }
    } catch (e) { stripeError = String((e as Error)?.message || e).slice(0, 120); }
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const revenueDaily = Object.entries(revByDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, v]) => ({ day, revenue: r2(v) }));
    // Merge paid $ onto the campaign rows; append revenue-only campaigns.
    const campaignRows = campaigns.map((c) => ({
      ...c, paid: revByCampaign[c.campaign]?.paid || 0, revenue: r2(revByCampaign[c.campaign]?.revenue || 0),
    }));
    const known = new Set(campaigns.map((c) => c.campaign));
    for (const [camp, v] of Object.entries(revByCampaign)) {
      if (camp !== '(none)' && !known.has(camp)) campaignRows.push({ campaign: camp, views: 0, clicks: 0, buy: 0, paid: v.paid, revenue: r2(v.revenue) });
    }
    campaignRows.sort((a, b) => b.revenue - a.revenue || b.views - a.views);

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
      funnelRates: {
        viewToEngaged: f.views ? +(100 * f.engaged / f.views).toFixed(1) : 0,
        viewToBuy: f.views ? +(100 * f.buy / f.views).toFixed(1) : 0,
        engagedToBuy: f.engaged ? +(100 * f.buy / f.engaged).toFixed(1) : 0,
      },
      campaigns: campaignRows,
      attributedRevenue: r2(attributedRevenue),
      attributedRevenueDaily: revenueDaily,
      currency,
      stripeError,
      content,
      referrers,
      countries,
      devices,
      scroll: scroll.map((r) => ({ depth: r.event.replace('scroll_', '') + '%', n: r.n })),
      // Phase 1 additions
      questions: questions.map((r) => ({ q: r.q, n: r.n, visitors: r.u })),
      engagement: engagement.map((r) => ({ kind: r.event.replace('engage_', ''), n: r.n, visitors: r.u })),
      games,
      sections: sections.map((r) => ({ section: r.event.replace('section_', ''), visitors: r.n })),
      ctaPlacement,
      sources,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'query failed', detail: String((e as Error)?.message || e).slice(0, 200) }, { status: 500 });
  }
}
