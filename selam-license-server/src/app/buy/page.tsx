// Buyer-facing /buy landing — minimal, confident "buy Selam" page.
// POSTs to /api/checkout/session and redirects to Stripe-hosted checkout.
//
// Most traffic should come from heyselam.app/buy → redirect here, OR from
// a "Buy Now" button on the marketing site that links straight to this URL.

// metadata is in layout.tsx (alongside this file) — Next.js requires
// metadata exports from server components, but this is 'use client'.
'use client';

import { useEffect, useState } from 'react';

type Status = 'idle' | 'redirecting' | 'error';

type FounderInfo = {
  cap: number;
  remaining: number | null;
  founder_open: boolean;
  price_usd: number;
};

// Until /api/founder answers, render the founder state — it matches the
// server's own fail-open default, so the page and checkout never disagree.
const DEFAULT_FOUNDER: FounderInfo = {
  cap: 100, remaining: null, founder_open: true, price_usd: 99,
};

const BASE_FEATURES = [
  'Runs ops overnight and reports back by morning',
  'Operates across WhatsApp, Telegram and iMessage',
  'Voice + on-device avatar — face, voice and name you choose',
  'Trust scopes: asks before doing anything you wouldn’t',
  'Bring your own AI keys (Anthropic, ElevenLabs, Simli)',
];

export default function BuyPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError]   = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [founder, setFounder] = useState<FounderInfo>(DEFAULT_FOUNDER);

  useEffect(() => {
    fetch('/api/founder')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FounderInfo | null) => { if (d && typeof d.price_usd === 'number') setFounder(d); })
      .catch(() => { /* keep founder default */ });
  }, []);

  // Detect ?cancelled=1 — Stripe sends buyers here when they back out
  // of the checkout. Soft-acknowledge so they can try again.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('cancelled') === '1') setCancelled(true);
    }
  }, []);

  async function startCheckout() {
    setStatus('redirecting');
    setError('');
    try {
      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setStatus('error');
        setError(data.error || `Could not start checkout (status ${res.status}).`);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Network error.');
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.glow} aria-hidden />
      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.brandDash} />Selam · by Deribe Labs
        </div>
        <h1 style={styles.h1}>
          Hire an autonomous <em style={styles.em}>operator</em> for your Mac.
        </h1>
        <p style={styles.sub}>
          Set the goal once. Selam takes initiative — directs her own sub-agents,
          runs work overnight, and reaches people across WhatsApp, Telegram and
          iMessage — then reports back what got done. You pick the face, the voice,
          the name. She asks before anything irreversible.
        </p>

        {founder.founder_open && (
          <div style={styles.founderTag}>
            Founder license
            {typeof founder.remaining === 'number'
              ? ` · ${founder.remaining} of ${founder.cap} remaining`
              : ` · first ${founder.cap}`}
          </div>
        )}

        <div style={styles.priceRow}>
          <div style={styles.priceMain}>${founder.price_usd}</div>
          <div style={styles.priceSub}>
            {founder.founder_open
              ? 'one-time · lifetime updates'
              : 'one-time · one year of updates'}
          </div>
        </div>

        {/* Public price ladder — quantity-stepped, pre-announced. Each
            step-up is real and permanent; the sellout is the marketing. */}
        <div style={{ fontSize: 13, color: 'rgba(244,239,228,0.55)', margin: '2px 0 4px' }}>
          $99 for the first {founder.cap} · $149 after that · $199 standard. The price only moves up.
        </div>
        <div style={{ fontSize: 13.5, color: 'rgba(244,239,228,0.7)', margin: '10px 0 2px', lineHeight: 1.5 }}>
          ChatGPT&nbsp;Pro is $200 <em>a month</em>. Selam is ${founder.price_usd} <em>once</em> — she runs on your own
          API keys at raw cost. And lifetime is honest here for a structural reason: your keys mean our
          marginal cost is zero. We&apos;re not promising compute we can&apos;t afford — that&apos;s why this
          price can exist.
        </div>

        <ul style={styles.features}>
          {[...BASE_FEATURES,
            founder.founder_open
              ? 'Lifetime updates — founder license, locked in forever'
              : 'One year of updates included — your version is yours forever',
          ].map((f) => (
            <li key={f} style={styles.feature}>
              <span style={styles.dot} />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={startCheckout}
          disabled={status === 'redirecting'}
          style={{
            ...styles.button,
            ...(status === 'redirecting' ? styles.buttonDisabled : {}),
          }}
        >
          {status === 'redirecting' ? 'Redirecting to Stripe…' : `Hire Selam — $${founder.price_usd} →`}
        </button>

        <div style={styles.fineprint}>
          Tax (VAT/GST/sales) calculated at checkout based on your location.
          Refundable within 14 days.
        </div>

        {cancelled && (
          <div style={styles.cancelled}>
            <strong>Checkout cancelled.</strong> No charge was made. You can try again
            any time.
          </div>
        )}

        {status === 'error' && (
          <div style={styles.error}>{error}</div>
        )}

        <div style={styles.footer}>
          By purchasing you agree to the&nbsp;
          <a href="/terms" style={styles.link}>Terms</a> and&nbsp;
          <a href="https://heyselam.app/eula" style={styles.link}>EULA</a>.
          Already bought?&nbsp;
          <a href="/recover" style={styles.link}>Recover your key</a>.
          <div style={styles.brandfoot}>macOS 14+ · Apple silicon recommended · 500 MB</div>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    position: 'relative',
    minHeight: '100vh',
    background: '#0a0b11',
    color: '#f4efe4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans), system-ui, sans-serif',
    fontSize: 16,
    lineHeight: 1.6,
    WebkitFontSmoothing: 'antialiased',
    padding: '28px',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    left: '50%',
    top: '-12%',
    width: 680,
    height: 680,
    transform: 'translateX(-50%)',
    background: 'radial-gradient(circle, rgba(231,177,92,0.10), transparent 62%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 540,
    background: 'linear-gradient(180deg, #14161f, #0e1018)',
    border: '1px solid rgba(232,221,200,0.18)',
    borderRadius: 18,
    padding: '44px 38px',
    boxShadow: '0 40px 120px -40px rgba(0,0,0,0.7)',
  },
  founderTag: {
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#e7b15c',
    border: '1px solid rgba(231,177,92,0.55)',
    borderRadius: 100,
    padding: '5px 12px',
    marginBottom: 16,
  },
  brand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.14em',
    color: '#e7b15c',
    textTransform: 'uppercase',
    marginBottom: 22,
  },
  brandDash: {
    width: 26,
    height: 1,
    background: '#e7b15c',
    opacity: 0.6,
  },
  h1: {
    fontFamily: 'var(--font-serif), Georgia, serif',
    fontSize: 34,
    fontWeight: 500,
    letterSpacing: '-0.022em',
    lineHeight: 1.08,
    margin: '0 0 14px',
  },
  em: {
    fontStyle: 'italic',
    color: '#f0cd8f',
  },
  sub: {
    fontSize: 15.5,
    color: '#b6b3ab',
    lineHeight: 1.62,
    margin: '0 0 30px',
    maxWidth: '46ch',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    margin: '0 0 26px',
    paddingBottom: 24,
    borderBottom: '1px solid rgba(232,221,200,0.10)',
  },
  priceMain: {
    fontFamily: 'var(--font-serif), Georgia, serif',
    fontSize: 42,
    fontWeight: 500,
    letterSpacing: '-0.02em',
    color: '#f4efe4',
  },
  priceSub: {
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 11.5,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#7c7a76',
  },
  features: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 30px',
    display: 'grid',
    gap: 11,
  },
  feature: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 13,
    fontSize: 14.5,
    lineHeight: 1.5,
    color: '#b6b3ab',
  },
  dot: {
    flex: 'none',
    marginTop: 8,
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#e7b15c',
    boxShadow: '0 0 10px rgba(231,177,92,0.5)',
  },
  button: {
    width: '100%',
    background: '#e7b15c',
    color: '#241606',
    border: 'none',
    borderRadius: 12,
    padding: '16px',
    fontFamily: 'var(--font-sans), system-ui, sans-serif',
    fontSize: 15.5,
    fontWeight: 600,
    letterSpacing: '0.005em',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.15s',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  fineprint: {
    marginTop: 14,
    fontSize: 12,
    color: '#7c7a76',
    lineHeight: 1.55,
  },
  cancelled: {
    marginTop: 18,
    background: 'rgba(231,177,92,0.07)',
    border: '1px solid rgba(231,177,92,0.22)',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 12.5,
    lineHeight: 1.55,
    color: '#f0cd8f',
  },
  error: {
    marginTop: 14,
    background: 'rgba(224,121,90,0.08)',
    border: '1px solid rgba(224,121,90,0.25)',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 12.5,
    lineHeight: 1.55,
    color: '#e0795a',
  },
  footer: {
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid rgba(232,221,200,0.10)',
    fontSize: 12,
    color: '#7c7a76',
    lineHeight: 1.75,
  },
  link: {
    color: '#e7b15c',
    textDecoration: 'none',
  },
  brandfoot: {
    marginTop: 18,
    fontFamily: 'var(--font-mono), monospace',
    fontSize: 10.5,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#7c7a76',
  },
};
