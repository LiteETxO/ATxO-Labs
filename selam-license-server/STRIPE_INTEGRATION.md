# Stripe integration — Selam v1.0

## Overview

Two Stripe surfaces, both blocking on the live Stripe account being set up:

1. **Checkout** — buyer goes from heyselam.app → Stripe Checkout → success page
2. **Webhook** — Stripe pings us on `checkout.session.completed` → we mint a `SELAM-XXXXX-XXXXX-XXXXX` license key, store it in the licenses table, and trigger the purchase email (LAUNCH item #5)

## Stack note

This document is stack-agnostic. Once we pin the runtime (LAUNCH "Open question — backend stack"), the webhook adapter is one file (~30 lines) wrapping `stripeWebhookHandler(rawBody, sigHeader, ctx)` from a future `stripe-webhook.js`.

---

## TODO before launch (Stripe Tax / VAT)

Digital goods sold to EU/UK trigger VAT from the **first sale** — not at a threshold. Same applies to several other jurisdictions (Australia GST, Norway VAT, Switzerland VAT, etc). Stripe Tax handles registration, calculation, and invoice generation if configured correctly.

### 1. Enable Stripe Tax in the dashboard

- [ ] Go to https://dashboard.stripe.com/tax
- [ ] Click **Enable Stripe Tax**
- [ ] Set product tax category to **Digital services / SaaS** (or "Pre-recorded digital content" if Stripe asks; both are valid for downloadable software with one-time license)
- [ ] Confirm origin address (ATXO Labs business address — used to determine cross-border tax)

### 2. Configure tax registrations

Stripe Tax only collects tax in jurisdictions where you've explicitly registered.

- [ ] Decide registration strategy: register everywhere preemptively (safer, more paperwork) vs register-on-threshold (cheaper to start, riskier)
- [ ] **EU**: register in **one** EU country via the Mini-One-Stop-Shop (MOSS / OSS). Filing is centralized; one VAT number covers all 27 member states.
- [ ] **UK**: separate VAT registration (not part of EU OSS post-Brexit). Threshold is £0 for digital services to UK consumers.
- [ ] **US**: nexus rules vary by state. For a launch volume <$100k/year, most states don't require collection. Stripe Tax tracks economic nexus thresholds per state and notifies when you cross.
- [ ] **Other**: Australia (GST, AUD 75k threshold), Canada (varies), Norway, Switzerland — Stripe surfaces a list of recommendations.

For launch: minimum recommendation is **EU OSS** + **UK VAT** since a meaningful share of buyers will be there. Add registrations elsewhere as nexus thresholds approach.

### 3. Verify checkout collects buyer location

Stripe Tax needs the buyer's tax location to calculate correctly. For a one-time digital product:

- [ ] In Checkout Session creation, pass `customer_creation: 'always'` so Stripe captures the email + billing address
- [ ] Set `automatic_tax: { enabled: true }` on the session
- [ ] Set `tax_id_collection: { enabled: true }` so EU business buyers can self-identify their VAT number (B2B reverse-charge handled automatically)
- [ ] Confirm the success page tells the buyer the tax was collected and they'll receive an invoice

Sample Checkout Session params (the actual call lives in `checkout.js` once stack is picked):

```js
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [{ price: 'price_XXXXX', quantity: 1 }],
  customer_creation: 'always',
  customer_email: prefillEmail || undefined,  // optional, from referral link
  automatic_tax: { enabled: true },
  tax_id_collection: { enabled: true },
  invoice_creation: { enabled: true },
  success_url: 'https://heyselam.app/welcome?session_id={CHECKOUT_SESSION_ID}',
  cancel_url:  'https://heyselam.app/',
  metadata: { product: 'selam-v1' },
});
```

### 4. Confirm invoices are tax-compliant

- [ ] After a test purchase from an EU billing address, verify the auto-generated invoice in https://dashboard.stripe.com/invoices includes:
  - Seller VAT number
  - Buyer name + billing address
  - Buyer VAT (if B2B)
  - Tax breakdown line (e.g. "VAT 21% — €X.XX")
  - Total inclusive of tax
- [ ] Set Invoice Settings → **Footer** to include legal entity (ATXO Labs Inc., address)
- [ ] Set **Receipt template** so success-email receipt mirrors the invoice
- [ ] Verify EU B2B reverse-charge: a French company entering their VAT number should see VAT removed and invoice marked "Reverse charge — VAT to be paid by the recipient"

### 5. Smoke tests before going live

- [ ] Buy from a US billing address → no VAT collected, invoice clean
- [ ] Buy from a German billing address (consumer, no VAT ID) → 19% VAT collected, invoice shows breakdown
- [ ] Buy from a French B2B (with valid VAT ID) → reverse-charge applied, no VAT collected, invoice notes reverse-charge
- [ ] Buy from a UK billing address → 20% VAT collected
- [ ] Confirm Stripe Tax dashboard shows the tax accruals correctly

### 6. Filing schedule

Stripe Tax doesn't file for you automatically (unless you enable Stripe Tax Filings, which is a separate product currently in beta).

- [ ] Decide: file ourselves quarterly (free, more work) vs use Stripe Tax Filings (paid, hands-off)
- [ ] If filing ourselves: set calendar reminders for EU OSS quarterly returns (deadline 20 days after quarter end), UK VAT (varies by registration), US states as applicable

---

## TODO before launch (Checkout + webhook plumbing)

### 1. Stripe account setup

- [ ] Create live Stripe account under ATXO Labs
- [ ] Verify business identity (KYC docs)
- [ ] Activate live mode (test mode works without this; live needs verification)

### 2. Product + price

- [ ] Create Product "Selam v1.0" in Stripe Dashboard (Products → +Add)
- [ ] Add a one-time Price ($199 USD or whichever currency is canonical)
- [ ] Optional: secondary currency prices for EUR / GBP if we want native pricing in those regions
- [ ] Note the `price_XXXXX` ID — referenced in checkout session creation

### 3. Webhook endpoint

- [ ] Create webhook endpoint in Stripe Dashboard pointed at `https://api.heyselam.app/stripe/webhook` (or wherever the backend lives)
- [ ] Subscribe to events: `checkout.session.completed`, `invoice.payment_succeeded`, `charge.refunded`
- [ ] Copy the signing secret (`whsec_...`) into the backend env

### 4. Backend handler (scaffolding pending stack decision)

When we know the stack, scaffold `license-server/stripe-webhook.js` with:

- Signature verification using `stripe.webhooks.constructEvent(rawBody, sigHeader, secret)`
- Idempotency: store `stripe_session` in licenses table; if already present, no-op
- Mint `SELAM-XXXXX-XXXXX-XXXXX` (15 random A-Z0-9 chars in three groups)
- Insert into licenses table with `email = session.customer_details.email` and `status = 'active'`
- Trigger purchase email via the same mailer adapter as `recover.js`
- Return 200 OK quickly (Stripe retries on non-2xx)

### 5. Refund handling

- [ ] On `charge.refunded`: flip license `status` to `revoked`, write `revoked_at = now()`
- [ ] Email the buyer that their refund was processed and key revoked
- [ ] Verify revalidation in the Electron app gracefully handles a revoked key (it does — `revalidateOnLaunch` returns `{ ok: false, status: 'revoked' }` → blocking modal → quit)

---

## Test mode usage during development

Until live mode is activated, all checkout/webhook flows can be exercised in test mode using `sk_test_...` keys. Stripe provides test cards:

- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0002` — declined
- `4000 0027 6000 3184` — 3D Secure required

Use test mode aggressively during development. Switch to live mode only after end-to-end smoke tests pass.

---

## Open questions

- [ ] Final price point (memory says $199; confirm at launch)
- [ ] Currency strategy — single USD or per-region native?
- [ ] Refund window — 14 days (EU mandatory)? 30 days (more generous)?
- [ ] Subscription tier later — v1.0 is one-time, but space for v1.x recurring?
