// POST /api/crypto/checkout — start a crypto payment.
//
// Body: { email, flow?: 'trial'|'ownership'|'upgrade', asset: 'btc'|'usdc'|'usdt'|'usd1' }
// Returns: { orderId, asset, address, amount, usd, expiresAt } — the exact
// amount + address to send to. The buyer's page then polls /api/crypto/status.
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, type CryptoAsset, type CryptoFlow } from '@/lib/crypto-pay';

const ASSETS = new Set(['btc', 'usdc', 'usdt', 'usd1']);
const FLOWS = new Set(['trial', 'ownership', 'upgrade']);

export async function POST(req: NextRequest) {
  let body: { email?: string; flow?: string; asset?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const email = (body.email || '').trim().toLowerCase();
  const asset = (body.asset || '').trim().toLowerCase();
  const flow = (body.flow || 'ownership').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  if (!ASSETS.has(asset)) return NextResponse.json({ error: 'unsupported asset' }, { status: 400 });
  if (!FLOWS.has(flow)) return NextResponse.json({ error: 'unsupported flow' }, { status: 400 });

  try {
    const order = await createOrder(email, flow as CryptoFlow, asset as CryptoAsset);
    return NextResponse.json(order);
  } catch (e) {
    const msg = (e as Error).message || 'checkout failed';
    // "receiving address not configured" → 503 so the UI can hide the option cleanly
    const notReady = /not configured|API_KEY not set/i.test(msg);
    console.error('[crypto/checkout]', msg);
    return NextResponse.json({ error: notReady ? 'crypto payments not available yet' : 'checkout failed' }, { status: notReady ? 503 : 500 });
  }
}
