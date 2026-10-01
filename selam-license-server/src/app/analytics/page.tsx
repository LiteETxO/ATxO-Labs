// Selam Analytics — token-gated first-party landing dashboard over /api/analytics
// (Neon landing_events, collected by /api/track). No Vercel login needed.
// Same periwinkle theme + HQ token as /hq.
'use client';

import { useCallback, useEffect, useState } from 'react';

const CSS = `
:root{
  --bg:#0a0b14;--bg2:#0e1019;--card:#141726;--card2:#191d2e;
  --line:rgba(202,210,240,.10);--line2:rgba(202,210,240,.18);
  --ink:#f2f4fb;--ink2:#b6bbd2;--ink3:#7d829e;
  --iris:#8aa4ea;--iris-soft:#c1c7e7;--iris-deep:#5f7ac6;
  --good:#7be3a4;--warn:#f2c65c;--bad:#f28a9e;
  --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}
*{margin:0;padding:0;box-sizing:border-box}
.hq{background:var(--bg);color:var(--ink);min-height:100vh;padding:24px;line-height:1.5;
  font-family:var(--font-sans),system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.hqwrap{max-width:1040px;margin:0 auto}
.mono{font-family:var(--mono)}
.gate{max-width:380px;margin:16vh auto 0;background:var(--card);border:1px solid var(--line2);border-radius:16px;padding:28px}
.gate h1{font-size:19px;margin-bottom:6px}.gate p{color:var(--ink3);font-size:14px;margin-bottom:18px}
.gate input{width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:11px 13px;color:var(--ink);font-family:var(--mono);font-size:13px;outline:none}
.gate input:focus{border-color:var(--iris)}
.gate button{width:100%;margin-top:12px;background:linear-gradient(135deg,var(--iris),var(--iris-deep));color:#0c1024;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer}
.gate .err{color:var(--bad);font-size:13px;margin-top:10px;min-height:18px}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.head h1{font-size:20px}.head h1 span{color:var(--iris)}
.meta{font-family:var(--mono);font-size:12px;color:var(--ink3);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.meta .dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 8px var(--good);display:inline-block}
.meta button,.meta select{background:none;border:1px solid var(--line2);color:var(--ink2);border-radius:8px;padding:5px 10px;font-family:var(--mono);font-size:11px;cursor:pointer}
.err{background:rgba(242,138,158,.1);border:1px solid rgba(242,138,158,.4);color:#f6b7c4;border-radius:12px;padding:11px 15px;margin-bottom:16px;font-size:13px;font-family:var(--mono)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px}
.kpi.hero{grid-column:span 2;background:linear-gradient(180deg,var(--card),var(--card2))}
.kpi .k{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.kpi .v{font-size:27px;font-weight:700;margin-top:8px;font-variant-numeric:tabular-nums}
.kpi.hero .v{font-size:34px}
.kpi .sub{font-family:var(--mono);font-size:11px;color:var(--ink3);margin-top:4px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:20px}
.panel h2{font-size:13px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);margin-bottom:16px;font-weight:500}
.chart{display:flex;align-items:flex-end;gap:5px;height:130px}
.col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;min-width:0}
.col .bw{width:100%;flex:1;display:flex;align-items:flex-end}
.col .b{width:100%;background:linear-gradient(180deg,var(--iris),var(--iris-deep));border-radius:5px 5px 0 0;min-height:2px}
.col .d{font-family:var(--mono);font-size:9px;color:var(--ink3);white-space:nowrap}
.funnel{display:flex;flex-direction:column;gap:10px}
.fstep{display:flex;align-items:center;gap:12px}
.fstep .lbl{font-family:var(--mono);font-size:12px;color:var(--ink2);width:140px;flex:none}
.fstep .bar{flex:1;height:26px;background:var(--bg2);border-radius:7px;overflow:hidden}
.fstep .fill{height:100%;background:linear-gradient(90deg,var(--iris-deep),var(--iris));border-radius:7px;min-width:2px}
.fstep .n{font-family:var(--mono);font-size:12px;color:var(--ink);width:96px;text-align:right;flex:none;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);text-align:left;padding:7px 10px;font-weight:500}
td{padding:8px 10px;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
td.name{font-family:var(--mono);font-size:12px;color:var(--ink2)}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){.cols2{grid-template-columns:1fr}.kpi.hero{grid-column:span 2}}
.scroll{overflow-x:auto}
`;

type Data = {
  generatedAt: string; days: number;
  totals: { views: number; visitors: number; events: number; byEvent: Record<string, number> };
  daily: Array<{ d: string; views: number; visitors: number }>;
  ctas: Array<{ name: string; count: number }>;
  funnel: { views: number; engaged: number; buy: number; crypto: number };
  campaigns: Array<{ campaign: string; views: number; clicks: number; buy: number }>;
  content: Array<{ content: string; clicks: number }>;
  referrers: Array<{ ref: string; n: number }>;
  countries: Array<{ country: string; n: number }>;
  devices: Array<{ device: string; n: number }>;
  scroll: Array<{ depth: string; n: number }>;
};

const CTA_LABEL: Record<string, string> = {
  cta_buy: 'Buy / trial', cta_pay_crypto: 'Pay with crypto', cta_watch_live: 'Watch live',
  cta_watch_setup: 'Watch setup', cta_ask_selam: 'Ask Selam',
};
const nf = (n: number) => (n ?? 0).toLocaleString();

export default function Analytics() {
  const [token, setToken] = useState('');
  const [entered, setEntered] = useState(false);
  const [err, setErr] = useState('');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);

  const load = useCallback(async (tok: string, d: number) => {
    try {
      const r = await fetch(`/api/analytics?key=${encodeURIComponent(tok)}&days=${d}`, { cache: 'no-store' });
      if (r.status === 401) { setErr('Wrong token.'); setEntered(false); try { localStorage.removeItem('selamhq:key'); } catch {} return; }
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Failed to load.'); return; }
      setData(j); setErr(''); setEntered(true);
      try { localStorage.setItem('selamhq:key', tok); } catch {}
    } catch { setErr('Network error.'); }
  }, []);

  useEffect(() => {
    let stored = ''; try { stored = localStorage.getItem('selamhq:key') || ''; } catch {}
    if (stored) { setToken(stored); load(stored, days); }
  }, [load, days]);

  if (!entered) {
    return (
      <div className="hq"><style>{CSS}</style>
        <div className="gate">
          <h1>Selam <span style={{ color: 'var(--iris)' }}>Analytics</span></h1>
          <p>Enter the HQ token to view landing analytics.</p>
          <input type="password" placeholder="hq token" autoComplete="off" value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && token.trim()) load(token.trim(), days); }} />
          <button onClick={() => token.trim() && load(token.trim(), days)}>View</button>
          <div className="err">{err}</div>
        </div>
      </div>
    );
  }

  const d = data;
  const maxDaily = Math.max(1, ...(d?.daily || []).map((x) => x.views));
  const fmax = Math.max(1, d?.funnel.views || 1);
  const fw = (n: number) => `${Math.max(1, Math.round((n / fmax) * 100))}%`;

  return (
    <div className="hq"><style>{CSS}</style>
      <div className="hqwrap">
        <div className="head">
          <h1>Selam <span>Analytics</span> <span style={{ color: 'var(--ink3)', fontSize: 13 }}>· landing</span></h1>
          <div className="meta">
            <span><span className="dot" /> live</span>
            <select value={days} onChange={(e) => { const v = +e.target.value; setDays(v); load(token, v); }}>
              <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
            </select>
            <button onClick={() => load(token, days)}>↻ refresh</button>
            <a href="/hq" style={{ color: 'var(--ink3)', textDecoration: 'none' }}>→ /hq (revenue)</a>
          </div>
        </div>
        {err && <div className="err">{err}</div>}

        {d && (
          <>
            <div className="grid">
              <div className="kpi hero"><div className="k">Page views</div><div className="v">{nf(d.totals.views)}</div><div className="sub">last {d.days} days</div></div>
              <div className="kpi hero"><div className="k">Unique visitors</div><div className="v">{nf(d.totals.visitors)}</div><div className="sub">daily-hashed, cookieless</div></div>
              <div className="kpi"><div className="k">Buy clicks</div><div className="v">{nf(d.funnel.buy)}</div></div>
              <div className="kpi"><div className="k">Crypto clicks</div><div className="v">{nf(d.funnel.crypto)}</div></div>
              <div className="kpi"><div className="k">Engaged</div><div className="v">{nf(d.funnel.engaged)}</div><div className="sub">visitors w/ a CTA</div></div>
            </div>

            <div className="panel">
              <h2>Page views · daily</h2>
              <div className="chart">
                {d.daily.length === 0 && <span style={{ color: 'var(--ink3)', fontSize: 13 }} className="mono">No data yet — waiting for the first visits.</span>}
                {d.daily.map((x) => (
                  <div className="col" key={x.d} title={`${x.d}: ${x.views} views, ${x.visitors} visitors`}>
                    <div className="bw"><div className="b" style={{ height: `${(x.views / maxDaily) * 100}%` }} /></div>
                    <div className="d">{x.d.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Funnel</h2>
              <div className="funnel">
                <div className="fstep"><div className="lbl">Views</div><div className="bar"><div className="fill" style={{ width: fw(d.funnel.views) }} /></div><div className="n">{nf(d.funnel.views)}</div></div>
                <div className="fstep"><div className="lbl">Engaged (any CTA)</div><div className="bar"><div className="fill" style={{ width: fw(d.funnel.engaged) }} /></div><div className="n">{nf(d.funnel.engaged)}</div></div>
                <div className="fstep"><div className="lbl">Buy clicks</div><div className="bar"><div className="fill" style={{ width: fw(d.funnel.buy) }} /></div><div className="n">{nf(d.funnel.buy)}</div></div>
                <div className="fstep"><div className="lbl">Crypto clicks</div><div className="bar"><div className="fill" style={{ width: fw(d.funnel.crypto) }} /></div><div className="n">{nf(d.funnel.crypto)}</div></div>
              </div>
            </div>

            <div className="panel scroll">
              <h2>By campaign (utm_campaign)</h2>
              <table><thead><tr><th>Campaign</th><th>Views</th><th>CTA clicks</th><th>Buy</th></tr></thead>
                <tbody>{d.campaigns.length === 0 ? <tr><td className="name" colSpan={4}>No campaign traffic yet.</td></tr> :
                  d.campaigns.map((c) => <tr key={c.campaign}><td className="name">{c.campaign}</td><td>{nf(c.views)}</td><td>{nf(c.clicks)}</td><td>{nf(c.buy)}</td></tr>)}
                </tbody></table>
            </div>

            <div className="cols2">
              <div className="panel"><h2>CTA clicks</h2>
                <table><tbody>{d.ctas.length === 0 ? <tr><td className="name">None yet.</td></tr> :
                  d.ctas.map((c) => <tr key={c.name}><td className="name">{CTA_LABEL[c.name] || c.name}</td><td style={{ textAlign: 'right' }}>{nf(c.count)}</td></tr>)}
                </tbody></table>
              </div>
              <div className="panel"><h2>Top ad creatives (utm_content)</h2>
                <table><tbody>{d.content.length === 0 ? <tr><td className="name">None yet.</td></tr> :
                  d.content.map((c) => <tr key={c.content}><td className="name">{c.content}</td><td style={{ textAlign: 'right' }}>{nf(c.clicks)}</td></tr>)}
                </tbody></table>
              </div>
            </div>

            <div className="cols2">
              <div className="panel"><h2>Referrers</h2>
                <table><tbody>{d.referrers.map((r) => <tr key={r.ref}><td className="name">{r.ref}</td><td style={{ textAlign: 'right' }}>{nf(r.n)}</td></tr>)}</tbody></table>
              </div>
              <div className="panel"><h2>Countries</h2>
                <table><tbody>{d.countries.map((c) => <tr key={c.country}><td className="name">{c.country}</td><td style={{ textAlign: 'right' }}>{nf(c.n)}</td></tr>)}</tbody></table>
              </div>
            </div>

            <div className="cols2">
              <div className="panel"><h2>Devices</h2>
                <table><tbody>{d.devices.map((c) => <tr key={c.device}><td className="name">{c.device}</td><td style={{ textAlign: 'right' }}>{nf(c.n)}</td></tr>)}</tbody></table>
              </div>
              <div className="panel"><h2>Scroll depth</h2>
                <table><tbody>{d.scroll.map((c) => <tr key={c.depth}><td className="name">{c.depth}</td><td style={{ textAlign: 'right' }}>{nf(c.n)}</td></tr>)}</tbody></table>
              </div>
            </div>

            <div style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              generated {d.generatedAt} · first-party · cookieless
            </div>
          </>
        )}
      </div>
    </div>
  );
}
