// POST /api/subscribe — marketing email capture from heyselam.app.
//
// Body: { email: string, source?: string }. Stores into `subscribers`
// (email PK, ON CONFLICT DO NOTHING — resubmits are silent successes so
// the form never leaks whether an address was already known). CORS is
// open: the landing posts cross-origin. Rate-limited per IP so the
// endpoint can't be used to bloat the table.

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getLimiter } from '@/lib/rate-limit';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limiter = await getLimiter();
    const { allowed } = await limiter.check(`subscribe:${ip}`, 6, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'Too many attempts — try later.' },
        { status: 429, headers: CORS });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 254);
    const source = String(body?.source || 'landing').slice(0, 64);
    const note = String(body?.use_case || '').trim().slice(0, 300) || null;
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'That doesn’t look like an email.' },
        { status: 400, headers: CORS });
    }

    const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
    await sql`INSERT INTO subscribers (email, source, note) VALUES (${email}, ${source}, ${note})
              ON CONFLICT (email) DO NOTHING`;
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e) {
    console.error('[api/subscribe] failed:', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong.' },
      { status: 500, headers: CORS });
  }
}
