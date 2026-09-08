// POST /api/checkout/session — Creates a Stripe Checkout Session.
//
// Called by the /buy page or checkout-flow selectors. Returns the Stripe-hosted
// checkout URL so the browser can redirect there. Stripe handles the rest: card
// collection, tax calculation (via Stripe Tax), invoice generation, and the webhook
// to /api/stripe/webhook on success.
//
// Supports three checkout flows:
//   1. Trial: $10, 30-day trial (full access)
//   2. Ownership: $89, one-time perpetual license purchase
//   3. Update pass: $99/year, recurring subscription for annual updates
//
// Tax: automatic_tax: { enabled: true } means Stripe collects buyer
// location and applies VAT/GST/sales tax based on registered jurisdictions.
// Once Stripe Tax is configured (see STRIPE_INTEGRATION.md), this just
// works — no extra code change.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { countActiveLicenses, FOUNDER_CAP, type LicenseTier, type PurchaseType } from '@/lib/db';

const PRODUCT_NAME = 'Selam';
const SUCCESS_PATH = '/welcome';
const CANCEL_PATH  = '/buy?cancelled=1';

// Price ID mapping by purchase type
type CheckoutFlow = 'trial' | 'ownership' | 'update-pass';

function resolvePriceId(flow: CheckoutFlow): string {
  switch (flow) {
    case 'trial':
      return process.env.STRIPE_PRICE_ID_TRIAL || '';
    case 'ownership':
      return process.env.STRIPE_PRICE_ID_OWNERSHIP || '';
    case 'update-pass':
      return process.env.STRIPE_PRICE_ID_UPDATE_PASS || '';
    default:
      return '';
  }
}

// Founder-cap pricing (legacy): STRIPE_PRICE_ID is the founder price ($99);
// STRIPE_PRICE_ID_STANDARD is the post-cap price ($149 launch tier, one year of
// updates). The tier is stamped on the session's metadata so the
// webhook mints exactly what the buyer was shown.
async function resolveTier(): Promise<LicenseTier> {
  try {
    const active = await countActiveLicenses();
    return active < FOUNDER_CAP ? 'founder' : 'standard';
  } catch (e) {
    // DB unreachable: default to founder — undercharging on an infra
    // blip is acceptable, silently charging the standard price during the founder
    // window (or blocking every sale) is not.
    console.error('[checkout/session] countActiveLicenses failed, defaulting to founder:', e);
    return 'founder';
  }
}

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

function originFromRequest(req: NextRequest): string {
  // In prod, NEXT_PUBLIC_BASE_URL is api.heyselam.app. In dev, fall back
  // to the request's origin so localhost works without env vars.
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host  = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'api.heyselam.app';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  // Optional payload — buyer can pre-fill email, specify flow type, and pass
  // attribution data from the marketing site (campaign, referrer, etc).
  let payload: {
    email?: string;
    ref?: string;
    campaign?: string;
    flow?: CheckoutFlow; // 'trial', 'ownership', or 'update-pass'
  } = {};
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      payload = await req.json();
    }
  } catch {
    // Non-JSON body — ignore, proceed without prefill.
  }

  // Determine checkout flow: explicit flow param, or fall back to founder/standard tier
  let flow: CheckoutFlow = 'trial'; // Default to trial
  let tier: LicenseTier = 'founder';
  let purchaseType: PurchaseType = 'trial';
  let stripeMode: 'payment' | 'subscription' = 'payment';

  if (payload.flow === 'update-pass') {
    flow = 'update-pass';
    purchaseType = 'update_pass';
    stripeMode = 'subscription';
  } else if (payload.flow === 'ownership') {
    flow = 'ownership';
    purchaseType = 'perpetual';
    stripeMode = 'payment';
  } else if (payload.flow === 'trial') {
    flow = 'trial';
    purchaseType = 'trial';
    stripeMode = 'payment';
  } else if (!payload.flow) {
    // Auto-detect based on legacy founder cap (for backward compatibility)
    try {
      const tierResult = await resolveTier();
      tier = tierResult;
      flow = 'trial'; // Default new users to trial
    } catch (e) {
      console.error('[checkout/session] resolveTier failed, defaulting to trial:', e);
      flow = 'trial';
    }
  }

  const priceId = resolvePriceId(flow);
  if (!priceId) {
    const missing = `STRIPE_PRICE_ID_${flow.toUpperCase().replace('-', '_')}`;
    console.error(`[checkout/session] ${missing} missing (flow=${flow})`);
    return NextResponse.json(
      { error: `Checkout not yet configured. ${missing} missing.` },
      { status: 503 },
    );
  }

  const origin = originFromRequest(req);

  // Build client_reference_id from attribution params if provided. Stripe
  // returns this back in the webhook so we can credit the right campaign.
  // Format: 'ref:<source>:campaign:<name>:flow:<flow>' — all optional, max 200 chars.
  const refParts: string[] = [];
  if (payload.ref)      refParts.push(`ref:${payload.ref}`);
  if (payload.campaign) refParts.push(`campaign:${payload.campaign}`);
  refParts.push(`flow:${flow}`);
  const clientReferenceId = refParts.join('|').slice(0, 200);

  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: stripeMode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],

      // Stripe Tax — automatic VAT/GST/sales-tax calculation based on
      // buyer's billing address. Requires Stripe Tax enabled in the
      // dashboard + tax registrations configured for the jurisdictions
      // we ship to. See STRIPE_INTEGRATION.md.
      automatic_tax: { enabled: true },

      // EU/UK B2B reverse-charge support — if the buyer enters a valid
      // VAT number, Stripe drops VAT and marks the invoice "Reverse charge".
      tax_id_collection: { enabled: true },

      // Capture buyer location for tax accuracy.
      billing_address_collection: 'required',

      // Allow buyers to enter a promotional code (created in Stripe
      // Dashboard → Coupons + Promotion codes). Useful for launch
      // discounts, beta-tester comps, win-back flows.
      allow_promotion_codes: true,

      // Always create a Customer object — links subscription history,
      // refund flows, and the Stripe Tax compliance trail to one record.
      customer_creation: 'always',
      customer_email: payload.email,

      // Attribution — passed back in the webhook event for analytics.
      client_reference_id: clientReferenceId,

      // Generate a hosted invoice for compliance.
      invoice_creation: { enabled: true },

      // Set product metadata — the webhook reads this to know which SKU
      // to mint and which flow was used.
      metadata: {
        product: 'selam-v1',
        flow,
        purchase_type: purchaseType,
        tier,
        ...(payload.ref ? { ref: payload.ref } : {}),
        ...(payload.campaign ? { campaign: payload.campaign } : {}),
      },

      success_url: `${origin}${SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}${CANCEL_PATH}`,
    };

    // For update-pass subscriptions, add subscription data
    if (stripeMode === 'subscription') {
      sessionParams.subscription_data = {
        metadata: {
          product: 'selam-v1',
          flow: 'update-pass',
          purchase_type: 'update_pass',
        },
      };
    }

    const session = await getStripe().checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL.' },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { url: session.url, sessionId: session.id, tier, flow, purchaseType },
      { status: 200 },
    );
  } catch (e) {
    console.error('[checkout/session] Stripe error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: `Could not create checkout session: ${message}` },
      { status: 500 },
    );
  }
}
