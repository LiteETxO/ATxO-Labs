// ─── Email adapter (Resend) ──────────────────────────────────────────
//
// Wraps Resend's SDK for the email-sending endpoints (recovery + Stripe
// purchase confirmation). Built on top of the pure email templates in
// `../../email-templates/`.
//
// Failures are logged but never thrown to the caller — recovery and
// post-purchase emails are best-effort; we don't fail a Stripe webhook
// because Resend hiccupped. Use Resend's webhooks for delivery
// observability.

import { Resend } from 'resend';
// We import the pure JS templates directly. The package.json `allowJs`
// setting lets TS consume CJS modules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildRecoveryEmail } = require('../../email-templates/recovery.js') as {
  buildRecoveryEmail: (input: {
    to: string;
    keys: Array<{ key: string }>;
    sentAt?: Date;
    from?: string;
  }) => { from: string; to: string; subject: string; html: string; text: string };
};
type PurchaseTemplate = (input: {
  to: string;
  key: string;
  productSku?: string;
  downloadUrl?: string;
  sentAt?: Date;
  from?: string;
}) => { from: string; to: string; subject: string; html: string; text: string };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPurchaseEmail } = require('../../email-templates/purchase.js') as {
  buildPurchaseEmail: PurchaseTemplate;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPurchaseEmailB } = require('../../email-templates/purchase-b.js') as {
  buildPurchaseEmailB: PurchaseTemplate;
};

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not set');
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = process.env.RESEND_FROM || 'Selam <support@heyselam.app>';

// Used by /api/recover — sends the recovery email with all of the
// buyer's active license keys.
export async function sendRecoveryEmail(args: {
  to: string;
  keys: Array<{ key: string }>;
  sentAt?: Date;
}): Promise<void> {
  const msg = buildRecoveryEmail({ ...args, from: FROM });
  const r = await getResend().emails.send({
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
  if (r.error) {
    // Surface to logs but don't throw — caller absorbs send failures.
    console.error('[mailer] recovery send error:', r.error);
  }
}

// Used by /api/stripe/webhook on checkout.session.completed — sends the
// "your purchase is ready" email with download link + license key.
//
// `variant` selects between purchase.js (A — download-mechanics-led) and
// purchase-b.js (B — first-session-retention-led). Defaults to 'a' for
// callers that haven't been updated. The Resend tag `purchase_variant`
// makes open/click rates filterable by variant in the Resend dashboard.
export async function sendPurchaseEmail(args: {
  to: string;
  key: string;
  productSku: string;
  downloadUrl?: string;
  sentAt?: Date;
  variant?: 'a' | 'b';
}): Promise<void> {
  const variant = args.variant === 'b' ? 'b' : 'a';
  const build = variant === 'b' ? buildPurchaseEmailB : buildPurchaseEmail;
  const msg = build({ ...args, from: FROM });
  const r = await getResend().emails.send({
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    tags: [
      { name: 'kind', value: 'purchase' },
      { name: 'purchase_variant', value: variant },
    ],
  });
  if (r.error) {
    console.error('[mailer] purchase send error:', r.error);
  }
}
