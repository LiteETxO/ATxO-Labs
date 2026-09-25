'use client';
// Crypto checkout — pay in BTC or a BSC stablecoin (USDC / USDT / USD1).
// Flow: email + asset → POST /api/crypto/checkout → show exact amount + address
// + QR → poll /api/crypto/status until the on-chain payment confirms → license.
import { useEffect, useRef, useState } from 'react';

type Asset = 'btc' | 'usdc' | 'usdt' | 'usd1';
type Order = { orderId: string; asset: Asset; address: string; amount: string; usd: number; expiresAt: string };

const ASSETS: { id: Asset; label: string; note: string }[] = [
  { id: 'btc', label: 'Bitcoin', note: 'BTC' },
  { id: 'usdc', label: 'USDC', note: 'BSC' },
  { id: 'usdt', label: 'USDT', note: 'BSC' },
  { id: 'usd1', label: 'USD1', note: 'BSC' },
];

const NET: Record<Asset, string> = { btc: 'Bitcoin network', usdc: 'BNB Smart Chain (BEP-20)', usdt: 'BNB Smart Chain (BEP-20)', usd1: 'BNB Smart Chain (BEP-20)' };

function payUri(o: Order): string {
  if (o.asset === 'btc') return `bitcoin:${o.address}?amount=${o.amount}`;
  return o.address; // BSC: wallets scan the address; amount shown separately
}

export default function PayCrypto() {
  const [email, setEmail] = useState('');
  const [flow, setFlow] = useState<'ownership' | 'trial'>('ownership');
  const [asset, setAsset] = useState<Asset>('btc');
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<'idle' | 'creating' | 'waiting' | 'paid' | 'expired' | 'error'>('idle');
  const [licenseKey, setLicenseKey] = useState('');
  const [err, setErr] = useState('');
  const [left, setLeft] = useState(0);
  // Conservative default: only BTC (always-on) until /config confirms more —
  // avoids a flash of unavailable stablecoins in SSR / first paint.
  const [enabled, setEnabled] = useState<Record<Asset, boolean>>({ btc: true, usdc: false, usdt: false, usd1: false });
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  // Which assets are actually accepted right now (BTC may be live before the
  // BSC stablecoins are configured). Default optimistic, then narrow.
  useEffect(() => {
    fetch('/api/crypto/config').then((r) => r.json()).then((j) => {
      if (j?.assets) { setEnabled(j.assets); if (!j.assets[asset]) { const first = (['btc', 'usdc', 'usdt', 'usd1'] as Asset[]).find((a) => j.assets[a]); if (first) setAsset(first); } }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setErr(''); setStatus('creating');
    try {
      const r = await fetch('/api/crypto/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, flow, asset }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || 'Could not start checkout'); setStatus('error'); return; }
      setOrder(j); setStatus('waiting');
    } catch { setErr('Network error'); setStatus('error'); }
  }

  // Poll status + countdown once an order exists.
  useEffect(() => {
    if (!order || status !== 'waiting') return;
    const tick = async () => {
      try {
        const r = await fetch(`/api/crypto/status?orderId=${order.orderId}`, { cache: 'no-store' });
        const j = await r.json();
        if (j.status === 'paid' && j.licenseKey) { setLicenseKey(j.licenseKey); setStatus('paid'); }
        else if (j.status === 'expired') setStatus('expired');
      } catch { /* keep polling */ }
    };
    poll.current = setInterval(tick, 6000); tick();
    const cd = setInterval(() => setLeft(Math.max(0, Math.floor((Date.parse(order.expiresAt) - Date.now()) / 1000))), 1000);
    return () => { if (poll.current) clearInterval(poll.current); clearInterval(cd); };
  }, [order, status]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');

  return (
    <main style={{ minHeight: '100vh', background: '#0a0c13', color: '#eef1fb', fontFamily: '-apple-system,system-ui,sans-serif', display: 'flex', justifyContent: 'center', padding: '48px 20px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 6 }}>Pay with crypto</h1>
        <p style={{ color: '#aab2d0', marginBottom: 28 }}>Own Selam with {(['btc','usdc','usdt','usd1'] as Asset[]).filter((a) => enabled[a]).map((a) => a === 'btc' ? 'Bitcoin' : a.toUpperCase()).join(', ').replace(/, ([^,]*)$/, ' or $1')}. Your license is emailed the moment your payment confirms on-chain.</p>

        {status !== 'paid' && status !== 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ fontSize: 13, color: '#aab2d0' }}>Email (where we send your license)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                style={{ width: '100%', marginTop: 6, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(130,170,255,.25)', background: '#0c0e16', color: '#fff', fontSize: 15 }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['ownership', 'trial'] as const).map((f) => (
                <button key={f} onClick={() => setFlow(f)} style={btn(flow === f)}>{f === 'ownership' ? 'Own it — $99' : 'Try 30 days — $10'}</button>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#aab2d0', marginBottom: 8 }}>Pay with</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {ASSETS.filter((a) => enabled[a.id]).map((a) => (
                  <button key={a.id} onClick={() => setAsset(a.id)} style={btn(asset === a.id)}>
                    <span style={{ fontWeight: 700 }}>{a.label}</span> <span style={{ color: '#8aa4ea', fontSize: 12 }}>{a.note}</span>
                  </button>
                ))}
                {ASSETS.some((a) => !enabled[a.id]) && (
                  <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#7a83a6', marginTop: 2 }}>
                    {ASSETS.filter((a) => !enabled[a.id]).map((a) => a.label).join(', ')} coming soon.
                  </div>
                )}
              </div>
            </div>
            <button onClick={start} disabled={status === 'creating' || !email}
              style={{ marginTop: 6, padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#8aa4ea,#5f7ac6)', color: '#0b0e1c', fontWeight: 700, fontSize: 16, cursor: 'pointer', opacity: (status === 'creating' || !email) ? .6 : 1 }}>
              {status === 'creating' ? 'Starting…' : 'Continue'}
            </button>
            {err && <p style={{ color: '#ff8a9a', fontSize: 14 }}>{err}</p>}
          </div>
        )}

        {status === 'waiting' && order && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#aab2d0', marginBottom: 16 }}>Send <b style={{ color: '#fff' }}>exactly</b> this amount on the <b>{NET[order.asset]}</b>:</p>
            <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 4 }}>{order.amount} {order.asset.toUpperCase()}</div>
            <div style={{ color: '#7a83a6', fontSize: 13, marginBottom: 20 }}>≈ ${order.usd} USD</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="payment QR" width={200} height={200} style={{ borderRadius: 12, background: '#fff', padding: 8 }}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payUri(order))}`} />
            <div style={{ marginTop: 16, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13, background: '#0c0e16', border: '1px solid rgba(130,170,255,.2)', borderRadius: 10, padding: '12px 14px' }}>{order.address}</div>
            <button onClick={() => navigator.clipboard?.writeText(order.address)} style={{ marginTop: 10, ...btn(false), width: 'auto', padding: '8px 16px' }}>Copy address</button>
            <p style={{ marginTop: 22, color: '#8aa4ea' }}>⏳ Waiting for payment… (expires in {mm}:{ss})</p>
            <p style={{ color: '#7a83a6', fontSize: 12, marginTop: 8 }}>Send the exact amount so we can match your payment. Keep this page open — your license appears here and is emailed on confirmation.</p>
          </div>
        )}

        {status === 'paid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Payment confirmed — welcome to Selam!</h2>
            <p style={{ color: '#aab2d0', marginBottom: 16 }}>Your license key (also emailed to you):</p>
            <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, background: '#0c0e16', border: '1px solid rgba(130,170,255,.35)', borderRadius: 12, padding: '16px' }}>{licenseKey}</div>
            <a href="/download" style={{ display: 'inline-block', marginTop: 22, padding: '14px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#8aa4ea,#5f7ac6)', color: '#0b0e1c', fontWeight: 700, textDecoration: 'none' }}>Download Selam →</a>
          </div>
        )}

        {status === 'expired' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#ff8a9a', marginBottom: 16 }}>This payment window expired. If you already sent it, your license will still be emailed once it confirms — otherwise start again.</p>
            <button onClick={() => { setOrder(null); setStatus('idle'); }} style={btn(true)}>Start over</button>
          </div>
        )}
      </div>
    </main>
  );
}

function btn(active: boolean): React.CSSProperties {
  return { flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 14,
    border: active ? '1px solid #8aa4ea' : '1px solid rgba(130,170,255,.2)',
    background: active ? 'rgba(138,164,234,.15)' : '#0c0e16', color: active ? '#dfe6ff' : '#aab2d0' };
}
