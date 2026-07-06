// Custom 404. Lands the user back on something useful instead of
// staring at "default Next.js error".

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Not found — Selam',
};

export default function NotFound() {
  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.brand}>Selam</div>
        <div style={styles.code}>404</div>
        <h1 style={styles.h1}>This page wandered off.</h1>
        <p style={styles.sub}>
          Maybe you were looking for one of these?
        </p>

        <div style={styles.links}>
          <a href="https://heyselam.app" style={styles.linkButton}>← Back to heyselam.app</a>
          <a href="/recover" style={styles.linkRow}>Recover your license key</a>
          <a href="/buy" style={styles.linkRow}>Buy Selam</a>
          <a href="mailto:support@heyselam.app" style={styles.linkRow}>support@heyselam.app</a>
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
    maxWidth: 460,
    background: 'rgba(20, 22, 30, 0.98)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '32px 28px',
    textAlign: 'center',
  },
  brand: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
    color: '#50b4ff', textTransform: 'uppercase', marginBottom: 24,
  },
  code: {
    fontSize: 56, fontWeight: 700, letterSpacing: '-0.02em',
    color: 'rgba(255,255,255,0.18)', lineHeight: 1, marginBottom: 6,
  },
  h1: {
    fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 8px',
  },
  sub: {
    fontSize: 13.5, color: 'rgba(255,255,255,0.5)', margin: '0 0 22px',
  },
  links: {
    display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
  },
  linkButton: {
    display: 'block',
    background: 'rgba(80,180,255,0.14)',
    color: '#50b4ff',
    border: '1px solid rgba(80,180,255,0.25)',
    borderRadius: 9,
    padding: '11px 16px',
    fontSize: 13,
    textDecoration: 'none',
    fontWeight: 500,
    width: '100%',
  },
  linkRow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12.5,
    textDecoration: 'none',
    padding: '4px 8px',
  },
};
