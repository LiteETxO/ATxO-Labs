// Ads tab for the unified HQ dashboard — Google Ads ROAS without the API.
// Spend is entered by hand or pasted from a Google Ads CSV (/api/ad-spend),
// then joined against the revenue /api/analytics already attributes per
// campaign (matched on campaign name) to compute ROAS, CPA, and cost/visit.
'use client';

import { useMemo, useState } from 'react';
import type { AnalyticsData } from './LandingView';

export type AdSpendData = {
  days: number;
  totalSpend: number;
  spendByCampaign: Record<string, number>;
  daily: Array<{ day: string; spend: number }>;
  error?: string;
};

// One shape for every live ad source (Google Ads, Meta). `customerId` is set
// by Google, `accountId` by Meta — both just label the source.
export type GoogleAdsData = {
  configured: boolean;
  error?: string;
  missing?: string[];
  days?: number;
  customerId?: string;
  accountId?: string;
  totalCost?: number;
  byCampaign?: Record<string, { cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number }>;
  byChannel?: Record<string, { cost: number; clicks: number; impressions: number; conversions: number; conversionsValue: number }>;
  daily?: Array<{ day: string; cost: number }>;
};
export type LiveAdsData = GoogleAdsData;

const nf = (n: number) => (n || 0).toLocaleString();
const money = (n: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const roasStr = (rev: number, spend: number) => (spend > 0 ? (rev / spend).toFixed(2) + '×' : '—');
const roasGood = (rev: number, spend: number) => spend > 0 && rev / spend >= 1;

type Row = {
  campaign: string; spend: number; views: number; buy: number; orders: number; revenue: number;
};

function HBar({ label, value, max, note }: { label: string; value: number; max: number; note: string }) {
  const pct = max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 3 }}>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink3)', flex: 'none' }}>{note}</span>
      </div>
      <div style={{ height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,var(--iris-deep),var(--iris))', borderRadius: 5 }} />
      </div>
    </div>
  );
}

export default function AdsView({
  days, analytics, spend, live, meta, token, onChanged,
}: {
  days: number;
  analytics: AnalyticsData | null;
  spend: AdSpendData | null;
  live: LiveAdsData | null;
  meta: LiveAdsData | null;
  token: string;
  onChanged: () => void;
}) {
  const [c, setC] = useState('');
  const [amt, setAmt] = useState('');
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [csv, setCsv] = useState('');
  const [csvDay, setCsvDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const rev = useMemo(() => {
    const m: Record<string, { views: number; buy: number; orders: number; revenue: number }> = {};
    for (const x of analytics?.campaigns || []) m[x.campaign] = { views: x.views, buy: x.buy, orders: x.paid, revenue: x.revenue };
    return m;
  }, [analytics]);

  // Live sources (Google Ads, Meta) are authoritative where present; manual
  // /api/ad-spend fills any campaign no API covers.
  const platforms = useMemo(() => ([
    { name: 'Google Ads', d: live },
    { name: 'Meta', d: meta },
  ]), [live, meta]);
  const activeLive = useMemo(() => platforms.filter((p) => p.d && p.d.configured && !p.d.error && p.d.byCampaign), [platforms]);
  const liveAny = activeLive.length > 0;

  const effSpend = useMemo(() => {
    const manual = spend?.spendByCampaign || {};
    const out: Record<string, number> = { ...manual };
    for (const p of activeLive) for (const [k, v] of Object.entries(p.d!.byCampaign!)) out[k] = v.cost;
    return out;
  }, [spend, activeLive]);
  const liveClicks = useMemo(() => activeLive.reduce((s, p) => s + Object.values(p.d!.byCampaign!).reduce((a, v) => a + v.clicks, 0), 0), [activeLive]);
  const liveImpr = useMemo(() => activeLive.reduce((s, p) => s + Object.values(p.d!.byCampaign!).reduce((a, v) => a + v.impressions, 0), 0), [activeLive]);
  // Per-platform spend (live sources + manual remainder).
  const liveNames = useMemo(() => { const s = new Set<string>(); activeLive.forEach((p) => Object.keys(p.d!.byCampaign!).forEach((n) => s.add(n))); return s; }, [activeLive]);
  // Per-platform spend vs attributed revenue → ROAS summary (+ combined total).
  // Revenue is attributed to a platform by its campaign names; "Manual"
  // collects campaigns whose spend only came from manual entry.
  const summary = useMemo(() => {
    const agg = (names: string[], spendOf: (n: string) => number) => names.reduce(
      (a, n) => { a.spend += spendOf(n); a.revenue += rev[n]?.revenue || 0; a.orders += rev[n]?.orders || 0; return a; },
      { spend: 0, revenue: 0, orders: 0 },
    );
    const rows = activeLive.map((p) => ({ name: p.name, ...agg(Object.keys(p.d!.byCampaign!), (n) => p.d!.byCampaign![n].cost || 0) }));
    const manual = spend?.spendByCampaign || {};
    const manualNames = Object.keys(manual).filter((n) => !liveNames.has(n));
    if (manualNames.length) rows.push({ name: 'Manual', ...agg(manualNames, (n) => manual[n] || 0) });
    const total = rows.reduce((a, r) => ({ spend: a.spend + r.spend, revenue: a.revenue + r.revenue, orders: a.orders + r.orders }), { spend: 0, revenue: 0, orders: 0 });
    return { rows, total };
  }, [activeLive, spend, rev, liveNames]);

  // Channel/placement breakdown — spend, impressions, clicks per channel
  // (YouTube / Search / Display / Facebook / Instagram / …). No revenue/ROAS:
  // sales are attributed by utm_campaign, not by placement.
  const channels = useMemo(() => {
    const out: Array<{ label: string; cost: number; impressions: number; clicks: number }> = [];
    for (const p of activeLive) {
      for (const [label, v] of Object.entries(p.d!.byChannel || {})) {
        out.push({ label: `${p.name} · ${label}`, cost: v.cost, impressions: v.impressions, clicks: v.clicks });
      }
    }
    return out.sort((a, b) => b.cost - a.cost);
  }, [activeLive]);

  // Daily spend (manual + every live source) and attributed revenue, merged by day.
  const trend = useMemo(() => {
    const sByDay: Record<string, number> = {};
    for (const d of spend?.daily || []) sByDay[d.day] = (sByDay[d.day] || 0) + d.spend;
    for (const p of activeLive) for (const d of p.d!.daily || []) sByDay[d.day] = (sByDay[d.day] || 0) + d.cost;
    const rByDay: Record<string, number> = {};
    for (const d of analytics?.attributedRevenueDaily || []) rByDay[d.day] = (rByDay[d.day] || 0) + d.revenue;
    const allDays = Array.from(new Set([...Object.keys(sByDay), ...Object.keys(rByDay)])).sort((a, b) => a.localeCompare(b));
    const rows = allDays.map((day) => ({ day, spend: sByDay[day] || 0, revenue: rByDay[day] || 0 }));
    const max = Math.max(1, ...rows.map((r) => Math.max(r.spend, r.revenue)));
    return { rows, max };
  }, [spend, activeLive, analytics]);
  const maxPlatSpend = Math.max(1, ...summary.rows.map((r) => r.spend));
  const maxChanSpend = Math.max(1, ...channels.map((c) => c.cost));

  const rows: Row[] = useMemo(() => {
    const names = new Set<string>(Object.keys(effSpend));
    for (const n of Object.keys(rev)) if (n !== '(none)' && effSpend[n] != null) names.add(n);
    return Array.from(names).map((name) => {
      const r = rev[name] || { views: 0, buy: 0, orders: 0, revenue: 0 };
      return { campaign: name, spend: effSpend[name] || 0, views: r.views, buy: r.buy, orders: r.orders, revenue: r.revenue };
    }).sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
  }, [effSpend, rev]);

  const totalSpend = useMemo(() => Object.values(effSpend).reduce((s, v) => s + v, 0), [effSpend]);
  const adRevenue = useMemo(() => rows.reduce((s, r) => s + r.revenue, 0), [rows]);
  const adOrders = useMemo(() => rows.reduce((s, r) => s + r.orders, 0), [rows]);
  const maxDaily = Math.max(1, ...(spend?.daily || []).map((d) => d.spend));

  async function post(body: unknown) {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/ad-spend?key=' + encodeURIComponent(token), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || ('Failed (' + r.status + ')')); return false; }
      setMsg('Saved ✓'); onChanged(); return true;
    } catch { setMsg('Network error'); return false; }
    finally { setBusy(false); }
  }

  async function addOne() {
    if (!c.trim() || !amt.trim()) { setMsg('Campaign and amount required.'); return; }
    const ok = await post({ campaign: c.trim(), day, spend: amt });
    if (ok) { setC(''); setAmt(''); }
  }

  // Parse a Google Ads CSV/TSV paste. Accepts "Campaign, Cost" or
  // "Campaign, Date, Cost" (comma or tab). Skips header + non-numeric rows.
  function parseCsv(text: string): Array<{ campaign: string; day?: string; spend: string }> {
    const out: Array<{ campaign: string; day?: string; spend: string }> = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim(); if (!t) continue;
      const cols = (t.includes('\t') ? t.split('\t') : t.split(',')).map((x) => x.trim());
      if (cols.length < 2) continue;
      const campaign = cols[0];
      if (!campaign || campaign.toLowerCase() === 'campaign') continue;
      const last = cols[cols.length - 1];
      if (!/[0-9]/.test(last)) continue;                    // last cell must be a cost
      const maybeDate = cols.length >= 3 ? cols[1] : '';
      const day = /^\d{4}-\d{2}-\d{2}$/.test(maybeDate) ? maybeDate : undefined;
      out.push({ campaign, day, spend: last });
    }
    return out;
  }

  async function addCsv() {
    const parsed = parseCsv(csv);
    if (!parsed.length) { setMsg('No rows parsed — need "Campaign, Cost" per line.'); return; }
    const ok = await post({ rows: parsed, day: csvDay });
    if (ok) setCsv('');
  }

  const inp: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, padding: '8px 10px', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none' };
  const btn: React.CSSProperties = { background: 'linear-gradient(135deg,var(--iris),var(--iris-deep))', color: '#0c1024', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 };

  const statusOf = (p: { name: string; d: LiveAdsData | null }) => {
    const d = p.d;
    if (d && d.configured && !d.error && d.byCampaign) return { dot: '●', color: 'var(--good)', text: `${p.name} live` };
    if (d && d.error) return { dot: '⚠', color: 'var(--warn)', text: `${p.name} error` };
    if (d && !d.configured) return { dot: '○', color: 'var(--ink3)', text: `${p.name} not configured` };
    return { dot: '○', color: 'var(--ink3)', text: `${p.name} —` };
  };
  const errorNotes = platforms.filter((p) => p.d?.error).map((p) => `${p.name}: ${p.d!.error}`);

  return (
    <div>
      {spend?.error && <div className="hqerr">Spend store: {spend.error}</div>}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: 'var(--ink3)' }}>Sources:</span>
        {platforms.map((p) => { const s = statusOf(p); return <span key={p.name} style={{ color: s.color }}>{s.dot} {s.text}</span>; })}
        {!liveAny && <span style={{ color: 'var(--ink3)' }}>· showing manual entry</span>}
      </div>
      {errorNotes.map((n) => <div key={n} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--warn)', marginBottom: 2 }}>⚠ {n}</div>)}
      <div style={{ marginBottom: 12 }} />

      <div className="grid">
        <div className="kpi hero"><div className="k">Ad spend</div><div className="v">{money(totalSpend)}</div><div className="sub">entered · last {days}d</div></div>
        <div className="kpi hero"><div className="k">Blended ROAS</div><div className="v" style={{ color: roasGood(adRevenue, totalSpend) ? 'var(--good)' : totalSpend > 0 ? 'var(--warn)' : 'var(--ink)' }}>{roasStr(adRevenue, totalSpend)}</div><div className="sub">attributed rev ÷ spend</div></div>
        <div className="kpi"><div className="k">Ad revenue</div><div className="v">{money(adRevenue)}</div><div className="sub">campaigns with spend</div></div>
        <div className="kpi"><div className="k">Orders</div><div className="v">{nf(adOrders)}</div><div className="sub">paid, from ad campaigns</div></div>
        <div className="kpi"><div className="k">CPA</div><div className="v">{adOrders > 0 ? money(totalSpend / adOrders) : '—'}</div><div className="sub">cost per order</div></div>
        {liveAny && <div className="kpi"><div className="k">Impressions</div><div className="v">{nf(liveImpr)}</div><div className="sub">live · last {days}d</div></div>}
        {liveAny && <div className="kpi"><div className="k">Clicks</div><div className="v">{nf(liveClicks)}</div><div className="sub">live · CPC {liveClicks > 0 ? money(totalSpend / liveClicks) : '—'}</div></div>}
      </div>

      {liveAny && (
        <div className="panel">
          <h2>Spend &amp; revenue over time — last {days}d</h2>
          {trend.rows.length > 0 ? (
            <>
              <div style={{ position: 'relative' }}>
                <div className="chart">
                  {trend.rows.map((r) => (
                    <div className="col" key={r.day} title={`${r.day} · spend ${money(r.spend)} · revenue ${money(r.revenue)}`}>
                      <div className="bw"><div className="b" style={{ height: (r.spend / trend.max) * 100 + '%' }} /></div>
                      <div className="dd">{r.day.slice(5)}</div>
                    </div>
                  ))}
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 'calc(100% - 16px)', pointerEvents: 'none', overflow: 'visible' }}>
                  <polyline fill="none" stroke="var(--good)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
                    points={trend.rows.map((r, i) => `${trend.rows.length > 1 ? (i / (trend.rows.length - 1)) * 100 : 50},${100 - (r.revenue / trend.max) * 100}`).join(' ')} />
                </svg>
              </div>
              <div style={{ display: 'flex', gap: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)', marginTop: 8 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'linear-gradient(180deg,var(--iris),var(--iris-deep))', borderRadius: 2, verticalAlign: 'middle', marginRight: 5 }} />Spend (bars)</span>
                <span><span style={{ display: 'inline-block', width: 16, borderTop: '2px solid var(--good)', verticalAlign: 'middle', marginRight: 5 }} />Attributed revenue (line)</span>
              </div>
            </>
          ) : (
            <div className="hqempty">No daily data yet — spend bars and the revenue line plot here once campaigns deliver and sales come in.</div>
          )}
        </div>
      )}

      {summary.rows.length > 0 && (
        <div className="panel scroll">
          <h2>All platforms — spend → revenue → ROAS · last {days}d</h2>
          <table>
            <thead><tr>
              <th>Platform</th>
              <th style={{ textAlign: 'right' }}>Spend</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
              <th style={{ textAlign: 'right' }}>ROAS</th>
              <th style={{ textAlign: 'right' }}>Orders</th>
              <th style={{ textAlign: 'right' }}>CPA</th>
            </tr></thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.name}>
                  <td className="name">{r.name}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.spend)}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.revenue)}</td>
                  <td style={{ textAlign: 'right', color: roasGood(r.revenue, r.spend) ? 'var(--good)' : r.spend > 0 ? 'var(--warn)' : 'var(--ink3)' }}>{roasStr(r.revenue, r.spend)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(r.orders)}</td>
                  <td style={{ textAlign: 'right' }}>{r.orders > 0 ? money(r.spend / r.orders) : '—'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--line2)' }}>
                <td className="name" style={{ color: 'var(--ink)' }}>All platforms</td>
                <td style={{ textAlign: 'right' }}>{money(summary.total.spend)}</td>
                <td style={{ textAlign: 'right' }}>{money(summary.total.revenue)}</td>
                <td style={{ textAlign: 'right', color: roasGood(summary.total.revenue, summary.total.spend) ? 'var(--good)' : summary.total.spend > 0 ? 'var(--warn)' : 'var(--ink3)' }}>{roasStr(summary.total.revenue, summary.total.spend)}</td>
                <td style={{ textAlign: 'right' }}>{nf(summary.total.orders)}</td>
                <td style={{ textAlign: 'right' }}>{summary.total.orders > 0 ? money(summary.total.spend / summary.total.orders) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {liveAny && (
        <div className="panel">
          <h2>Spend mix — last {days}d</h2>
          <div className="cols2">
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>By platform</div>
              {summary.rows.every((r) => r.spend === 0)
                ? <div className="hqempty">No spend yet.</div>
                : summary.rows.map((r) => <HBar key={r.name} label={r.name} value={r.spend} max={maxPlatSpend} note={`${money(r.spend)} · ROAS ${roasStr(r.revenue, r.spend)}`} />)}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>By channel</div>
              {channels.length === 0
                ? <div className="hqempty">No channel spend yet.</div>
                : channels.map((c) => <HBar key={c.label} label={c.label} value={c.cost} max={maxChanSpend} note={money(c.cost)} />)}
            </div>
          </div>
        </div>
      )}

      {liveAny && (
        <div className="panel scroll">
          <h2>Spend by channel — last {days}d</h2>
          <table>
            <thead><tr>
              <th>Channel</th>
              <th style={{ textAlign: 'right' }}>Spend</th>
              <th style={{ textAlign: 'right' }}>Impressions</th>
              <th style={{ textAlign: 'right' }}>Clicks</th>
              <th style={{ textAlign: 'right' }}>CPC</th>
            </tr></thead>
            <tbody>
              {channels.length === 0 && (
                <tr><td className="name" colSpan={5}>No channel spend yet — YouTube / Search / Display and Facebook / Instagram rows appear here once campaigns deliver.</td></tr>
              )}
              {channels.map((c) => (
                <tr key={c.label}>
                  <td className="name">{c.label}</td>
                  <td style={{ textAlign: 'right' }}>{money(c.cost)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(c.impressions)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(c.clicks)}</td>
                  <td style={{ textAlign: 'right' }}>{c.clicks > 0 ? money(c.cost / c.clicks) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 10 }}>
            Instagram vs Facebook and YouTube vs Search are broken out here. Revenue/ROAS stays in the summary above — sales are attributed by campaign (utm_campaign), which can&apos;t be split across placements.
          </div>
        </div>
      )}

      {(spend?.daily || []).length > 0 && (
        <div className="panel"><h2>Daily spend — last {days}d</h2>
          <div className="chart">
            {spend!.daily.map((d) => (
              <div className="col" key={d.day} title={`${d.day} · ${money(d.spend)}`}>
                <div className="bw"><div className="b" style={{ height: (d.spend / maxDaily) * 100 + '%' }} /></div>
                <div className="dd">{d.day.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel scroll">
        <h2>By campaign — spend → revenue → ROAS</h2>
        <table>
          <thead><tr>
            <th>Campaign</th>
            <th style={{ textAlign: 'right' }}>Spend</th>
            <th style={{ textAlign: 'right' }}>Visits</th>
            <th style={{ textAlign: 'right' }}>Buy clicks</th>
            <th style={{ textAlign: 'right' }}>Orders</th>
            <th style={{ textAlign: 'right' }}>Revenue</th>
            <th style={{ textAlign: 'right' }}>ROAS</th>
            <th style={{ textAlign: 'right' }}>CPA</th>
            <th style={{ textAlign: 'right' }}>Cost/visit</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td className="name" colSpan={9}>No spend entered yet. Add a campaign below, or paste a Google Ads CSV.</td></tr> :
              rows.map((r) => (
                <tr key={r.campaign}>
                  <td className="name">{r.campaign}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.spend)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(r.views)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(r.buy)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(r.orders)}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.revenue)}</td>
                  <td style={{ textAlign: 'right', color: roasGood(r.revenue, r.spend) ? 'var(--good)' : r.spend > 0 ? 'var(--warn)' : 'var(--ink3)' }}>{roasStr(r.revenue, r.spend)}</td>
                  <td style={{ textAlign: 'right' }}>{r.orders > 0 ? money(r.spend / r.orders) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.views > 0 ? money(r.spend / r.views) : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 10 }}>
          Spend is what you enter here; revenue is real Stripe $ attributed to the matching <code>utm_campaign</code>. Match is by exact campaign name — tag your Google ad URLs with the same name you enter.
        </div>
      </div>

      <div className="cols2">
        <div className="panel"><h2>Add / update a campaign&apos;s spend</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={inp} placeholder="campaign name (= utm_campaign)" value={c} onChange={(e) => setC(e.target.value)} />
            <div style={{ display: 'flex', gap: 10 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="amount e.g. 150.00" value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" />
              <input style={{ ...inp, flex: 1 }} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <button style={btn} disabled={busy} onClick={addOne}>Save spend</button>
          </div>
        </div>

        <div className="panel"><h2>Paste Google Ads CSV</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea style={{ ...inp, minHeight: 92, resize: 'vertical' }} placeholder={'Campaign, Cost\nBrand Search, 142.50\nCompetitor, 88.00'} value={csv} onChange={(e) => setCsv(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)' }}>date for rows w/o one:</span>
              <input style={{ ...inp, flex: 1 }} type="date" value={csvDay} onChange={(e) => setCsvDay(e.target.value)} />
            </div>
            <button style={btn} disabled={busy} onClick={addCsv}>Import CSV</button>
          </div>
        </div>
      </div>

      {msg && <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: msg.includes('✓') ? 'var(--good)' : 'var(--bad)', marginTop: 4 }}>{msg}</div>}
    </div>
  );
}
