// Selam HQ — unified token-gated dashboard. Two tabs:
//   Revenue  → real Stripe + Neon sales (/api/metrics)
//   Landing  → first-party traffic + engagement (/api/analytics)
// One gate, one token (localStorage 'selamhq:key'), one periwinkle theme.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import RevenueView, { Metrics } from './RevenueView';
import LandingView, { AnalyticsData } from './LandingView';
import AskUsageView, { AskUsage } from './AskUsageView';
import BroadcastView, { BroadcastData } from './BroadcastView';
import AdsView, { AdSpendData, LiveAdsData } from './AdsView';

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
.hq .mono{font-family:var(--mono)}
.hqgate{max-width:380px;margin:16vh auto 0;background:var(--card);border:1px solid var(--line2);border-radius:16px;padding:28px}
.hqgate h1{font-size:19px;margin-bottom:6px}.hqgate p{color:var(--ink3);font-size:14px;margin-bottom:18px}
.hqgate input{width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:11px 13px;color:var(--ink);font-family:var(--mono);font-size:13px;outline:none}
.hqgate input:focus{border-color:var(--iris)}
.hqgate button{width:100%;margin-top:12px;background:linear-gradient(135deg,var(--iris),var(--iris-deep));color:#0c1024;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer}
.hqgate .err{color:var(--bad);font-size:13px;margin-top:10px;min-height:18px}
.hqhead{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.hqhead h1{font-size:20px}.hqhead h1 span{color:var(--iris)}
.hqtop{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.tabs{display:inline-flex;gap:4px;background:var(--card);border:1px solid var(--line2);border-radius:10px;padding:3px}
.tabs button{background:none;border:none;color:var(--ink3);font-family:var(--mono);font-size:12px;padding:7px 14px;border-radius:8px;cursor:pointer;letter-spacing:.03em}
.tabs button.on{background:linear-gradient(135deg,var(--iris),var(--iris-deep));color:#0c1024;font-weight:700}
.hqmeta{font-family:var(--mono);font-size:12px;color:var(--ink3);display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.hqmeta .dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 8px var(--good);display:inline-block}
.hqmeta button,.hqmeta select{background:none;border:1px solid var(--line2);color:var(--ink2);border-radius:8px;padding:5px 10px;font-family:var(--mono);font-size:11px;cursor:pointer}
.hqerr{background:rgba(242,138,158,.1);border:1px solid rgba(242,138,158,.4);color:#f6b7c4;border-radius:12px;padding:11px 15px;margin-bottom:16px;font-size:13px;font-family:var(--mono)}
.hqloading{color:var(--ink3);font-family:var(--mono);font-size:13px;padding:40px;text-align:center}

/* Revenue tab */
.hqgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.hqkpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px}
.hqkpi.hero{grid-column:span 2;background:linear-gradient(180deg,var(--card),var(--card2))}
.hqkpi .k{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.hqkpi .v{font-size:27px;font-weight:700;margin-top:8px;font-variant-numeric:tabular-nums}
.hqkpi.hero .v{font-size:34px}
.hqkpi .v small{font-size:14px;color:var(--ink3);font-weight:500}
.hqkpi .sub{font-family:var(--mono);font-size:11px;color:var(--ink3);margin-top:4px}
.hqkpi .up{color:var(--good)}
.hqpanel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:20px}
.hqpanel h2{font-size:13px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);margin-bottom:16px;font-weight:500}
.hqchart{display:flex;align-items:flex-end;gap:6px;height:120px}
.hqcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end;min-width:0}
.hqcol .bw{width:100%;flex:1;display:flex;align-items:flex-end}
.hqcol .b{width:100%;background:linear-gradient(180deg,var(--iris),var(--iris-deep));border-radius:5px 5px 0 0;min-height:2px}
.hqcol.today .b{background:linear-gradient(180deg,var(--iris-soft),var(--iris))}
.hqcol .d{font-family:var(--mono);font-size:9px;color:var(--ink3);white-space:nowrap}
.hqfunnel{display:flex;flex-direction:column;gap:10px}
.hqstage{display:flex;align-items:center;gap:12px}
.hqstage .lab{font-size:13px;color:var(--ink2);width:90px;flex:none}
.hqstage .track{flex:1;height:26px;background:var(--card2);border-radius:8px;overflow:hidden}
.hqstage .fill{height:100%;background:linear-gradient(90deg,var(--iris),var(--iris-soft));border-radius:8px;display:flex;align-items:center;padding-left:10px;font-family:var(--mono);font-size:12px;font-weight:700;color:#0c1024;min-width:38px}
.hqcols{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:720px){.hqcols{grid-template-columns:1fr}.hqkpi.hero{grid-column:span 2}}
.hqfeed{display:flex;flex-direction:column}
.hqrow{display:flex;gap:10px;align-items:center;padding:9px 2px;border-bottom:1px solid var(--line);font-size:13.5px}
.hqrow:last-child{border-bottom:none}
.hqrow .t{font-family:var(--mono);font-size:11px;color:var(--ink3);white-space:nowrap;min-width:52px}
.hqrow .em{color:var(--ink2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.badge{font-family:var(--mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 7px;border-radius:6px;white-space:nowrap}
.badge.perpetual{background:rgba(123,227,164,.16);color:#9bedb9}
.badge.trial{background:rgba(138,164,234,.16);color:var(--iris-soft)}
.badge.update_pass{background:rgba(242,198,92,.16);color:#f5d98a}
.badge.revoked{background:rgba(242,138,158,.16);color:#f6b7c4}
.hqempty{color:var(--ink3);font-size:13px;padding:8px 0}

/* Landing tab */
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
.col .dd{font-family:var(--mono);font-size:9px;color:var(--ink3);white-space:nowrap}
.funnel{display:flex;flex-direction:column;gap:10px}
.fstep{display:flex;align-items:center;gap:12px}
.fstep .lbl{font-family:var(--mono);font-size:12px;color:var(--ink2);width:140px;flex:none}
.fstep .bar{flex:1;height:26px;background:var(--bg2);border-radius:7px;overflow:hidden}
.fstep .xfill{height:100%;background:linear-gradient(90deg,var(--iris-deep),var(--iris));border-radius:7px;min-width:2px}
.fstep .n{font-family:var(--mono);font-size:12px;color:var(--ink);width:96px;text-align:right;flex:none;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);text-align:left;padding:7px 10px;font-weight:500}
td{padding:8px 10px;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
td.name{font-family:var(--mono);font-size:12px;color:var(--ink2)}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){.cols2{grid-template-columns:1fr}}
.scroll{overflow-x:auto}
@media(max-width:520px){.hq{padding:14px}.hqkpi .v{font-size:22px}.kpi .v{font-size:22px}}
`;

type Tab = 'revenue' | 'landing' | 'ads' | 'ask' | 'broadcast';

export default function HQ() {
  const [token, setToken] = useState('');
  const [entered, setEntered] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('revenue');
  // 'full' = owner (all tabs incl. Revenue); 'marketing' = scoped token
  // (marketing tabs only, Revenue hidden). Determined by /api/metrics:
  // 200 → full, 403 → marketing, 401 → wrong token.
  const [role, setRole] = useState<'full' | 'marketing'>('full');
  const roleRef = useRef<'full' | 'marketing'>('full');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [adata, setAdata] = useState<AnalyticsData | null>(null);
  const [ask, setAsk] = useState<AskUsage | null>(null);
  const [bcast, setBcast] = useState<BroadcastData | null>(null);
  const [adSpend, setAdSpend] = useState<AdSpendData | null>(null);
  const [gads, setGads] = useState<LiveAdsData | null>(null);
  const [metaAds, setMetaAds] = useState<LiveAdsData | null>(null);
  const [days, setDays] = useState(30);
  const [live, setLive] = useState(true);
  const [updated, setUpdated] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMetrics = useCallback(async (tok: string): Promise<'full' | 'marketing' | 'bad'> => {
    try {
      const r = await fetch('/api/metrics?key=' + encodeURIComponent(tok), { cache: 'no-store' });
      if (r.status === 401) { setErr('Wrong token.'); setEntered(false); try { localStorage.removeItem('selamhq:key'); } catch {} return 'bad'; }
      if (r.status === 403) {
        // Valid marketing-scoped token — revenue is owner-only. Mark the
        // role, keep the session, and let the caller route to a safe tab.
        roleRef.current = 'marketing'; setRole('marketing');
        setLive(true); setUpdated(new Date().toLocaleTimeString()); setErr('');
        return 'marketing';
      }
      const d = await r.json();
      roleRef.current = 'full'; setRole('full');
      setMetrics(d); setLive(true); setUpdated(new Date().toLocaleTimeString());
      return 'full';
    } catch { setLive(false); return roleRef.current; }
  }, []);

  const loadLanding = useCallback(async (tok: string, d: number) => {
    try {
      const r = await fetch(`/api/analytics?key=${encodeURIComponent(tok)}&days=${d}`, { cache: 'no-store' });
      if (r.status === 401) { setErr('Wrong token.'); setEntered(false); try { localStorage.removeItem('selamhq:key'); } catch {} return; }
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Failed to load analytics.'); return; }
      setAdata(j); setErr('');
    } catch { setLive(false); }
  }, []);

  const loadAsk = useCallback(async (tok: string) => {
    try {
      const r = await fetch('/api/ask-usage?key=' + encodeURIComponent(tok), { cache: 'no-store' });
      if (r.status === 401) { setErr('Wrong token.'); setEntered(false); try { localStorage.removeItem('selamhq:key'); } catch {} return; }
      const j = await r.json();
      if (!r.ok) { setAsk({ configured: true, error: j.error || ('Failed (' + r.status + ')') }); return; }
      setAsk(j); setErr('');
    } catch { setLive(false); }
  }, []);

  const loadBcast = useCallback(async (tok: string) => {
    try {
      const r = await fetch('/api/broadcast?key=' + encodeURIComponent(tok), { cache: 'no-store' });
      if (r.status === 401) { setErr('Wrong token.'); setEntered(false); try { localStorage.removeItem('selamhq:key'); } catch {} return; }
      const j = await r.json();
      if (!r.ok) { setBcast({ error: j.error || ('Failed (' + r.status + ')'), broadcasts: [], aggregate: { count: 0, avgMin: 0, totalMin: 0, peakViewers: 0, questions: 0, cost: 0, segments: {} } }); return; }
      setBcast(j); setErr('');
    } catch { setLive(false); }
  }, []);

  const loadAdSpend = useCallback(async (tok: string, d: number) => {
    // Ads ROAS needs campaign revenue (analytics) + spend (manual ad-spend
    // and/or live Google Ads API). Load all three for the window.
    if (!adata) loadLanding(tok, d);
    try {
      const r = await fetch(`/api/ad-spend?key=${encodeURIComponent(tok)}&days=${d}`, { cache: 'no-store' });
      if (r.status === 401) { setErr('Wrong token.'); setEntered(false); try { localStorage.removeItem('selamhq:key'); } catch {} return; }
      const j = await r.json();
      if (!r.ok) { setAdSpend({ days: d, totalSpend: 0, spendByCampaign: {}, daily: [], error: j.error || ('Failed (' + r.status + ')') }); }
      else { setAdSpend(j); setErr(''); }
    } catch { setLive(false); }
    try {
      const rg = await fetch(`/api/google-ads?key=${encodeURIComponent(tok)}&days=${d}`, { cache: 'no-store' });
      if (rg.status !== 401) setGads(await rg.json());
    } catch { /* live spend is optional; manual stays the fallback */ }
    try {
      const rm = await fetch(`/api/meta-ads?key=${encodeURIComponent(tok)}&days=${d}`, { cache: 'no-store' });
      if (rm.status !== 401) setMetaAds(await rm.json());
    } catch { /* live spend is optional; manual stays the fallback */ }
  }, [adata, loadLanding]);

  const start = useCallback(async (tok: string, initialTab: Tab) => {
    setToken(tok); setEntered(true);
    try { localStorage.setItem('selamhq:key', tok); } catch {}
    try { history.replaceState({}, '', location.pathname); } catch {}
    const rl = await loadMetrics(tok);
    if (rl === 'bad') return;   // wrong token — already kicked back to gate
    // Marketing role can't see Revenue; land them on the first marketing tab.
    let effTab = initialTab;
    if (rl === 'marketing' && initialTab === 'revenue') { effTab = 'landing'; setTab('landing'); }
    if (effTab === 'landing') loadLanding(tok, days);
    if (effTab === 'ads') loadAdSpend(tok, days);
    if (effTab === 'ask') loadAsk(tok);
    if (effTab === 'broadcast') loadBcast(tok);
    if (timer.current) clearInterval(timer.current);
    // Only the Revenue tab auto-refreshes; it exists for the full role only.
    timer.current = setInterval(() => { if (roleRef.current === 'full') loadMetrics(tok); }, 60000);
  }, [loadMetrics, loadLanding, loadAdSpend, loadAsk, loadBcast, days]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const q = qs.get('key');
    const qt = qs.get('tab');
    const t: Tab = qt === 'landing' ? 'landing' : qt === 'ask' ? 'ask' : qt === 'broadcast' ? 'broadcast' : 'revenue';
    setTab(t);
    let stored = ''; try { stored = localStorage.getItem('selamhq:key') || ''; } catch {}
    const tok = q || stored;
    if (tok) start(tok, t);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [start]);

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === 'landing' && !adata && token) loadLanding(token, days);
    if (t === 'ads' && token) { if (!adata) loadLanding(token, days); if (!adSpend) loadAdSpend(token, days); }
    if (t === 'ask' && !ask && token) loadAsk(token);
    if (t === 'broadcast' && !bcast && token) loadBcast(token);
  };
  const changeDays = (d: number) => { setDays(d); if (tab === 'ads') { loadLanding(token, d); loadAdSpend(token, d); } else loadLanding(token, d); };
  const refresh = () => { if (tab === 'revenue') loadMetrics(token); else if (tab === 'landing') loadLanding(token, days); else if (tab === 'ads') loadAdSpend(token, days); else if (tab === 'ask') loadAsk(token); else loadBcast(token); };
  const signOut = () => { try { localStorage.removeItem('selamhq:key'); } catch {}; if (timer.current) clearInterval(timer.current); setEntered(false); setMetrics(null); setAdata(null); roleRef.current = 'full'; setRole('full'); };

  if (!entered) {
    return (
      <div className="hq">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="hqgate">
          <h1>Selam HQ</h1>
          <p>Enter the HQ token — sales &amp; landing analytics.</p>
          <input type="password" placeholder="hq token" autoComplete="off" value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && token.trim()) start(token.trim(), tab); }} />
          <button onClick={() => token.trim() && start(token.trim(), tab)}>Unlock</button>
          <div className="err">{err}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="hq">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hqwrap">
        <div className="hqhead">
          <div className="hqtop">
            <h1>Selam <span>HQ</span></h1>
            <div className="tabs">
              {role === 'full' && <button className={tab === 'revenue' ? 'on' : ''} onClick={() => switchTab('revenue')}>Revenue</button>}
              <button className={tab === 'landing' ? 'on' : ''} onClick={() => switchTab('landing')}>Landing</button>
              <button className={tab === 'ads' ? 'on' : ''} onClick={() => switchTab('ads')}>Ads</button>
              <button className={tab === 'ask' ? 'on' : ''} onClick={() => switchTab('ask')}>Ask Selam</button>
              <button className={tab === 'broadcast' ? 'on' : ''} onClick={() => switchTab('broadcast')}>Broadcast</button>
            </div>
          </div>
          <div className="hqmeta">
            <span><span className="dot" style={{ background: live ? 'var(--good)' : 'var(--bad)' }} /> updated {updated || '—'}</span>
            {(tab === 'landing' || tab === 'ads') && (
              <select value={days} onChange={(e) => changeDays(+e.target.value)}>
                <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
              </select>
            )}
            <button onClick={refresh}>refresh</button>
            <button onClick={signOut}>sign out</button>
          </div>
        </div>

        {err && <div className="hqerr">{err}</div>}

        {tab === 'revenue' && role === 'full'
          ? <RevenueView d={metrics || {}} />
          : tab === 'landing'
          ? (adata ? <LandingView d={adata} /> : <div className="hqloading">Loading landing analytics…</div>)
          : tab === 'ads'
          ? <AdsView days={days} analytics={adata} spend={adSpend} live={gads} meta={metaAds} token={token} onChanged={() => loadAdSpend(token, days)} />
          : tab === 'ask'
          ? (ask ? <AskUsageView d={ask} /> : <div className="hqloading">Loading Ask-Selam usage…</div>)
          : (bcast ? <BroadcastView d={bcast} /> : <div className="hqloading">Loading broadcast metrics…</div>)}

        <div style={{ color: 'var(--ink3)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          {tab === 'landing' && adata ? `generated ${adata.generatedAt} · first-party · cookieless` : tab === 'ads' ? 'Ad spend (manual/CSV) × attributed revenue · Neon · token-gated' : tab === 'ask' ? 'Ask-Selam API budget · Upstash · token-gated' : tab === 'broadcast' ? 'Live-show metrics · Neon · token-gated' : 'real Stripe + Neon · token-gated'}
        </div>
      </div>
    </div>
  );
}
