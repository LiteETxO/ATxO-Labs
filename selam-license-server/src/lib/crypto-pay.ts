// ─── Crypto checkout (direct on-chain) ───────────────────────────────
//
// Buyers pay in BTC or a BSC stablecoin (USDC / USDT / USD1). We show them a
// UNIQUE amount (base price + a tiny random offset) sent to our own receiving
// address; a status poll queries the chain for a transfer of that exact amount
// and, once confirmed, mints the SAME license Stripe would (mint key → insert →
// email). No processor, no middleman fees, and USD1 works (it's on BSC).
//
// Receiving addresses + keys are env-only (never hardcoded):
//   SELAM_BTC_ADDRESS   — your BTC receiving address
//   SELAM_BSC_ADDRESS   — your BSC (EVM) receiving address (USDC/USDT/USD1)
//   BSCSCAN_API_KEY     — free key from bscscan.com for transfer lookups
// Token contracts default to the canonical BSC ones but are env-overridable:
//   BSC_USDC_CONTRACT / BSC_USDT_CONTRACT / BSC_USD1_CONTRACT
//
import { neon } from '@neondatabase/serverless';
import {
  insertLicense, countActiveLicenses, FOUNDER_CAP,
  type LicenseTier, type PurchaseType,
} from './db';

let _sql: ReturnType<typeof neon> | null = null;
function db() {
  if (!_sql) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) throw new Error('POSTGRES_URL not set');
    _sql = neon(url);
  }
  return _sql;
}

export type CryptoAsset = 'btc' | 'usdc' | 'usdt' | 'usd1';
export type CryptoFlow = 'trial' | 'ownership' | 'upgrade';

// License key — same format/keyspace as the Stripe path (SELAM-XXXXX-XXXXX-XXXXX).
const _ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function mintLicenseKey(): string {
  const b = new Uint8Array(15); globalThis.crypto.getRandomValues(b);
  const c = Array.from(b, (x) => _ALPHABET[x % _ALPHABET.length]);
  return `SELAM-${c.slice(0, 5).join('')}-${c.slice(5, 10).join('')}-${c.slice(10, 15).join('')}`;
}

// BSC token contracts (18 decimals on BSC, unlike Ethereum's 6 for USDC/USDT).
const BSC_TOKENS: Record<Exclude<CryptoAsset, 'btc'>, { contract: string; decimals: number }> = {
  usdc: { contract: (process.env.BSC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d').toLowerCase(), decimals: 18 },
  usdt: { contract: (process.env.BSC_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955').toLowerCase(), decimals: 18 },
  usd1: { contract: (process.env.BSC_USD1_CONTRACT || '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d').toLowerCase(), decimals: 18 },
};
const BSC_CONFIRMATIONS = Number(process.env.BSC_MIN_CONFIRMATIONS || 6);
const BTC_CONFIRMATIONS = Number(process.env.BTC_MIN_CONFIRMATIONS || 1);
const ORDER_TTL_MS = Number(process.env.CRYPTO_ORDER_TTL_MIN || 60) * 60 * 1000;

// USD price per flow (founder ownership honors the $99 promise; standard $149).
async function usdPrice(flow: CryptoFlow): Promise<{ usd: number; tier: LicenseTier; purchaseType: PurchaseType }> {
  if (flow === 'trial') return { usd: Number(process.env.PRICE_TRIAL_USD || 10), tier: 'founder', purchaseType: 'trial' };
  if (flow === 'upgrade') return { usd: Number(process.env.PRICE_UPGRADE_USD || 89), tier: 'founder', purchaseType: 'perpetual' };
  let tier: LicenseTier = 'founder';
  try { tier = (await countActiveLicenses()) < FOUNDER_CAP ? 'founder' : 'standard'; } catch { /* default founder */ }
  const usd = tier === 'founder' ? Number(process.env.PRICE_OWNERSHIP_USD || 99) : Number(process.env.PRICE_STANDARD_USD || 149);
  return { usd, tier, purchaseType: 'perpetual' };
}

async function btcUsd(): Promise<number> {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { headers: { 'User-Agent': 'selam' } });
  const j = await r.json();
  const p = j?.bitcoin?.usd;
  if (!p || typeof p !== 'number') throw new Error('btc price unavailable');
  return p;
}

function addr(asset: CryptoAsset): string {
  if (asset === 'btc') return (process.env.SELAM_BTC_ADDRESS || '').trim();
  return (process.env.SELAM_BSC_ADDRESS || '').trim();
}

// Random 8-hex order id.
function newOrderId(): string {
  const b = new Uint8Array(8); globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function ensureTable() {
  await db()`
    CREATE TABLE IF NOT EXISTS crypto_orders (
      id           TEXT PRIMARY KEY,
      email        TEXT NOT NULL,
      flow         TEXT NOT NULL,
      asset        TEXT NOT NULL,
      address      TEXT NOT NULL,
      amount       NUMERIC NOT NULL,          -- unique on-chain amount to match
      usd          NUMERIC NOT NULL,
      tier         TEXT NOT NULL,
      purchase_type TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',  -- pending|paid|expired
      tx_hash      TEXT,
      license_key  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at   TIMESTAMPTZ NOT NULL
    )`;
}

export type CreateOrderResult = {
  orderId: string; asset: CryptoAsset; address: string;
  amount: string; usd: number; expiresAt: string;
};

export async function createOrder(email: string, flow: CryptoFlow, asset: CryptoAsset): Promise<CreateOrderResult> {
  const a = addr(asset);
  if (!a) throw new Error(`receiving address not configured for ${asset}`);
  await ensureTable();
  const { usd, tier, purchaseType } = await usdPrice(flow);

  // Unique amount: base + a small random offset so each pending order maps to a
  // distinct on-chain amount (lets a shared address serve many buyers).
  const jitter = () => (Math.floor(Math.random() * 900) + 100); // 100..999
  let amount: string;
  if (asset === 'btc') {
    const px = await btcUsd();
    const base = usd / px;                    // BTC
    const sats = Math.round(base * 1e8) + jitter(); // add up to ~999 sats of entropy
    amount = (sats / 1e8).toFixed(8);
  } else {
    // Stablecoins ≈ $1. Add sub-cent entropy for uniqueness.
    amount = (usd + jitter() / 1e6).toFixed(6);
  }

  const orderId = newOrderId();
  const expiresAt = new Date(Date.now() + ORDER_TTL_MS).toISOString();
  await db()`
    INSERT INTO crypto_orders (id, email, flow, asset, address, amount, usd, tier, purchase_type, expires_at)
    VALUES (${orderId}, ${email.toLowerCase()}, ${flow}, ${asset}, ${a}, ${amount}, ${usd}, ${tier}, ${purchaseType}, ${expiresAt})`;
  return { orderId, asset, address: a, amount, usd, expiresAt };
}

type OrderRow = {
  id: string; email: string; flow: CryptoFlow; asset: CryptoAsset; address: string;
  amount: string; usd: string; tier: LicenseTier; purchase_type: PurchaseType;
  status: string; tx_hash: string | null; license_key: string | null;
  created_at: string; expires_at: string;
};

// ── on-chain lookups ──────────────────────────────────────────────
// Return the tx hash of a confirmed payment of ~`amount` to `address`, else null.

async function findBtcPayment(address: string, amount: number, sinceMs: number): Promise<string | null> {
  const r = await fetch(`https://mempool.space/api/address/${address}/txs`, { headers: { 'User-Agent': 'selam' } });
  if (!r.ok) return null;
  const txs = await r.json();
  const wantSats = Math.round(amount * 1e8);
  for (const tx of (Array.isArray(txs) ? txs : [])) {
    const confirmed = tx?.status?.confirmed;
    const ts = (tx?.status?.block_time || 0) * 1000;
    if (ts && ts + 3600_000 < sinceMs) continue; // too old (1h grace before order)
    const out = (tx?.vout || []).find((v: { scriptpubkey_address?: string; value?: number }) =>
      v?.scriptpubkey_address === address && Math.abs((v.value || 0) - wantSats) <= 0);
    if (out && confirmed) return tx.txid;
  }
  return null;
}

async function findBscPayment(asset: Exclude<CryptoAsset, 'btc'>, address: string, amount: number, sinceMs: number): Promise<string | null> {
  const key = process.env.BSCSCAN_API_KEY;
  if (!key) throw new Error('BSCSCAN_API_KEY not set');
  const { contract, decimals } = BSC_TOKENS[asset];
  const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${contract}&address=${address}&page=1&offset=50&sort=desc&apikey=${key}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j?.status !== '1' || !Array.isArray(j.result)) return null;
  const want = BigInt(Math.round(amount * 10 ** 6)) * (10n ** BigInt(decimals - 6)); // amount has 6 dp
  for (const t of j.result) {
    if ((t.to || '').toLowerCase() !== address.toLowerCase()) continue;
    if ((t.contractAddress || '').toLowerCase() !== contract) continue;
    const ts = Number(t.timeStamp || 0) * 1000;
    if (ts && ts + 3600_000 < sinceMs) continue;
    let val: bigint; try { val = BigInt(t.value); } catch { continue; }
    if (val === want && Number(t.confirmations || 0) >= BSC_CONFIRMATIONS) return t.hash;
  }
  return null;
}

// Orders still worth checking on-chain: not yet minted, created within the last
// 24h (covers late confirmations even after the UI window "expired"). Cron sweeps
// these so a buyer who closed the page still gets their license.
export async function listSweepableOrders(limit = 100): Promise<string[]> {
  await ensureTable();
  const rows = await db()`
    SELECT id FROM crypto_orders
    WHERE license_key IS NULL
      AND status <> 'paid'
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at DESC
    LIMIT ${limit}` as { id: string }[];
  return rows.map((r) => r.id);
}

export type StatusResult = { status: 'pending' | 'paid' | 'expired'; licenseKey?: string; asset?: CryptoAsset; amount?: string; address?: string };

// Poll target: checks the chain, mints on first confirmation. Idempotent.
export async function checkOrder(
  orderId: string,
  mailer?: { sendPurchaseEmail: (a: { to: string; key: string; productSku: string; purchaseType?: PurchaseType; expiresAt?: string | null }) => Promise<unknown> },
): Promise<StatusResult> {
  const rows = await db()`SELECT * FROM crypto_orders WHERE id = ${orderId}` as OrderRow[];
  const o = rows[0];
  if (!o) return { status: 'expired' };
  if (o.status === 'paid' && o.license_key) return { status: 'paid', licenseKey: o.license_key, asset: o.asset, amount: o.amount, address: o.address };
  if (Date.parse(o.expires_at) < Date.now()) {
    if (o.status !== 'paid') await db()`UPDATE crypto_orders SET status='expired' WHERE id=${orderId} AND status='pending'`;
    // still allow a late payment to mint below; expiry just stops the UI countdown
  }

  const sinceMs = Date.parse(o.created_at);
  const amount = Number(o.amount);
  let txHash: string | null = null;
  try {
    txHash = o.asset === 'btc'
      ? await findBtcPayment(o.address, amount, sinceMs)
      : await findBscPayment(o.asset as Exclude<CryptoAsset, 'btc'>, o.address, amount, sinceMs);
  } catch (e) {
    console.error('[crypto-pay] chain lookup failed:', (e as Error).message);
    return { status: o.status === 'expired' ? 'expired' : 'pending', asset: o.asset, amount: o.amount, address: o.address };
  }
  if (!txHash) return { status: o.status === 'expired' ? 'expired' : 'pending', asset: o.asset, amount: o.amount, address: o.address };

  // Payment confirmed → mint the license (idempotent on the crypto ref).
  const ref = `crypto:${o.asset}:${txHash}`;
  const key = mintLicenseKey();
  const expiresAt = o.purchase_type === 'trial' ? new Date(Date.now() + 30 * 864e5).toISOString() : null;
  const rec = await insertLicense(key, o.email, 'selam-v1', ref, o.tier, o.purchase_type, expiresAt);
  await db()`UPDATE crypto_orders SET status='paid', tx_hash=${txHash}, license_key=${rec.key} WHERE id=${orderId}`;
  try { await mailer?.sendPurchaseEmail({ to: o.email, key: rec.key, productSku: 'selam-v1', purchaseType: o.purchase_type, expiresAt }); } catch (e) { console.error('[crypto-pay] email failed:', (e as Error).message); }
  return { status: 'paid', licenseKey: rec.key, asset: o.asset, amount: o.amount, address: o.address };
}
