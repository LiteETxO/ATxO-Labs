// POST /api/stripe/webhook — Stripe events.
//
// Wires:
//   - checkout.session.completed → mint license, insert in DB, send purchase email
//   - charge.refunded            → revoke matching license
//
// Signature verification uses STRIPE_WEBHOOK_SECRET. Body must be the
// raw request bytes (Stripe signs the exact bytes), so we use req.text()
// instead of req.json() and parse after verification.
//
// Pure business logic lives in `../../../../webhook-logic.js`. This file
// is the thin signature-verifying adapter.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { insertLicense, revokeLicenseByStripeSession } from '@/lib/db';
import { sendPurchaseEmail } from '@/lib/mailer';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webhookLogic = require('../../../../../webhook-logic.js') as {
  processCheckoutCompleted: (
    session: Stripe.Checkout.Session,
    ctx: {
      db: { insertLicense: typeof insertLicense };
      mailer: { sendPurchaseEmail: typeof sendPurchaseEmail };
      logger?: Console;
    },
  ) => Promise<{ status: 'ok' | 'error'; retry?: boolean; body?: Record<string, unknown> }>;
  processChargeRefunded: (
    charge: Stripe.Charge,
    ctx: {
      db: { revokeLicenseByStripeSession: typeof revokeLicenseByStripeSession };
      logger?: Console;
    },
  ) => Promise<{ status: 'ok' | 'error'; retry?: boolean; body?: Record<string, unknown> }>;
};

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Webhook signature config missing.' }, { status: 500 });
  }

  // Stripe signs the raw bytes; req.text() preserves them exactly.
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error('[stripe/webhook] signature verification failed:', (e as Error).message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const result = await webhookLogic.processCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        {
          db:     { insertLicense },
          mailer: { sendPurchaseEmail },
          logger: console,
        },
      );
      const httpStatus = result.status === 'ok' ? 200 : (result.retry ? 500 : 400);
      return NextResponse.json(result.body || {}, { status: httpStatus });
    }

    case 'charge.refunded': {
      const result = await webhookLogic.processChargeRefunded(
        event.data.object as Stripe.Charge,
        {
          db:     { revokeLicenseByStripeSession },
          logger: console,
        },
      );
      const httpStatus = result.status === 'ok' ? 200 : (result.retry ? 500 : 400);
      return NextResponse.json(result.body || {}, { status: httpStatus });
    }

    default:
      // Acknowledge other events; Stripe expects 2xx within 30s.
      return NextResponse.json({ received: true, ignored: event.type });
  }
}
