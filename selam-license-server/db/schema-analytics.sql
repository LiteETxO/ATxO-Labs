-- First-party landing analytics.
-- Collected by /api/track, read by /api/analytics + the /analytics dashboard.
-- NOTE: /api/track self-provisions this (CREATE TABLE IF NOT EXISTS) on first write;
-- this file is the canonical reference and for manual application if preferred.
-- Privacy: no raw IP/PII. `visitor` is a daily salted hash for cookieless uniques.

CREATE TABLE IF NOT EXISTS landing_events (
  id           BIGSERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event        TEXT NOT NULL,          -- landing_view | cta_* | scroll_*
  path         TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  gclid        TEXT,
  ref          TEXT,                   -- referrer hostname
  country      TEXT,                   -- from edge geo header
  device       TEXT,                   -- mobile | desktop | tablet
  visitor      TEXT                    -- sha256(ip|ua|day|salt)[:16]
);
CREATE INDEX IF NOT EXISTS landing_events_ts       ON landing_events (ts);
CREATE INDEX IF NOT EXISTS landing_events_event    ON landing_events (event);
CREATE INDEX IF NOT EXISTS landing_events_campaign ON landing_events (utm_campaign);
