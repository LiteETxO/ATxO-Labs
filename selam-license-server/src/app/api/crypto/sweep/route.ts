// GET /api/crypto/sweep — cron: mint licenses for crypto orders that confirmed
// on-chain after the buyer's page stopped polling (e.g. they closed the tab).
//
// Runs from Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; we require it so the endpoint can't be
// spammed publicly (each call hits explorer APIs).
import { NextRequest, NextResponse } from 'next/server';
import { listSweepableOrders, checkOrder } from '@/lib/crypto-pay';
import { sendPurchaseEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured → allow (Vercel cron only in prod)
  const hdr = req.headers.get('authorization') || '';
  return hdr === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let ids: string[] = [];
  try { ids = await listSweepableOrders(100); } catch (e) {
    console.error('[crypto/sweep] list failed:', (e as Error).message);
    return NextResponse.json({ error: 'sweep failed' }, { status: 500 });
  }
  let minted = 0, checked = 0;
  for (const id of ids) {
    checked++;
    try {
      const res = await checkOrder(id, { sendPurchaseEmail });
      if (res.status === 'paid') minted++;
    } catch (e) { console.error('[crypto/sweep] order', id, (e as Error).message); }
  }
  console.log(`[crypto/sweep] checked ${checked}, minted ${minted}`);
  return NextResponse.json({ checked, minted }, { headers: { 'Cache-Control': 'no-store' } });
}
