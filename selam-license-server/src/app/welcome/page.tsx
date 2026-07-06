// /welcome — post-purchase landing.
//
// Stripe redirects buyers here after checkout success with
// ?session_id=cs_xxx. We verify the session server-side, render a
// confirmation, and point the buyer at their email + the download.
//
// Deliberately does NOT echo the license key on the page. Two reasons:
//   1. Email is the canonical secure delivery channel; a buyer who
//      doesn't get the email can use /recover.
//   2. Session IDs are long random strings but they're URL-shaped — a
//      bookmarked /welcome URL or a logged URL elsewhere shouldn't leak
//      the key.

import type { Metadata } from 'next';
import Stripe from 'stripe';

export const metadata: Metadata = {
  title: 'Welcome to Selam',
  description: 'Your Selam license is ready — your AI worker for Mac.',
};

// Server-side verification. Returns the Stripe session if paid, null
// otherwise. We import Stripe lazily so missing STRIPE_SECRET_KEY in
// dev doesn't blow up unrelated routes.
async function verifyStripeSession(sessionId: string | undefined): Promise<{
  status: 'paid' | 'pending' | 'failed' | 'invalid';
  email?: string;
  amountTotal?: number;
  currency?: string;
}> {
  if (!sessionId || !sessionId.startsWith('cs_')) return { status: 'invalid' };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { status: 'invalid' };

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      return {
        status: 'paid',
        email: session.customer_details?.email || undefined,
        amountTotal: session.amount_total || undefined,
        currency: session.currency?.toUpperCase() || 'USD',
      };
    }
    if (session.payment_status === 'unpaid') return { status: 'pending' };
    return { status: 'failed' };
  } catch (e) {
    console.warn('[welcome] verifyStripeSession failed:', (e as Error).message);
    return { status: 'invalid' };
  }
}

function formatAmount(amount?: number, currency = 'USD'): string {
  if (!amount) return '';
  // Stripe amounts are in the smallest currency unit (cents for USD/EUR).
  const major = amount / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
}

function maskedEmail(email?: string): string {
  if (!email) return 'your inbox';
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'your inbox';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export default async function WelcomePage(props: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await props.searchParams;
  const verification = await verifyStripeSession(params.session_id);

  if (verification.status === 'invalid' || verification.status === 'failed') {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.brand}>Selam</div>
          <h1 style={styles.h1}>Hmm, we couldn&apos;t verify that purchase.</h1>
          <p style={styles.sub}>
            Sometimes Stripe needs a few seconds to mark a session paid. Refresh
            this page in a moment, or check your inbox — your license key
            arrives by email regardless.
          </p>
          <div style={styles.actions}>
            <a href="/recover" style={styles.linkButton}>Recover by email →</a>
          </div>
          <div style={styles.footer}>
            Need help? <a href="mailto:support@heyselam.app" style={styles.link}>support@heyselam.app</a>
          </div>
        </div>
      </main>
    );
  }

  if (verification.status === 'pending') {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.brand}>Selam</div>
          <h1 style={styles.h1}>Almost there.</h1>
          <p style={styles.sub}>
            Stripe is finishing your payment. Refresh this page in a few seconds —
            or check your inbox once the charge clears.
          </p>
          <div style={styles.footer}>
            Need help? <a href="mailto:support@heyselam.app" style={styles.link}>support@heyselam.app</a>
          </div>
        </div>
      </main>
    );
  }

  // status === 'paid'
  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.brand}>Selam</div>
        <h1 style={styles.h1}>Welcome to Selam.</h1>
        <p style={styles.sub}>
          You just hired an AI worker for your Mac. Everything you need to put
          them to work is on the way.
        </p>

        {verification.amountTotal && (
          <div style={styles.receiptRow}>
            <span>Receipt</span>
            <span style={styles.receiptAmount}>
              {formatAmount(verification.amountTotal, verification.currency)} · paid
            </span>
          </div>
        )}

        <div style={styles.steps}>
          <div style={styles.step}>
            <div style={styles.stepNum}>1</div>
            <div>
              <div style={styles.stepTitle}>Check your inbox</div>
              <div style={styles.stepBody}>
                Your license key just went to <strong>{maskedEmail(verification.email)}</strong>.
                It usually arrives in under a minute. Check spam if you don&apos;t see it.
              </div>
            </div>
          </div>

          <div style={styles.step}>
            <div style={styles.stepNum}>2</div>
            <div>
              <div style={styles.stepTitle}>Download Selam</div>
              <div style={styles.stepBody}>
                <a href="https://api.heyselam.app/download" style={styles.downloadLink}>
                  api.heyselam.app/download
                </a>
              </div>
            </div>
          </div>

          <div style={styles.step}>
            <div style={styles.stepNum}>3</div>
            <div>
              <div style={styles.stepTitle}>Put them to work</div>
              <div style={styles.stepBody}>
                Drag to Applications, open it, and paste your license key.
                Connect your AI provider keys, then ask:{' '}
                <em>“Look at my screen and tell me one thing I should do about it.”</em>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.lostKey}>
          Email never arrives? <a href="/recover" style={styles.link}>Recover your key →</a>
        </div>

        <div style={styles.footer}>
          Questions? Reply to your purchase email or write to&nbsp;
          <a href="mailto:support@heyselam.app" style={styles.link}>support@heyselam.app</a>.
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
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: '#50b4ff',
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  h1: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: '0 0 10px',
  },
  sub: {
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.55,
    margin: '0 0 26px',
  },
  receiptRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
    paddingBottom: 16,
    marginBottom: 22,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  receiptAmount: {
    color: 'rgba(255,255,255,0.78)',
    fontFeatureSettings: '"tnum"',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    marginBottom: 24,
  },
  step: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
  },
  stepNum: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(80,180,255,0.14)',
    color: '#50b4ff',
    border: '1px solid rgba(80,180,255,0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12.5,
    fontWeight: 700,
    marginTop: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f2f2f2',
    marginBottom: 3,
  },
  stepBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.55,
  },
  downloadLink: {
    color: '#50b4ff',
    textDecoration: 'none',
    fontWeight: 500,
  },
  lostKey: {
    marginTop: 8,
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 9,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.55)',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginBottom: 18,
  },
  linkButton: {
    background: 'rgba(80,180,255,0.14)',
    color: '#50b4ff',
    border: '1px solid rgba(80,180,255,0.25)',
    borderRadius: 9,
    padding: '11px 14px',
    fontSize: 13,
    textDecoration: 'none',
    fontWeight: 500,
  },
  footer: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.42)',
    lineHeight: 1.65,
  },
  link: {
    color: '#50b4ff',
    textDecoration: 'none',
  },
};
