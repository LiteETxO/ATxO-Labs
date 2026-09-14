# Ask Selam — serverless API

Two zero-config Vercel functions that power the live "Ask Selam" Q&A on the
landing page, plus a shared service module. No build step, no npm deps.

| File | Route | Does |
|------|-------|------|
| `ask.js` | `POST /api/ask` | Streams a Selam-voice answer (gpt-4o-mini) as plain text. Body: `{question, history?}`. |
| `tts.js` | `POST /api/tts` | Speaks a line (gpt-4o-mini-tts, voice `nova`) → `audio/mpeg`. Body: `{text}`. |
| `_svc.js` | — (imported) | Durable rate-limiting + monthly budget guard via Upstash REST. |

The frontend (`selam-tour.js` → the "Ask Selam" pill) posts a question to
`/api/ask`, streams the text into the caption, then posts the final answer to
`/api/tts` and lip-syncs it through the avatar.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `OPENAI_API_KEY` | **yes** | — | Server-side only. Powers both chat + TTS. Never sent to the browser. |
| `UPSTASH_REDIS_REST_URL` | for durability | — | Upstash Redis REST endpoint. (`KV_REST_API_URL` also accepted.) |
| `UPSTASH_REDIS_REST_TOKEN` | for durability | — | Upstash REST token. (`KV_REST_API_TOKEN` also accepted.) |
| `OPENAI_MONTHLY_BUDGET` | no | `25` | USD cap/month. Over it, `/api/ask` serves a friendly line (no OpenAI call) and `/api/tts` returns 402. |
| `OPENAI_BUDGET_WARN` | no | `0.8` | Fraction of the cap that fires the one-time monthly alert. |
| `ALERT_WEBHOOK_URL` | no | — | Slack/Discord/webhook posted (`{text, content}`) when spend crosses the warn threshold. If unset, the alert only logs server-side. |

**Without Upstash configured** everything still works: rate-limiting falls back
to a per-instance in-memory limiter (resets on cold starts) and the budget cap
is inactive. Set the two Upstash vars to make both durable.

## Knobs

- **Rate limits** (per IP, sliding window): `ask` = 12 / 10 min, `tts` = 20 / 10 min.
  Change the numbers in the `rateLimited(...)` calls in `ask.js` / `tts.js`.
- **Her knowledge / persona / answer style**: edit `SYSTEM` in `ask.js`.
- **Answer length**: `max_tokens` in `ask.js` (currently 260).
- **Voice**: `voice` in `tts.js` (currently `nova`).

## Redis keys

- `rl:ask:<ip>` / `rl:tts:<ip>` — sliding-window counters (TTL = window).
- `budget:YYYY-MM` — running USD spend for the month (TTL ~40 days).
- `budget:YYYY-MM:warned` — one-shot flag so the alert fires once per month.

## Also set (authoritative billing guardrail)

In **platform.openai.com → Settings → Limits**, set a monthly budget + email
alert. The code cap here is a fast, graceful backstop; OpenAI's own limit is the
hard account-level stop and emails you regardless of this code.
