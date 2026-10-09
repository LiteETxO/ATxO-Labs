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

const nf = (n: number) => (n || 0).toLocaleString();
const money = (n: number) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const roasStr = (rev: number, spend: number) => (spend > 0 ? (rev / spend).toFixed(2) + '×' : '—');
const roasGood = (rev: number, spend: number) => spend > 0 && rev / spend >= 1;

type Row = {
  campaign: string; spend: number; views: number; buy: number; orders: number; revenue: number;
};

export default function AdsView({
  days, analytics, spend, token, onChanged,
}: {
  days: number;
  analytics: AnalyticsData | null;
  spend: AdSpendData | null;
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

  const rows: Row[] = useMemo(() => {
    const sb = spend?.spendByCampaign || {};
    const names = new Set<string>(Object.keys(sb));
    // include revenue-only ad-looking campaigns too (spend may lag), but keep (none) out
    for (const n of Object.keys(rev)) if (n !== '(none)' && (sb[n] != null)) names.add(n);
    return Array.from(names).map((name) => {
      const r = rev[name] || { views: 0, buy: 0, orders: 0, revenue: 0 };
      return { campaign: name, spend: sb[name] || 0, views: r.views, buy: r.buy, orders: r.orders, revenue: r.revenue };
    }).sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
  }, [spend, rev]);

  const totalSpend = spend?.totalSpend || 0;
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

  return (
    <div>
      {spend?.error && <div className="hqerr">Spend store: {spend.error}</div>}

      <div className="grid">
        <div className="kpi hero"><div className="k">Ad spend</div><div className="v">{money(totalSpend)}</div><div className="sub">entered · last {days}d</div></div>
        <div className="kpi hero"><div className="k">Blended ROAS</div><div className="v" style={{ color: roasGood(adRevenue, totalSpend) ? 'var(--good)' : totalSpend > 0 ? 'var(--warn)' : 'var(--ink)' }}>{roasStr(adRevenue, totalSpend)}</div><div className="sub">attributed rev ÷ spend</div></div>
        <div className="kpi"><div className="k">Ad revenue</div><div className="v">{money(adRevenue)}</div><div className="sub">campaigns with spend</div></div>
        <div className="kpi"><div className="k">Orders</div><div className="v">{nf(adOrders)}</div><div className="sub">paid, from ad campaigns</div></div>
        <div className="kpi"><div className="k">CPA</div><div className="v">{adOrders > 0 ? money(totalSpend / adOrders) : '—'}</div><div className="sub">cost per order</div></div>
      </div>

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
