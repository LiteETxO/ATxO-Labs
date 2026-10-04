// Ask-Selam tab for HQ — API budget + usage for the landing "Ask Selam" chat.
// Data proxied from heyselam.ai/api/usage via /api/ask-usage (HQ-gated).
'use client';

export type AskUsage = {
  configured: boolean;
  error?: string;
  month?: string;
  cap?: number;
  warnAt?: number;
  monthSpend?: number;
  warned?: boolean;
  tokIn?: number;
  tokOut?: number;
  ttsChars?: number;
  series?: Array<{ day: string; spend: number; ask: number; tts: number; rl: number }>;
  recent?: Array<{ t: number; q: string }>;
};

const usd = (n: number) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf = (n: number) => (n ?? 0).toLocaleString();

export default function AskUsageView({ d }: { d: AskUsage }) {
  if (!d || d.configured === false) {
    return <div className="hqempty" style={{ padding: 24 }}>Ask-Selam usage isn’t configured (no Upstash budget store).</div>;
  }
  if (d.error) {
    return <div className="hqerr">Ask-Selam usage: {d.error}</div>;
  }
  const cap = d.cap || 0;
  const spent = d.monthSpend || 0;
  const pct = cap ? Math.min(100, Math.round((100 * spent) / cap)) : 0;
  const warnPct = d.warnAt ? Math.round(d.warnAt * 100) : 80;
  const over = cap > 0 && spent >= cap;
  const warn = !over && cap > 0 && spent >= cap * (d.warnAt || 0.8);
  const barColor = over ? 'var(--bad)' : warn ? 'var(--warn)' : 'var(--good)';
  const series = d.series || [];
  const maxSpend = Math.max(0.0001, ...series.map((s) => s.spend));
  const totalAsk = series.reduce((a, s) => a + (s.ask || 0), 0);
  const totalTts = series.reduce((a, s) => a + (s.tts || 0), 0);
  const totalRl = series.reduce((a, s) => a + (s.rl || 0), 0);

  return (
    <>
      <div className="hqgrid">
        <div className="hqkpi hero">
          <div className="k">Spend this month</div>
          <div className="v" style={{ color: over ? 'var(--bad)' : undefined }}>{usd(spent)} <small>/ {usd(cap)}</small></div>
          <div className="sub">{d.month || ''} · cap at {usd(cap)}{d.warned ? ' · ⚠ warned' : ''}</div>
          <div style={{ marginTop: 12, height: 10, borderRadius: 6, background: 'var(--card2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: 6, transition: 'width .4s' }} />
          </div>
          <div className="sub" style={{ marginTop: 6 }}>{pct}% used · warns at {warnPct}%</div>
        </div>
        <div className="hqkpi"><div className="k">Questions · 7d</div><div className="v">{nf(totalAsk)}</div><div className="sub">answered</div></div>
        <div className="hqkpi"><div className="k">Voice clips · 7d</div><div className="v">{nf(totalTts)}</div><div className="sub">TTS generated</div></div>
        <div className="hqkpi"><div className="k">Rate-limited · 7d</div><div className="v" style={{ color: totalRl ? 'var(--warn)' : undefined }}>{nf(totalRl)}</div><div className="sub">429s (cap hit)</div></div>
        <div className="hqkpi"><div className="k">Tokens (mo)</div><div className="v" style={{ fontSize: 20 }}>{nf(d.tokIn || 0)}<small> in</small></div><div className="sub">{nf(d.tokOut || 0)} out · {nf(d.ttsChars || 0)} tts chars</div></div>
      </div>

      <div className="hqpanel">
        <h2>Spend · last 7 days</h2>
        <div className="hqchart">
          {series.length === 0 && <span className="mono" style={{ color: 'var(--ink3)', fontSize: 13 }}>No usage yet.</span>}
          {series.map((s, i) => (
            <div key={s.day} className={'hqcol' + (i === series.length - 1 ? ' today' : '')} title={`${s.day}: ${usd(s.spend)} · ${s.ask} Q · ${s.tts} TTS${s.rl ? ' · ' + s.rl + ' rl' : ''}`}>
              <div className="bw"><div className="b" style={{ height: Math.round((s.spend / maxSpend) * 100) + '%' }} /></div>
              <div className="d">{s.day.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hqpanel scroll">
        <h2>Recent questions visitors asked</h2>
        <table><tbody>
          {(d.recent || []).length === 0
            ? <tr><td className="name">None yet.</td></tr>
            : (d.recent || []).map((r, i) => (
              <tr key={i}><td className="name" style={{ whiteSpace: 'normal', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13 }}>{r.q}</td></tr>
            ))}
        </tbody></table>
      </div>
    </>
  );
}
