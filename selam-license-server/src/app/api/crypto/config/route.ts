// GET /api/crypto/config — which crypto assets are currently accepted.
// Read at request time, so adding SELAM_BSC_ADDRESS + BSCSCAN_API_KEY later
// enables the stablecoins with no redeploy.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const btc = !!(process.env.SELAM_BTC_ADDRESS || '').trim();
  const bsc = !!(process.env.SELAM_BSC_ADDRESS || '').trim() && !!(process.env.BSCSCAN_API_KEY || '').trim();
  return NextResponse.json(
    { assets: { btc, usdc: bsc, usdt: bsc, usd1: bsc } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
