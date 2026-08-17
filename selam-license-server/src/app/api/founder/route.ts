// GET /api/founder — public founder-cohort counter.
//
// Consumed by the heyselam.app landing page ("N of 100 remaining") and
// the /buy page to pick which price to display. Exposes only aggregate
// counts — no keys, emails, or revenue. CORS is open on purpose.
//
// Cached at the edge for 60s: the counter doesn't need to be
// tick-accurate, and this keeps a landing-page traffic spike from
// hammering Postgres.

import { NextResponse } from 'next/server';
import { countActiveLicenses, FOUNDER_CAP } from '@/lib/db';

export async function GET() {
  try {
    const active = await countActiveLicenses();
    const remaining = Math.max(0, FOUNDER_CAP - active);
    return NextResponse.json(
      {
        cap: FOUNDER_CAP,
        active,
        remaining,
        founder_open: remaining > 0,
        price_usd: remaining > 0 ? 99 : 149,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (e) {
    console.error('[api/founder] count failed:', e);
    // Match checkout's fail-open direction: an infra blip reads as
    // "founder window open" so the two surfaces never disagree.
    return NextResponse.json(
      { cap: FOUNDER_CAP, active: null, remaining: null, founder_open: true, price_usd: 99 },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } },
    );
  }
}
