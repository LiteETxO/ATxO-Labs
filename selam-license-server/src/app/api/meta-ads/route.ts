// /api/meta-ads — live campaign spend/metrics from the Meta (Facebook/Instagram)
// Marketing API, for the HQ "Ads" tab. Same response shape as /api/google-ads
// so the UI treats both uniformly; joined to Stripe-attributed revenue client-
// side for ROAS. Falls back to manual /api/ad-spend when not configured.
//
// Required env (secrets; set in Vercel, not committed):
//   META_ACCESS_TOKEN     — long-lived System User token with ads_read
//   META_AD_ACCOUNT_ID    — the ad account ("act_123..." or just the digits)
// Optional:
//   META_API_VERSION      — Graph API version, default v21.0 (bump if deprecated)
//
// Safe no-op (configured:false + missing[]) until the vars exist.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HQ_TOKEN = process.env.HQ_TOKEN || '';
const MKT_TOKEN = process.env.HQ_MARKETING_TOKEN || '';

function authed(req: NextRequest): boolean {
  const key =
    req.nextUrl.searchParams.get('key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return (!!HQ_TOKEN && key === HQ_TOKEN) || (!!MKT_TOKEN && key === MKT_TOKEN);
}

const TOKEN = process.env.META_ACCESS_TOKEN || '';
const RAW_ACCT = process.env.META_AD_ACCOUNT_ID || '';
const ACCT = RAW_ACCT ? (RAW_ACCT.startsWith('act_') ? RAW_ACCT : 'act_' + RAW_ACCT.replace(/\D/g, '')) : '';
const VER = process.env.META_API_VERSION || 'v21.0';
const isConfigured = () => !!(TOKEN && ACCT);

const ymd = (d: Date) => d.toISOString().slice(0, 10);
// Action types that count as a conversion/revenue event (best-effort).
const CONV = new Set(['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'lead', 'complete_registration', 'onsite_web_purchase']);
const sumActions = (arr: Array<{ action_type?: string; value?: string }> | undefined) =>
  (arr || []).filter((a) => CONV.has(a.action_type || '')).reduce((s, a) => s + (parseFloat(a.value || '0') || 0), 0);

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isConfigured()) {
    const missing = Object.entries({ META_ACCESS_TOKEN: TOKEN, META_AD_ACCOUNT_ID: ACCT })
      .filter(([, v]) => !v).map(([k]) => k);
    return NextResponse.json({ configured: false, missing }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30));
  const since = ymd(new Date(Date.now() - (days - 1) * 86400000));
  const until = ymd(new Date());
  const url = `https://graph.facebook.com/${VER}/${ACCT}/insights?` + new URLSearchParams({
    level: 'campaign',
    fields: 'campaign_name,spend,impressions,clicks,actions,action_values',
    breakdowns: 'publisher_platform',   // → Facebook / Instagram / Audience Network / Messenger
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    access_token: TOKEN,
  }).toString();

  try {
    const resp = await fetch(url);
    const body = await resp.json();
    if (!resp.ok || body.error) {
      return NextResponse.json({ configured: true, error: String(body?.error?.message || ('HTTP ' + resp.status)).slice(0, 280) }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    // Rows are now per campaign × publisher_platform. Aggregate by campaign
    // and by channel (Facebook / Instagram / …).
    type Bucket = { cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number };
    const blank = (): Bucket => ({ cost: 0, clicks: 0, impressions: 0, conversions: 0, conversionsValue: 0 });
    const add = (map: Record<string, Bucket>, key: string, row: Record<string, unknown>, cost: number) => {
      const e = map[key] || blank();
      e.cost += cost;
      e.clicks += parseInt(String(row.clicks ?? '0'), 10) || 0;
      e.impressions += parseInt(String(row.impressions ?? '0'), 10) || 0;
      e.conversions += sumActions(row.actions as Array<{ action_type?: string; value?: string }>);
      e.conversionsValue += sumActions(row.action_values as Array<{ action_type?: string; value?: string }>);
      map[key] = e;
    };
    const channelOf = (p: string): string => ({
      facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network', messenger: 'Messenger',
    } as Record<string, string>)[p] || 'Other';

    const byCampaign: Record<string, Bucket> = {};
    const byChannel: Record<string, Bucket> = {};
    let totalCost = 0;
    for (const row of (body.data || []) as Array<Record<string, unknown>>) {
      const name = String(row.campaign_name || '(unnamed)');
      const cost = parseFloat(String(row.spend ?? '0')) || 0;
      add(byCampaign, name, row, cost);
      add(byChannel, channelOf(String(row.publisher_platform || '')), row, cost);
      totalCost += cost;
    }
    return NextResponse.json({
      configured: true, days, generatedAt: new Date().toISOString(),
      accountId: ACCT, totalCost: Math.round(totalCost * 100) / 100, byCampaign, byChannel,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ configured: true, error: String((e as Error)?.message || e).slice(0, 280) }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
