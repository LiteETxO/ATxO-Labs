// Broadcast tab for HQ — live-show metrics (/api/broadcast over Neon, fed by
// host-loop during each broadcast).
'use client';

export type Broadcast = {
  id: string; platform: string; video_id: string | null;
  started_at: string | null; ended_at: string | null;
  duration_s: number; peak_viewers: number; avg_viewers: number;
  questions_answered: number; segments: Record<string, number> | null;
  cost_usd: number; rehearse: boolean;
};
export type BroadcastData = {
  ok?: boolean; error?: string;
  broadcasts: Broadcast[];
  aggregate: { count: number; avgMin: number; totalMin: number; peakViewers: number; questions: number; cost: number; segments: Record<string, number> };
};

const nf = (n: number) => (n ?? 0).toLocaleString();
const SEG_LABEL: Record<string, string> = {
  news: 'News', trivia: 'Trivia', poll: 'Polls', panel: 'Model Panel', creator: "Creator's Corner",
  deepdive: 'Deep Dive', market: 'Market Review', tour: 'Tours',
};
function mins(s: number) { const m = Math.round((s || 0) / 60); return m >= 60 ? (m / 60).toFixed(1) + 'h' : m + 'm'; }
function when(iso: string | null) {
  if (!iso) return '—';
  try { const d = new Date(iso); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); } catch { return '—'; }
}

export default function BroadcastView({ d }: { d: BroadcastData }) {
  if (d?.error) return <div className="hqerr">Broadcast metrics: {d.error}</div>;
  const ag = d?.aggregate || { count: 0, avgMin: 0, totalMin: 0, peakViewers: 0, questions: 0, cost: 0, segments: {} };
  const rows = d?.broadcasts || [];
  const segEntries = Object.entries(ag.segments || {}).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="hqgrid">
        <div className="hqkpi hero"><div className="k">Broadcasts</div><div className="v">{nf(ag.count)}</div><div className="sub">{ag.totalMin >= 60 ? (ag.totalMin / 60).toFixed(1) + 'h' : ag.totalMin + 'm'} total · avg {ag.avgMin}m</div></div>
        <div className="hqkpi"><div className="k">Peak viewers</div><div className="v">{nf(ag.peakViewers)}</div><div className="sub">best concurrent</div></div>
        <div className="hqkpi"><div className="k">Questions answered</div><div className="v">{nf(ag.questions)}</div><div className="sub">live chat</div></div>
        <div className="hqkpi"><div className="k">Segments run</div><div className="v">{nf(segEntries.reduce((a, [, n]) => a + n, 0))}</div><div className="sub">across all shows</div></div>
      </div>

      <div className="hqcols">
        <div className="hqpanel">
          <h2>Segment mix (all shows)</h2>
          <div className="hqfunnel">
            {segEntries.length === 0 ? <span className="mono" style={{ color: 'var(--ink3)', fontSize: 13 }}>No segments logged yet.</span> :
              (() => { const max = Math.max(1, ...segEntries.map(([, n]) => n)); return segEntries.map(([k, n]) => (
                <div className="hqstage" key={k}>
                  <div className="lab">{SEG_LABEL[k] || k}</div>
                  <div className="track"><div className="fill" style={{ width: Math.max(8, Math.round((n / max) * 100)) + '%' }}>{n}</div></div>
                </div>
              )); })()}
          </div>
        </div>
        <div className="hqpanel">
          <h2>Totals</h2>
          <div className="hqfeed">
            <div className="hqrow"><div className="em">Air time</div><span className="mono">{ag.totalMin >= 60 ? (ag.totalMin / 60).toFixed(1) + ' h' : ag.totalMin + ' min'}</span></div>
            <div className="hqrow"><div className="em">Avg show length</div><span className="mono">{ag.avgMin} min</span></div>
            <div className="hqrow"><div className="em">Model Panels run</div><span className="mono">{nf((ag.segments || {}).panel || 0)}</span></div>
            <div className="hqrow"><div className="em">Questions answered</div><span className="mono">{nf(ag.questions)}</span></div>
          </div>
        </div>
      </div>

      <div className="hqpanel scroll">
        <h2>Recent broadcasts</h2>
        <table>
          <thead><tr><th>When</th><th>Platform</th><th style={{ textAlign: 'right' }}>Length</th><th style={{ textAlign: 'right' }}>Peak</th><th style={{ textAlign: 'right' }}>Avg</th><th style={{ textAlign: 'right' }}>Q&apos;s</th><th style={{ textAlign: 'right' }}>Panels</th><th>Live</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td className="name" colSpan={8}>No broadcasts recorded yet. Go live and they&apos;ll appear here.</td></tr> :
              rows.map((b) => (
                <tr key={b.id}>
                  <td className="name">{when(b.started_at)}{b.rehearse ? ' · rehearsal' : ''}</td>
                  <td className="name" style={{ textTransform: 'capitalize' }}>{b.platform}</td>
                  <td style={{ textAlign: 'right' }}>{mins(b.duration_s)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(b.peak_viewers)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(b.avg_viewers)}</td>
                  <td style={{ textAlign: 'right' }}>{nf(b.questions_answered)}</td>
                  <td style={{ textAlign: 'right' }}>{nf((b.segments || {}).panel || 0)}</td>
                  <td>{b.video_id ? <a href={`https://www.youtube.com/watch?v=${b.video_id}`} target="_blank" rel="noreferrer">watch ↗</a> : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
