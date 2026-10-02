// Landing tab for the unified HQ dashboard — first-party traffic + engagement
// (/api/analytics over Neon landing_events).
'use client';

export type AnalyticsData = {
  generatedAt: string; days: number;
  totals: { views: number; visitors: number; events: number; byEvent: Record<string, number> };
  daily: Array<{ d: string; views: number; visitors: number }>;
  ctas: Array<{ name: string; count: number }>;
  funnel: { views: number; engaged: number; buy: number; crypto: number };
  funnelRates: { viewToEngaged: number; viewToBuy: number; engagedToBuy: number };
  attributedRevenue: number; currency: string; stripeError?: string;
  campaigns: Array<{ campaign: string; views: number; clicks: number; buy: number; paid: number; revenue: number }>;
  content: Array<{ content: string; clicks: number }>;
  referrers: Array<{ ref: string; n: number }>;
  countries: Array<{ country: string; n: number }>;
  devices: Array<{ device: string; n: number }>;
  scroll: Array<{ depth: string; n: number }>;
  questions: Array<{ q: string; n: number; visitors: number }>;
  engagement: Array<{ kind: string; n: number; visitors: number }>;
  games: Array<{ game: string; n: number }>;
  sections: Array<{ section: string; visitors: number }>;
  ctaPlacement: Array<{ placement: string; n: number }>;
  sources: Array<{ ref: string; views: number; clicks: number; buy: number }>;
};

const CTA_LABEL: Record<string, string> = {
  cta_buy: 'Buy / trial', cta_pay_crypto: 'Pay with crypto', cta_watch_live: 'Watch live',
  cta_watch_setup: 'Watch setup', cta_ask_selam: 'Ask Selam',
};
const ENGAGE_LABEL: Record<string, string> = {
  ask: 'Asked a question', voice: 'Used voice input', game: 'Played a game', tour: 'Watched the tour',
};
const GAME_LABEL: Record<string, string> = {
  chess: 'Chess', poker: 'Poker', connect4: 'Four in a Row', wordle: 'Word Guess', trivia_host: 'Party Trivia',
};
const nf = (n: number) => (n ?? 0).toLocaleString();
const pct = (num: number, den: number) => (den ? ((100 * num) / den).toFixed(1) + '%' : '—');
const money = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function LandingView({ d }: { d: AnalyticsData }) {
  const maxDaily = Math.max(1, ...(d.daily || []).map((x) => x.views));
  const fmax = Math.max(1, d.funnel.views || 1);
  const fw = (n: number) => `${Math.max(1, Math.round((n / fmax) * 100))}%`;
  const eng = (k: string) => (d.engagement || []).find((e) => e.kind === k)?.n || 0;
  const maxSection = Math.max(1, ...(d.sections || []).map((x) => x.visitors));

  return (
    <>
      <div className="grid">
        <div className="kpi hero"><div className="k">Page views</div><div className="v">{nf(d.totals.views)}</div><div className="sub">last {d.days} days</div></div>
        <div className="kpi hero"><div className="k">Unique visitors</div><div className="v">{nf(d.totals.visitors)}</div><div className="sub">daily-hashed, cookieless</div></div>
        <div className="kpi"><div className="k">Buy-button clicks</div><div className="v">{nf(d.funnel.buy)}</div><div className="sub">clicks, not sales</div></div>
        <div className="kpi"><div className="k">Crypto clicks</div><div className="v">{nf(d.funnel.crypto)}</div></div>
        <div className="kpi"><div className="k">Engaged</div><div className="v">{nf(d.funnel.engaged)}</div><div className="sub">visitors w/ a CTA</div></div>
        <div className="kpi"><div className="k">Questions asked</div><div className="v">{nf(eng('ask'))}</div><div className="sub">Ask Selam</div></div>
        <div className="kpi"><div className="k">Games played</div><div className="v">{nf(eng('game'))}</div><div className="sub">free in-browser</div></div>
        <div className="kpi hero"><div className="k">Attributed revenue</div><div className="v">{money(d.attributedRevenue)}</div><div className="sub">paid orders by campaign · last {d.days}d{d.stripeError ? ' · stripe err' : ''}</div></div>
      </div>

      <div className="panel">
        <h2>Page views · daily</h2>
        <div className="chart">
          {d.daily.length === 0 && <span style={{ color: 'var(--ink3)', fontSize: 13 }} className="mono">No data yet — waiting for the first visits.</span>}
          {d.daily.map((x) => (
            <div className="col" key={x.d} title={`${x.d}: ${x.views} views, ${x.visitors} visitors`}>
              <div className="bw"><div className="b" style={{ height: `${(x.views / maxDaily) * 100}%` }} /></div>
              <div className="dd">{x.d.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Funnel</h2>
        <div className="funnel">
          <div className="fstep"><div className="lbl">Views</div><div className="bar"><div className="xfill" style={{ width: fw(d.funnel.views) }} /></div><div className="n">{nf(d.funnel.views)}</div></div>
          <div className="fstep"><div className="lbl">Engaged (any CTA)</div><div className="bar"><div className="xfill" style={{ width: fw(d.funnel.engaged) }} /></div><div className="n">{nf(d.funnel.engaged)}</div></div>
          <div className="fstep"><div className="lbl">Buy clicks</div><div className="bar"><div className="xfill" style={{ width: fw(d.funnel.buy) }} /></div><div className="n">{nf(d.funnel.buy)}</div></div>
          <div className="fstep"><div className="lbl">Crypto clicks</div><div className="bar"><div className="xfill" style={{ width: fw(d.funnel.crypto) }} /></div><div className="n">{nf(d.funnel.crypto)}</div></div>
        </div>
        <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink3)' }}>
          view→engaged <b style={{ color: 'var(--ink2)' }}>{d.funnelRates.viewToEngaged}%</b> ·
          view→buy <b style={{ color: 'var(--ink2)' }}>{d.funnelRates.viewToBuy}%</b> ·
          engaged→buy <b style={{ color: 'var(--ink2)' }}>{d.funnelRates.engagedToBuy}%</b>
          <span style={{ marginLeft: 8 }}>· buy = button clicks, see Revenue tab for paid orders</span>
        </div>
      </div>

      <div className="panel scroll">
        <h2>Questions visitors ask (voice-of-customer)</h2>
        <table><thead><tr><th>Question</th><th style={{ textAlign: 'right' }}>Times</th><th style={{ textAlign: 'right' }}>Visitors</th></tr></thead>
          <tbody>{(d.questions || []).length === 0 ? <tr><td className="name" colSpan={3}>No questions asked yet.</td></tr> :
            d.questions.map((qq, i) => <tr key={i}><td className="name" style={{ whiteSpace: 'normal', color: 'var(--ink)' }}>{qq.q}</td><td style={{ textAlign: 'right' }}>{nf(qq.n)}</td><td style={{ textAlign: 'right' }}>{nf(qq.visitors)}</td></tr>)}
          </tbody></table>
      </div>

      <div className="cols2">
        <div className="panel"><h2>Hero engagement</h2>
          <table><tbody>{(d.engagement || []).length === 0 ? <tr><td className="name">No interactions yet.</td></tr> :
            d.engagement.map((e) => <tr key={e.kind}><td className="name">{ENGAGE_LABEL[e.kind] || e.kind}</td><td style={{ textAlign: 'right' }}>{nf(e.n)}</td><td style={{ textAlign: 'right', color: 'var(--ink3)' }}>{nf(e.visitors)} ppl</td></tr>)}
          </tbody></table>
        </div>
        <div className="panel"><h2>Games played</h2>
          <table><tbody>{(d.games || []).length === 0 ? <tr><td className="name">None played yet.</td></tr> :
            d.games.map((g) => <tr key={g.game}><td className="name">{GAME_LABEL[g.game] || g.game}</td><td style={{ textAlign: 'right' }}>{nf(g.n)}</td></tr>)}
          </tbody></table>
        </div>
      </div>

      <div className="panel">
        <h2>Sections reached (unique visitors)</h2>
        <div className="funnel">
          {(d.sections || []).length === 0 ? <span className="mono" style={{ color: 'var(--ink3)', fontSize: 13 }}>No section data yet.</span> :
            d.sections.map((s) => (
              <div className="fstep" key={s.section}>
                <div className="lbl" style={{ textTransform: 'capitalize' }}>{s.section.replace(/_/g, ' ')}</div>
                <div className="bar"><div className="xfill" style={{ width: `${Math.max(1, Math.round((s.visitors / maxSection) * 100))}%` }} /></div>
                <div className="n">{nf(s.visitors)}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="cols2">
        <div className="panel"><h2>Buy clicks by placement</h2>
          <table><tbody>{(d.ctaPlacement || []).length === 0 ? <tr><td className="name">No buy clicks yet.</td></tr> :
            d.ctaPlacement.map((c) => <tr key={c.placement}><td className="name" style={{ textTransform: 'capitalize' }}>{c.placement.replace(/[_-]/g, ' ')}</td><td style={{ textAlign: 'right' }}>{nf(c.n)}</td></tr>)}
          </tbody></table>
        </div>
        <div className="panel scroll"><h2>Traffic quality by source</h2>
          <table><thead><tr><th>Source</th><th style={{ textAlign: 'right' }}>Views</th><th style={{ textAlign: 'right' }}>Buy</th><th style={{ textAlign: 'right' }}>Buy-rate</th></tr></thead>
            <tbody>{(d.sources || []).length === 0 ? <tr><td className="name" colSpan={4}>No data yet.</td></tr> :
              d.sources.map((s) => <tr key={s.ref}><td className="name">{s.ref}</td><td style={{ textAlign: 'right' }}>{nf(s.views)}</td><td style={{ textAlign: 'right' }}>{nf(s.buy)}</td><td style={{ textAlign: 'right', color: s.buy ? 'var(--good)' : 'var(--ink3)' }}>{pct(s.buy, s.views)}</td></tr>)}
            </tbody></table>
        </div>
      </div>

      <div className="panel scroll">
        <h2>By campaign — views → clicks → paid $</h2>
        <table><thead><tr><th>Campaign</th><th style={{ textAlign: 'right' }}>Views</th><th style={{ textAlign: 'right' }}>Buy clicks</th><th style={{ textAlign: 'right' }}>Paid</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>View→paid</th></tr></thead>
          <tbody>{d.campaigns.length === 0 ? <tr><td className="name" colSpan={6}>No campaign traffic yet.</td></tr> :
            d.campaigns.map((c) => <tr key={c.campaign}>
              <td className="name">{c.campaign}</td>
              <td style={{ textAlign: 'right' }}>{nf(c.views)}</td>
              <td style={{ textAlign: 'right' }}>{nf(c.buy)}</td>
              <td style={{ textAlign: 'right', color: c.paid ? 'var(--good)' : 'var(--ink3)' }}>{nf(c.paid)}</td>
              <td style={{ textAlign: 'right', color: c.revenue ? 'var(--good)' : 'var(--ink3)' }}>{money(c.revenue)}</td>
              <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>{pct(c.paid, c.views)}</td>
            </tr>)}
          </tbody></table>
        <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink3)' }}>
          Paid $ is real Stripe revenue (refund-aware), tied to the campaign that drove the click. Direct/untagged purchases show under “(none)”.
        </div>
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
    </>
  );
}
