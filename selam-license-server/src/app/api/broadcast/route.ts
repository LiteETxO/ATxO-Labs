// /api/broadcast — live-show metrics.
//   POST  (X-Ingest-Token: SELAM_BROADCAST_TOKEN)  → upsert one broadcast's summary
//         (host-loop flushes periodically + on end, keyed by a stable id).
//   GET   (key = HQ_TOKEN)                          → recent broadcasts + aggregates
//         for the HQ "Broadcast" tab.
//
// Data lives in Neon (broadcasts table, self-provisioned on first write).

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HQ_TOKEN = process.env.HQ_TOKEN || '';
const INGEST_TOKEN = process.env.SELAM_BROADCAST_TOKEN || '';

let _ensured = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensure(sql: any) {
  if (_ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS broadcasts (
    id TEXT PRIMARY KEY,
    platform TEXT,
    video_id TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_s INT,
    peak_viewers INT,
    avg_viewers INT,
    questions_answered INT,
    segments JSONB,
    cost_usd NUMERIC(10,4),
    rehearse BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS broadcasts_started ON broadcasts (started_at DESC)`;
  _ensured = true;
}

const dbUrl = () => process.env.POSTGRES_URL || process.env.DATABASE_URL;
const s = (v: unknown, n = 120): string | null => { const t = (v == null ? '' : String(v)).trim(); return t ? t.slice(0, n) : null; };
const i = (v: unknown): number => { const n = parseInt(String(v ?? 0), 10); return isNaN(n) ? 0 : n; };
const f = (v: unknown): number => { const n = parseFloat(String(v ?? 0)); return isNaN(n) ? 0 : n; };

export async function POST(req: NextRequest) {
  const tok = req.headers.get('x-ingest-token') || '';
  if (!INGEST_TOKEN || tok !== INGEST_TOKEN) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = dbUrl(); if (!url) return NextResponse.json({ error: 'no db' }, { status: 500 });
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const id = s(b.id, 120); if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const sql = neon(url);
    await ensure(sql);
    const seg = (() => { try { return JSON.stringify(b.segments || {}); } catch { return '{}'; } })();
    await sql`
      INSERT INTO broadcasts (id, platform, video_id, started_at, ended_at, duration_s, peak_viewers, avg_viewers, questions_answered, segments, cost_usd, rehearse, updated_at)
      VALUES (${id}, ${s(b.platform, 40)}, ${s(b.videoId, 60)},
              ${b.startedAt ? new Date(String(b.startedAt)).toISOString() : null},
              ${b.endedAt ? new Date(String(b.endedAt)).toISOString() : null},
              ${i(b.durationS)}, ${i(b.peakViewers)}, ${i(b.avgViewers)}, ${i(b.questionsAnswered)},
              ${seg}::jsonb, ${f(b.costUsd)}, ${!!b.rehearse}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        platform = EXCLUDED.platform, video_id = EXCLUDED.video_id,
        ended_at = EXCLUDED.ended_at, duration_s = EXCLUDED.duration_s,
        peak_viewers = GREATEST(broadcasts.peak_viewers, EXCLUDED.peak_viewers),
        avg_viewers = EXCLUDED.avg_viewers, questions_answered = EXCLUDED.questions_answered,
        segments = EXCLUDED.segments, cost_usd = EXCLUDED.cost_usd, updated_at = NOW()`;
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 160) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  // Full HQ token or marketing-scoped token — broadcast metrics are marketing data.
  const MKT_TOKEN = process.env.HQ_MARKETING_TOKEN || '';
  if (!((!!HQ_TOKEN && key === HQ_TOKEN) || (!!MKT_TOKEN && key === MKT_TOKEN))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = dbUrl(); if (!url) return NextResponse.json({ error: 'no db' }, { status: 500 });
  const includeReh = req.nextUrl.searchParams.get('rehearse') === '1';
  try {
    const sql = neon(url);
    await ensure(sql);
    const rows = includeReh
      ? await sql`SELECT * FROM broadcasts ORDER BY started_at DESC NULLS LAST LIMIT 40`
      : await sql`SELECT * FROM broadcasts WHERE rehearse = FALSE ORDER BY started_at DESC NULLS LAST LIMIT 40`;
    // Aggregate over real (non-rehearsal) broadcasts.
    const real = (rows as Array<Record<string, unknown>>).filter((r) => !r.rehearse);
    type Agg = { count: number; totalMin: number; peak: number; questions: number; cost: number; segments: Record<string, number> };
    const agg = real.reduce((a: Agg, r) => {
      a.count += 1;
      a.totalMin += (i(r.duration_s)) / 60;
      a.peak = Math.max(a.peak, i(r.peak_viewers));
      a.questions += i(r.questions_answered);
      a.cost += f(r.cost_usd);
      const seg = (r.segments || {}) as Record<string, number>;
      for (const k in seg) a.segments[k] = (a.segments[k] || 0) + i(seg[k]);
      return a;
    }, { count: 0, totalMin: 0, peak: 0, questions: 0, cost: 0, segments: {} as Record<string, number> });
    return NextResponse.json({
      ok: true,
      broadcasts: rows,
      aggregate: {
        count: agg.count,
        avgMin: agg.count ? +(agg.totalMin / agg.count).toFixed(1) : 0,
        totalMin: +agg.totalMin.toFixed(0),
        peakViewers: agg.peak,
        questions: agg.questions,
        cost: +agg.cost.toFixed(2),
        segments: agg.segments,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 160) }, { status: 500 });
  }
}
