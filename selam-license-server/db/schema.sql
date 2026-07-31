-- Selam license server — schema for Vercel Postgres.
--
-- Apply via:
--   vercel env pull .env.local                     # gets POSTGRES_* vars
--   psql "$POSTGRES_URL_NON_POOLING" -f db/schema.sql
--
-- Or via the Vercel Postgres dashboard SQL console.

-- Licenses: every issued key, active or revoked.
CREATE TABLE IF NOT EXISTS licenses (
  key             TEXT        PRIMARY KEY,
  email           TEXT        NOT NULL,
  product_sku     TEXT        NOT NULL DEFAULT 'selam-v1',
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'revoked')),
  -- tier: 'founder' = first-100 cohort ($199, lifetime updates, Plus yr-1
  -- free). 'standard' = post-cap ($299, one year of updates, keep-forever).
  -- DEFAULT 'founder': every license issued before the cap existed was
  -- sold under the original "$199 lifetime" promise, so it grandfathers in.
  tier            TEXT        NOT NULL DEFAULT 'founder'
                              CHECK (tier IN ('founder', 'standard')),
  stripe_session  TEXT        UNIQUE,         -- ON CONFLICT target for idempotent inserts
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  notes           TEXT
);

-- (v3) Migration for deployments created before the tier column — safe
-- to re-run (constraint add is wrapped so duplicates are no-ops).
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'founder';
DO $$ BEGIN
  ALTER TABLE licenses ADD CONSTRAINT licenses_tier_check CHECK (tier IN ('founder', 'standard'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recovery looks up by lowercased email.
CREATE INDEX IF NOT EXISTS licenses_email_idx ON licenses (LOWER(email));
CREATE INDEX IF NOT EXISTS licenses_status_idx ON licenses (status);


-- (v2) Audit log: every state change (mint, revoke, restore). Keeps a
-- forensic trail when buyers or fraud investigators ask "when was this
-- key issued / revoked / restored?". Writes are append-only.
CREATE TABLE IF NOT EXISTS license_events (
  id              BIGSERIAL   PRIMARY KEY,
  key             TEXT        NOT NULL REFERENCES licenses(key) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL
                              CHECK (event_type IN ('issued', 'revoked', 'restored', 'recovered')),
  actor           TEXT,                            -- 'stripe-webhook', 'admin:<id>', 'recover-flow'
  metadata        JSONB,                           -- { stripe_session, charge_id, etc }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS license_events_key_idx ON license_events (key);
CREATE INDEX IF NOT EXISTS license_events_created_idx ON license_events (created_at DESC);


-- (v2) Recovery requests: rate-limit + abuse signal. A single hot
-- email/IP shows up here repeatedly, useful for support diagnostics.
-- Distinct from the rate limiter (which holds rolling counts only).
CREATE TABLE IF NOT EXISTS recovery_requests (
  id              BIGSERIAL   PRIMARY KEY,
  email           TEXT        NOT NULL,
  ip              TEXT,
  result          TEXT        NOT NULL          -- 'sent' | 'silent_no_match' | 'rate_limited'
                              CHECK (result IN ('sent', 'silent_no_match', 'rate_limited')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recovery_requests_email_idx ON recovery_requests (email);
CREATE INDEX IF NOT EXISTS recovery_requests_created_idx ON recovery_requests (created_at DESC);

-- Marketing email captures ("watch the launch" field on heyselam.app).
-- Email is the PK — repeat submits are idempotent no-ops.
CREATE TABLE IF NOT EXISTS subscribers (
  email      TEXT PRIMARY KEY,
  source     TEXT,
  note       TEXT,          -- optional "what would you use Selam for?"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
