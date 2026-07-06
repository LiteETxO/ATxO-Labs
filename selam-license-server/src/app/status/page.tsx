// /status — public health page.
//
// Reads the same /api/status endpoint that ops monitoring hits, but
// renders it as a buyer-facing dashboard. The point isn't fancy graphs
// — it's giving someone whose download just failed a place to check
// "is it me, or is it them?" before opening a support email.
//
// Server-rendered at request time so the green/red dots reflect the
// state at page-load, not whatever was true on the last build.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Selam — Service Status',
  description: 'Live status of Selam download, licensing, and email systems.',
  robots: { index: false, follow: false }, // not worth indexing; matches /api/status policy
};

// The page must always reflect right-now state.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CheckResult = { ok: boolean; ms: number; detail?: string };
type StatusBody = {
  status: 'ok' | 'degraded';
  checked_at: string;
  checks: { db: CheckResult; stripe: CheckResult; resend: CheckResult };
  version: string;
  region: string;
};

async function fetchStatus(): Promise<StatusBody | null> {
  // Server-side fetch of our own status route. In production Vercel
  // resolves this to the same deployment via the VERCEL_URL env var;
  // in dev it falls back to localhost.
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  try {
    const r = await fetch(`${base}/api/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    // /api/status returns 503 on degraded but the body is still JSON
    // we want to render. Don't throw on non-2xx.
    return await r.json() as StatusBody;
  } catch {
    return null;
  }
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 10, height: 10, borderRadius: '50%',
        background: ok ? '#34c759' : '#ff3b30',
        boxShadow: ok ? '0 0 0 3px rgba(52,199,89,0.16)' : '0 0 0 3px rgba(255,59,48,0.16)',
        marginRight: 10,
        verticalAlign: 'middle',
      }}
    />
  );
}

function Row({ name, label, check, last }: { name: string; label: string; check: CheckResult; last?: boolean }) {
  return (
    <div style={last ? { ...styles.row, borderBottom: 'none' } : styles.row}>
      <div style={styles.rowMain}>
        <Dot ok={check.ok} />
        <span style={styles.rowName}>{name}</span>
        <span style={styles.rowLabel}>{label}</span>
      </div>
      <div style={styles.rowMeta}>
        {check.ok
          ? <span style={styles.metaOk}>{check.ms ? `${check.ms} ms` : 'ok'}</span>
          : <span style={styles.metaDown}>{check.detail || 'unreachable'}</span>}
      </div>
    </div>
  );
}

export default async function StatusPage() {
  const body = await fetchStatus();

  if (!body) {
    // /api/status itself didn't respond — surface that distinctly so a
    // visitor knows the issue is upstream of our checks.
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.brand}>Selam</div>
          <h1 style={styles.h1}>Status check unreachable</h1>
          <p style={styles.sub}>
            We couldn&apos;t reach our own status endpoint. This likely means
            the deployment itself is down. Try refreshing in a minute, or
            email us — we&apos;ll know about it.
          </p>
          <div style={styles.footer}>
            <a href="mailto:support@heyselam.app" style={styles.link}>support@heyselam.app</a>
          </div>
        </div>
      </main>
    );
  }

  const allOk = body.status === 'ok';
  const checkedAt = new Date(body.checked_at).toLocaleString('en-US', {
    timeZoneName: 'short',
  });

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.brand}>Selam</div>
        <div style={styles.headerRow}>
          <h1 style={styles.h1}>{allOk ? 'All systems operational' : 'Service degraded'}</h1>
          <div style={allOk ? styles.pillOk : styles.pillDown}>
            <Dot ok={allOk} />
            {allOk ? 'OK' : 'DEGRADED'}
          </div>
        </div>
        <p style={styles.sub}>
          Live status of the systems behind <code style={styles.code}>api.heyselam.app</code>.
          Refresh for the latest — this page reflects state at page-load.
        </p>

        <div style={styles.checks}>
          <Row name="License database"   label="key issuance, validation, recovery" check={body.checks.db} />
          <Row name="Stripe"              label="checkout + webhook delivery"       check={body.checks.stripe} />
          <Row name="Email (Resend)"      label="purchase + recovery emails"        check={body.checks.resend} last />
        </div>

        <div style={styles.meta}>
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>Last checked</span>
            <span style={styles.metaValue}>{checkedAt}</span>
          </div>
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>Region</span>
            <span style={styles.metaValue}>{body.region}</span>
          </div>
          <div style={styles.metaRow}>
            <span style={styles.metaLabel}>Build</span>
            <span style={styles.metaValue}>{body.version}</span>
          </div>
        </div>

        <div style={styles.footer}>
          {allOk ? (
            <>Everything looks healthy from our side.</>
          ) : (
            <>One or more services degraded. We&apos;re looking at it. </>
          )}
          <br />
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
    maxWidth: 560,
    background: 'rgba(20, 22, 30, 0.98)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '36px 32px',
  },
  brand: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
    color: '#50b4ff', textTransform: 'uppercase', marginBottom: 18,
  },
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginBottom: 8,
  },
  h1: {
    fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2,
    margin: 0,
  },
  pillOk: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    padding: '5px 11px', borderRadius: 999,
    background: 'rgba(52,199,89,0.14)', color: '#82e09c',
    border: '1px solid rgba(52,199,89,0.28)',
    display: 'flex', alignItems: 'center',
  },
  pillDown: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    padding: '5px 11px', borderRadius: 999,
    background: 'rgba(255,59,48,0.14)', color: '#ff8a82',
    border: '1px solid rgba(255,59,48,0.32)',
    display: 'flex', alignItems: 'center',
  },
  sub: {
    fontSize: 13.5, color: 'rgba(255,255,255,0.62)', lineHeight: 1.55,
    margin: '0 0 24px',
  },
  checks: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  rowMain: { display: 'flex', alignItems: 'center', gap: 0, flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: 600, color: '#f2f2f2', marginRight: 10 },
  rowLabel: { fontSize: 12.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowMeta: { fontSize: 12, marginLeft: 12, flexShrink: 0 },
  metaOk:   { color: 'rgba(255,255,255,0.55)', fontFeatureSettings: '"tnum"' },
  metaDown: { color: '#ff8a82', fontFeatureSettings: '"tnum"' },
  meta: {
    marginTop: 22, paddingTop: 16,
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
  code: {
    fontFamily: '"SF Mono", "Menlo", monospace', fontSize: 12.5,
    background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4,
  },
  footer: {
    marginTop: 22, paddingTop: 18,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: 12.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7,
  },
  link: { color: '#50b4ff', textDecoration: 'none' },
};
