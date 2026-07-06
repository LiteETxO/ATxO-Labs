// Buyer-facing license recovery form.
// Lives at https://api.heyselam.app/recover.
// heyselam.app/recover should redirect here (Next.js redirects in
// the marketing site OR a simple Vercel redirect rule).

'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export default function RecoverPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 202) {
        setStatus('sent');
      } else if (res.status === 429) {
        setStatus('error');
        setErrorMsg(data.error || 'Too many requests — try again in a few minutes.');
      } else if (res.status === 400) {
        setStatus('error');
        setErrorMsg(data.error || 'Please enter a valid email address.');
      } else {
        setStatus('error');
        setErrorMsg(data.error || `Could not process your request (status ${res.status}).`);
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Check your connection and try again.');
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.brand}>Selam</div>
        <h1 style={styles.h1}>Recover your license</h1>
        <p style={styles.sub}>
          Enter the email you used at purchase. We&apos;ll send your license key to that address.
        </p>

        {status === 'sent' ? (
          <div style={styles.ok}>
            <strong>Check your inbox.</strong><br />
            If we have a license on file for that email, we just sent it.
            The email may take a minute to arrive.
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === 'submitting'}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={status === 'submitting' || !email}
              style={{
                ...styles.button,
                ...(status === 'submitting' || !email ? styles.buttonDisabled : {}),
              }}
            >
              {status === 'submitting' ? 'Sending…' : 'Send my license key'}
            </button>
          </form>
        )}

        {status === 'error' && (
          <div style={styles.error}>{errorMsg}</div>
        )}

        <div style={styles.footer}>
          Need help? <a href="mailto:support@heyselam.app" style={styles.link}>support@heyselam.app</a>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#0e0e14',
    color: '#f2f2f2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    background: 'rgba(20, 22, 30, 0.98)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '32px 28px',
  },
  brand: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: '#50b4ff',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    margin: '0 0 6px',
  },
  sub: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.55,
    margin: '0 0 22px',
  },
  input: {
    width: '100%',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    padding: '11px 13px',
    color: '#f2f2f2',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 10,
  },
  button: {
    width: '100%',
    background: 'rgba(80,180,255,0.14)',
    color: '#50b4ff',
    border: '1px solid rgba(80,180,255,0.25)',
    borderRadius: 9,
    padding: '11px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  ok: {
    background: 'rgba(111,255,161,0.06)',
    border: '1px solid rgba(111,255,161,0.25)',
    borderRadius: 9,
    padding: '14px 16px',
    fontSize: 13,
    lineHeight: 1.55,
    color: '#a8ffc6',
  },
  error: {
    marginTop: 12,
    background: 'rgba(255,107,107,0.06)',
    border: '1px solid rgba(255,107,107,0.20)',
    borderRadius: 9,
    padding: '10px 12px',
    fontSize: 12.5,
    lineHeight: 1.5,
    color: '#ff8f8f',
  },
  footer: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  link: {
    color: '#50b4ff',
    textDecoration: 'none',
  },
};
