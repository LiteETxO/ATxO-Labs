// Revenue tab for the unified HQ dashboard — real Stripe + Neon data (/api/metrics).
'use client';

export type Metrics = {
  revenue?: { currency: string; allTime: number; d30: number; paidCount: number; capped: boolean; daily: { day: string; usd: number }[] };
  orders?: { trial: number; perpetual: number; update_pass: number };
  licenses?: { active: number; refunded: number; founder: number; standard: number; founderCap: number; founderLeft: number };
  signups?: { total: number; d30: number; recent: { email: string; source: string; at: string }[] };
  conversion?: { signups: number; trials: number; owners: number; trialToOwn: number };
  recentSales?: { email: string; type: string; tier: string; status: string; at: string }[];
  dbError?: string; stripeError?: string; generatedAt?: string;
};

const usd = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return Math.max(1, s | 0) + 's';
  if (s < 3600) return (s / 60 | 0) + 'm';
  if (s < 86400) return (s / 3600 | 0) + 'h';
  return (s / 86400 | 0) + 'd';
};

export default function RevenueView({ d }: { d: Metrics }) {
  const rev = d.revenue, lic = d.licenses, sig = d.signups, conv = d.conversion, ord = d.orders;
  const revDaily = (rev?.daily || []).slice(-14);
  const maxRev = Math.max(1, ...revDaily.map((x) => x.usd));
  const funnelMax = Math.max(1, conv?.signups || 0, conv?.trials || 0, conv?.owners || 0);

  return (
    <>
      {d.stripeError && <div className="hqerr">Stripe: {d.stripeError}</div>}
      {d.dbError && <div className="hqerr">Database: {d.dbError}</div>}

      <div className="hqgrid">
        <div className="hqkpi hero">
          <div className="k">Revenue · all time</div>
          <div className="v">{usd(rev?.allTime || 0)}{rev?.capped ? '+' : ''}</div>
          <div className="sub"><span className="up">{usd(rev?.d30 || 0)}</span> in the last 30 days · {rev?.paidCount || 0} paid</div>
        </div>
        <div className="hqkpi"><div className="k">Owners</div><div className="v">{ord?.perpetual ?? 0}</div><div className="sub">perpetual licenses</div></div>
        <div className="hqkpi"><div className="k">Trials</div><div className="v">{ord?.trial ?? 0}</div><div className="sub">active $10 trials</div></div>
        <div className="hqkpi"><div className="k">Trial → own</div><div className="v">{conv?.trialToOwn ?? 0}<small>%</small></div><div className="sub">conversion</div></div>
        <div className="hqkpi"><div className="k">Signups</div><div className="v">{sig?.total ?? 0}</div><div className="sub">+{sig?.d30 ?? 0} in 30d</div></div>
        <div className="hqkpi"><div className="k">Founder slots</div><div className="v">{lic?.founderLeft ?? 0}<small> / {lic?.founderCap ?? 100}</small></div><div className="sub">{lic?.founder ?? 0} claimed</div></div>
      </div>

      <div className="hqpanel">
        <h2>Revenue · last 14 days</h2>
        <div className="hqchart">
          {revDaily.map((x, i) => (
            <div key={x.day} className={'hqcol' + (i === revDaily.length - 1 ? ' today' : '')}>
              <div className="bw"><div className="b" style={{ height: Math.round((x.usd / maxRev) * 100) + '%' }} title={usd(x.usd)} /></div>
              <div className="d">{x.day.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hqcols">
        <div className="hqpanel">
          <h2>Funnel</h2>
          <div className="hqfunnel">
            {[['Signups', conv?.signups || 0], ['Trials', conv?.trials || 0], ['Owners', conv?.owners || 0]].map(([lab, n]) => (
              <div className="hqstage" key={lab as string}>
                <div className="lab">{lab}</div>
                <div className="track"><div className="fill" style={{ width: Math.max(6, Math.round(((n as number) / funnelMax) * 100)) + '%' }}>{n as number}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="hqpanel">
          <h2>Recent sales</h2>
          <div className="hqfeed">
            {(d.recentSales && d.recentSales.length) ? d.recentSales.map((s, i) => (
              <div className="hqrow" key={i}>
                <div className="t">{ago(s.at)} ago</div>
                <div className="em">{s.email}</div>
                <span className={'badge ' + (s.status === 'revoked' ? 'revoked' : s.type)}>{s.status === 'revoked' ? 'refunded' : s.type}</span>
              </div>
            )) : <div className="hqempty">No sales yet.</div>}
          </div>
        </div>
      </div>

      <div className="hqpanel">
        <h2>Recent signups</h2>
        <div className="hqfeed">
          {(sig?.recent && sig.recent.length) ? sig.recent.map((s, i) => (
            <div className="hqrow" key={i}>
              <div className="t">{ago(s.at)} ago</div>
              <div className="em">{s.email}</div>
              <span className="badge trial">{s.source}</span>
            </div>
          )) : <div className="hqempty">No signups yet.</div>}
        </div>
      </div>
    </>
  );
}
