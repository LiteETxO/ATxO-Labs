// GET /api/crypto/status?orderId=... — poll a crypto order.
//
// Checks the chain for the expected payment; on first confirmation it mints the
// license (idempotent) + emails it, and returns { status:'paid', licenseKey }.
// Otherwise { status:'pending' } or { status:'expired' }.
import { NextRequest, NextResponse } from 'next/server';
import { checkOrder } from '@/lib/crypto-pay';
import { sendPurchaseEmail } from '@/lib/mailer';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId') || '';
  if (!/^[0-9a-f]{16}$/.test(orderId)) return NextResponse.json({ error: 'bad orderId' }, { status: 400 });
  try {
    const res = await checkOrder(orderId, { sendPurchaseEmail });
    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[crypto/status]', (e as Error).message);
    return NextResponse.json({ status: 'pending' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
