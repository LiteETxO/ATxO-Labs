// /api/google-ads — live campaign spend/metrics straight from the Google Ads
// API (GAQL), for the HQ "Ads" tab. Joined to Stripe-attributed revenue
// client-side to produce ROAS. Falls back to manual /api/ad-spend when this
// isn't configured.
//
// Required env (all secrets; set in Vercel, not committed):
//   GOOGLE_ADS_DEVELOPER_TOKEN   — Basic-access dev token (API Center / MCC)
//   GOOGLE_ADS_CLIENT_ID         — OAuth2 client id (Google Cloud project)
//   GOOGLE_ADS_CLIENT_SECRET     — OAuth2 client secret
//   GOOGLE_ADS_REFRESH_TOKEN     — refresh token for an authorized Ads user
//   GOOGLE_ADS_CUSTOMER_ID       — account to query (digits only, no dashes)
// Optional:
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID — manager (MCC) id, if the account sits under one
//   GOOGLE_ADS_API_VERSION       — API version segment, default v21 (bump if Google has moved on)
//
// Gracefully no-ops (configured:false) when the required vars are absent, so
// it is safe to ship before the credentials exist.

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

const DEV = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
const CID = process.env.GOOGLE_ADS_CLIENT_ID || '';
const CSECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
const REFRESH = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
const CUSTOMER = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/\D/g, '');
const LOGIN_CID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/\D/g, '');
const VER = process.env.GOOGLE_ADS_API_VERSION || 'v22';
const isConfigured = () => !!(DEV && CID && CSECRET && REFRESH && CUSTOMER);

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function accessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: CID, client_secret: CSECRET, refresh_token: REFRESH, grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('oauth: ' + (j.error_description || j.error || r.status));
  return j.access_token as string;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isConfigured()) {
    // Tell the UI exactly which pieces are missing, without leaking values.
    const missing = Object.entries({
      GOOGLE_ADS_DEVELOPER_TOKEN: DEV, GOOGLE_ADS_CLIENT_ID: CID, GOOGLE_ADS_CLIENT_SECRET: CSECRET,
      GOOGLE_ADS_REFRESH_TOKEN: REFRESH, GOOGLE_ADS_CUSTOMER_ID: CUSTOMER,
    }).filter(([, v]) => !v).map(([k]) => k);
    return NextResponse.json({ configured: false, missing }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30));
  const end = new Date();
  const start = new Date(Date.now() - (days - 1) * 86400000);
  const query =
    `SELECT campaign.name, segments.ad_network_type, metrics.cost_micros, metrics.clicks, metrics.impressions, ` +
    `metrics.conversions, metrics.conversions_value ` +
    `FROM campaign WHERE segments.date BETWEEN '${ymd(start)}' AND '${ymd(end)}'`;

  try {
    const token = await accessToken();
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + token,
      'developer-token': DEV,
      'Content-Type': 'application/json',
    };
    if (LOGIN_CID) headers['login-customer-id'] = LOGIN_CID;

    const r = await fetch(
      `https://googleads.googleapis.com/${VER}/customers/${CUSTOMER}/googleAds:search`,
      // Newer API versions reject an explicit pageSize (fixed at 10000).
      { method: 'POST', headers, body: JSON.stringify({ query }) },
    );
    const j = await r.json();
    if (!r.ok) {
      // Dig out the specific GoogleAdsFailure message (the top-level one is
      // just "Request contains an invalid argument").
      const gerr = j?.error?.details?.[0]?.errors?.[0];
      const qcode = gerr?.errorCode?.queryError;
      let detail = gerr?.message || j?.error?.message || j?.[0]?.error?.message || ('HTTP ' + r.status);
      if (qcode === 'REQUESTED_METRICS_FOR_MANAGER') {
        detail = `${CUSTOMER} is a manager (MCC) account — set GOOGLE_ADS_CUSTOMER_ID to a client account under it (keep GOOGLE_ADS_LOGIN_CUSTOMER_ID as the manager).`;
      }
      return NextResponse.json({ configured: true, error: String(detail).slice(0, 280) }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    // Rows are now per campaign × ad-network. Aggregate both by campaign and
    // by channel (Search / Display / YouTube / …).
    type Bucket = { cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number };
    const blank = (): Bucket => ({ cost: 0, clicks: 0, impressions: 0, conversions: 0, conversionsValue: 0 });
    const add = (map: Record<string, Bucket>, key: string, cost: number, m: Record<string, unknown>) => {
      const e = map[key] || blank();
      e.cost += cost;
      e.clicks += parseInt(String(m.clicks ?? '0'), 10) || 0;
      e.impressions += parseInt(String(m.impressions ?? '0'), 10) || 0;
      e.conversions += Number(m.conversions ?? 0) || 0;
      e.conversionsValue += Number(m.conversionsValue ?? 0) || 0;
      map[key] = e;
    };
    const channelOf = (n: string): string => ({
      SEARCH: 'Search', SEARCH_PARTNERS: 'Search partners', CONTENT: 'Display',
      YOUTUBE_WATCH: 'YouTube', YOUTUBE_SEARCH: 'YouTube', MIXED: 'Mixed (PMax/Demand Gen)',
    } as Record<string, string>)[n] || 'Other';

    const byCampaign: Record<string, Bucket> = {};
    const byChannel: Record<string, Bucket> = {};
    let totalCost = 0;
    for (const row of (j.results || []) as Array<{ campaign?: { name?: string }; segments?: { adNetworkType?: string }; metrics?: Record<string, unknown> }>) {
      const name = row.campaign?.name || '(unnamed)';
      const m = row.metrics || {};
      const cost = (parseInt(String(m.costMicros ?? '0'), 10) || 0) / 1e6;
      add(byCampaign, name, cost, m);
      add(byChannel, channelOf(row.segments?.adNetworkType || ''), cost, m);
      totalCost += cost;
    }
    return NextResponse.json({
      configured: true, days, generatedAt: new Date().toISOString(),
      customerId: CUSTOMER, totalCost: Math.round(totalCost * 100) / 100, byCampaign, byChannel,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ configured: true, error: String((e as Error)?.message || e).slice(0, 240) }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
