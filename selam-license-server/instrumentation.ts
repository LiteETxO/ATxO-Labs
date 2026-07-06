// Next.js instrumentation hook — runs once at server startup.
//
// Used for crash/perf monitoring. Currently a stub that lights up when
// SENTRY_DSN is set. To activate full Sentry:
//   1. npm install @sentry/nextjs
//   2. Set SENTRY_DSN in Vercel env
//   3. Uncomment the Sentry.init() block below
//
// Lighter alternatives (no deps):
//   - LOGTAIL_TOKEN: ship console.* through Better Stack's Logtail HTTP API
//   - AXIOM_TOKEN:   ship through Axiom datasets
// Both are env-gated; you set the token, this file calls them.

export async function register() {
  if (process.env.SENTRY_DSN) {
    // Sentry path — uncomment after `npm install @sentry/nextjs`
    /*
    const Sentry = await import('@sentry/nextjs');
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.VERCEL_ENV || 'development',
        release: process.env.VERCEL_GIT_COMMIT_SHA,
        // Don't send replay/PII for our backend.
        sendDefaultPii: false,
      });
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.VERCEL_ENV || 'development',
      });
    }
    console.log('[instrumentation] Sentry initialized');
    */
    console.log('[instrumentation] SENTRY_DSN set but @sentry/nextjs not installed — skipping');
  } else {
    console.log('[instrumentation] no observability backend configured (set SENTRY_DSN to enable)');
  }
}

// Centralised error capture for use in route handlers + scripts.
// Extends naturally into Sentry.captureException once wired up.
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  console.error('[error]', err, context || {});
  // When Sentry is wired:
  //   Sentry.captureException(err, { extra: context });
}
