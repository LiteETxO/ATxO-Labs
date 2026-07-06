// /download — buyer-facing download landing.
//
// The purchase email + welcome page link here. Reads the current version
// from the R2 update manifest so the link always points at the latest
// build — no manual updates when you ship 1.0.1.

import type { Metadata } from 'next';
import { getCurrentManifest } from '@/lib/update-feed';

export const metadata: Metadata = {
  title: 'Download Selam',
  description: 'Download Selam for macOS — an AI worker that lives on your Mac.',
  openGraph: {
    title: 'Download Selam',
    description: 'Download Selam for macOS — your AI worker for Mac.',
    url: 'https://api.heyselam.app/download',
  },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return ''; }
}

export default async function DownloadPage() {
  const manifest = await getCurrentManifest();

  if (!manifest) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.brand}>Selam</div>
          <h1 style={styles.h1}>Download is temporarily unavailable.</h1>
          <p style={styles.sub}>
            We can&apos;t reach our update feed right now. Try refreshing in a
            minute, or contact support.
          </p>
          <div style={styles.footer}>
            <a href="mailto:support@heyselam.app" style={styles.link}>support@heyselam.app</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.brand}>Selam</div>
        <h1 style={styles.h1}>Download Selam for Mac</h1>
        <p style={styles.sub}>
          Your AI worker — reads your screen, drafts your messages, runs
          across WhatsApp, Telegram, and iMessage. Asks before doing
          anything risky. Bring your own AI keys.
        </p>

        <a href={manifest.fileUrl} style={styles.button} download>
          Download Selam {manifest.version}
        </a>

        <div style={styles.meta}>
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>Version</span>
            <span style={styles.metaValue}>{manifest.version}</span>
          </div>
          {manifest.size && (
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Size</span>
              <span style={styles.metaValue}>{formatBytes(manifest.size)}</span>
            </div>
          )}
          {manifest.releaseDate && (
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>Released</span>
              <span style={styles.metaValue}>{formatDate(manifest.releaseDate)}</span>
            </div>
          )}
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>Requires</span>
            <span style={styles.metaValue}>macOS 12.0 or later · Apple Silicon</span>
          </div>
        </div>

        <div style={styles.installSteps}>
          <div style={styles.stepHeader}>To install</div>
          <ol style={styles.stepList}>
            <li>Open the downloaded <code style={styles.code}>.dmg</code></li>
            <li>Drag <strong>Selam</strong> to your Applications folder</li>
            <li>Launch Selam — paste your license key when prompted</li>
          </ol>
        </div>

        <div style={styles.footer}>
          Don&apos;t have a license yet? <a href="/buy" style={styles.link}>Buy Selam — $199 →</a><br />
          Lost your key? <a href="/recover" style={styles.link}>Recover by email →</a>
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
    maxWidth: 520,
    background: 'rgba(20, 22, 30, 0.98)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '40px 32px',
  },
  brand: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
    color: '#50b4ff', textTransform: 'uppercase', marginBottom: 18,
  },
  h1: {
    fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2,
    margin: '0 0 8px',
  },
  sub: {
    fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55,
    margin: '0 0 26px',
  },
  button: {
    display: 'block',
    width: '100%',
    padding: '15px 18px',
    background: 'rgba(80,180,255,0.18)',
    color: '#7ec4ff',
    border: '1px solid rgba(80,180,255,0.32)',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    textAlign: 'center',
    textDecoration: 'none',
    boxSizing: 'border-box',
  },
  meta: {
    marginTop: 22,
    paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column', gap: 6,
    fontSize: 12.5,
  },
  metaRow: {
    display: 'flex', justifyContent: 'space-between',
    color: 'rgba(255,255,255,0.55)',
  },
  metaLabel: { color: 'rgba(255,255,255,0.42)' },
  metaValue: { color: 'rgba(255,255,255,0.78)', fontFeatureSettings: '"tnum"' },

  installSteps: {
    marginTop: 22,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
  },
  stepHeader: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
    marginBottom: 8,
  },
  stepList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 13.5, lineHeight: 1.7,
    color: 'rgba(255,255,255,0.78)',
  },
  code: {
    fontFamily: '"SF Mono", "Menlo", monospace',
    fontSize: 12,
    background: 'rgba(255,255,255,0.06)',
    padding: '1px 5px',
    borderRadius: 4,
  },
  footer: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.7,
  },
  link: { color: '#50b4ff', textDecoration: 'none' },
};
