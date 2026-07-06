# Selam License Server

Backend for **api.heyselam.app**. Handles license validation, recovery,
and Stripe webhook ingestion.

**Stack pinned (2026-05-03):**
- Next.js 16 (App Router) on Vercel
- Vercel Postgres (license DB)
- Resend (transactional email)
- Vercel KV / Upstash Redis (rate limit; falls back to in-memory in dev)
- Stripe (checkout + webhook)

---

## Layout

```
license-server/
  package.json                 — Next.js project (deploys to api.heyselam.app)
  next.config.ts
  tsconfig.json
  .env.example                 — copy to .env.local for dev
  db/
    schema.sql                 — Postgres schema (run once on first deploy)
  src/
    app/
      page.tsx                 — redirects api.heyselam.app/ → heyselam.app
      layout.tsx
      recover/
        page.tsx               — buyer-facing recovery form
      api/
        recover/route.ts       — POST /api/recover  (license recovery)
        validate/route.ts      — GET  /api/validate?key=...
        stripe/webhook/route.ts — POST /api/stripe/webhook
    lib/
      db.ts                    — Vercel Postgres adapter
      mailer.ts                — Resend adapter
      rate-limit.ts            — KV / memory rate limiter
  recover.js                   — pure handler (CommonJS, stack-agnostic)
  rate-limit.js                — pure rate limiters (CJS)
  email-templates/
    recovery.js                — buildRecoveryEmail() (CJS, used by mailer.ts)
  recover.test.js              — node:test (run with `npm test`)
  STRIPE_INTEGRATION.md        — Stripe Tax + checkout + webhook checklist
```

The `*.js` files at the root are the pure handlers (no Vercel/Resend/Postgres
deps). The `src/` directory is the Next.js wrapper that imports them via
adapters in `src/lib/`. This split lets us unit-test handlers offline and
swap deployment targets later if needed.

---

## Local development

### 1. Install + env

```bash
cd license-server
npm install
cp .env.example .env.local
# Edit .env.local — at minimum set RESEND_API_KEY and POSTGRES_* (or
# use `vercel env pull .env.local` once the Vercel project is linked).
```

### 2. Provision the database

Once the Vercel Postgres database is created via the dashboard:

```bash
vercel env pull .env.local
psql "$POSTGRES_URL_NON_POOLING" -f db/schema.sql
```

### 3. Run the dev server

```bash
npm run dev          # http://localhost:3000
```

- `http://localhost:3000/recover` — recovery form
- `http://localhost:3000/api/recover` — POST endpoint
- `http://localhost:3000/api/validate?key=SELAM-...` — validation endpoint

### 4. Run tests

```bash
npm test
```

35+ tests covering the pure handlers (recover + rate limit + email template).
Adapter code (`src/lib/`) isn't unit tested — it's exercised by the Next.js
integration in dev + staging.

---

## Deployment

### First-time setup

1. **Create a Vercel project** for this directory:
   ```bash
   vercel link
   ```
2. **Provision Postgres**: Vercel dashboard → Storage → Create Database → Postgres
   - Auto-injects `POSTGRES_*` env vars
   - Run `psql ... -f db/schema.sql` once
3. **Provision KV** (recommended): Storage → Create Database → KV
   - Auto-injects `KV_REST_API_URL` + `KV_REST_API_TOKEN`
4. **Add Resend API key**: Project Settings → Environment Variables → `RESEND_API_KEY`
   - Verify `heyselam.app` domain in Resend dashboard with DKIM/SPF
5. **Add Stripe secrets**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
6. **Set custom domain**: Project Settings → Domains → `api.heyselam.app`
7. **Add Stripe webhook**: Stripe Dashboard → Webhooks → Add Endpoint
   - URL: `https://api.heyselam.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `charge.refunded`
   - Copy signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`
8. **Add a redirect from heyselam.app/recover → api.heyselam.app/recover** in
   the marketing site's `next.config.ts` (or just hardcode the `/recover` link
   to point at the api subdomain).

### Push to deploy

```bash
git push                  # auto-deploys preview
vercel --prod             # promote to api.heyselam.app
```

---

## Endpoints

### `POST /api/recover`

Recovery form submission.

**Request:**
```json
{ "email": "buyer@example.com" }
```

**Responses:**
- `202` — *"If we have a license on file…"* (always for valid email shape, whether or not we have keys — enumeration defense)
- `400` — invalid email format
- `429` — rate limited (5/IP/hour or 3/email/hour); `Retry-After` header set
- `500` — DB lookup failed

### `GET /api/validate?key=SELAM-XXXXX-XXXXX-XXXXX`

License key check. Used by Electron client at activation + every launch.

**Responses:**
- `200` — `{ ok: true, productSku, issuedAt }`
- `400` — malformed key
- `403` — revoked
- `404` — not found
- `429` — rate limited (60/IP/min)
- `5xx` — server error (Electron client falls back to its 7-day grace cache)

### `POST /api/stripe/webhook`

Stripe events. Required headers: `stripe-signature`. Body: raw JSON.

**Handled events:**
- `checkout.session.completed` — mint key, insert in DB, send purchase email
- `charge.refunded` — revoke license

Other events return 200 with `{ ignored: true }`.

---

## Security notes

- **Recovery enumeration**: `/api/recover` always returns 202 for valid
  email shape, whether or not we have a record. Probes can't tell the
  difference. Email only sends if there's a key on file.
- **Validation rate limit**: 60/min per IP. Real activation/relaunch
  traffic burns 1 attempt; this caps a brute-force at ~5k tries/hour
  even if the attacker rotates emails — the keyspace (~10^25) makes
  guessing infeasible.
- **Webhook signature**: every webhook event is verified with
  `stripe.webhooks.constructEvent` against `STRIPE_WEBHOOK_SECRET`.
  Unverified payloads return 400.
- **No PII echo**: validate response includes only `productSku` and
  `issuedAt`. Email is never echoed back.
- **Idempotent inserts**: `licenses(stripe_session)` is UNIQUE; the
  `ON CONFLICT` clause makes duplicate webhook deliveries safe.

---

## TODO before launch

- [ ] Create Vercel project + provision Postgres + KV
- [ ] Run `db/schema.sql` against production DB
- [ ] Verify `heyselam.app` domain in Resend (DKIM + SPF)
- [ ] Set custom domain `api.heyselam.app` in Vercel
- [ ] Configure Stripe webhook endpoint pointing at `api.heyselam.app/api/stripe/webhook`
- [ ] End-to-end smoke test: Stripe Checkout (test mode) → webhook → license inserted → purchase email arrives → Electron activates → revalidates next launch
- [ ] Smoke test recovery: submit form → email arrives within 30s
- [ ] Smoke test refund: refund the test charge → license flips to revoked → next Electron relaunch shows the blocking modal
- [ ] See `STRIPE_INTEGRATION.md` for the Stripe Tax / VAT checklist (separate from the wiring)
