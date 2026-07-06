#!/usr/bin/env bash
# scripts/test-webhook-e2e.sh — End-to-end webhook verification.
#
# Boots the local Next.js dev server, starts `stripe listen` to forward
# events to it, triggers fake events, and reports whether our handler
# processed them correctly.
#
# Prerequisites:
#   1. Stripe CLI installed: ~/.local/bin/stripe (already done)
#   2. Stripe CLI authenticated:
#        stripe login         # OAuth pairing — opens browser
#        # OR
#        Provide a key with `rak_stripecli_session_write` permission
#   3. Postgres provisioned (otherwise webhook will fail at insertLicense)
#   4. .env.local fully populated
#
# Run:
#   bash scripts/test-webhook-e2e.sh

set -euo pipefail

cd "$(dirname "$0")/.."   # repo root
STRIPE="${STRIPE_BIN:-$HOME/.local/bin/stripe}"

if [ ! -x "$STRIPE" ]; then
  echo "✗ Stripe CLI not found at $STRIPE"
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "✗ .env.local missing — run vercel env pull first"
  exit 1
fi

# 1. Start listen, capture forwarded-event signing secret
echo "═══ Starting stripe listen ═══"
"$STRIPE" listen --forward-to localhost:3000/api/stripe/webhook > /tmp/stripe-listen.log 2>&1 &
LISTEN_PID=$!
trap 'kill $LISTEN_PID 2>/dev/null || true' EXIT

# Wait for "Ready! Your webhook signing secret is whsec_..." line
for i in $(seq 1 30); do
  SEC="$(grep -oE 'whsec_[A-Za-z0-9]+' /tmp/stripe-listen.log | head -1)"
  [ -n "$SEC" ] && break
  sleep 1
done
if [ -z "${SEC:-}" ]; then
  echo "✗ Did not capture listen secret in 30s. Log:"
  cat /tmp/stripe-listen.log
  exit 1
fi
echo "  ✓ Got CLI-forwarded signing secret: ${SEC:0:13}***${SEC: -4}"

# 2. Override STRIPE_WEBHOOK_SECRET in .env.local for this run
cp .env.local .env.local.before-e2e
sed -i.bak "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=$SEC|" .env.local
rm .env.local.bak

# 3. Boot dev server
echo ""
echo "═══ Starting Next.js dev server ═══"
npm run dev > /tmp/license-server-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $LISTEN_PID 2>/dev/null || true; kill $DEV_PID 2>/dev/null || true; mv .env.local.before-e2e .env.local 2>/dev/null || true' EXIT

for i in $(seq 1 60); do
  if curl -s -f http://localhost:3000/api/status > /dev/null 2>&1; then
    echo "  ✓ ready after ${i}s"
    break
  fi
  sleep 1
done

# 4. Trigger fake events
echo ""
echo "═══ Triggering checkout.session.completed ═══"
"$STRIPE" trigger checkout.session.completed 2>&1 | tail -8

sleep 3

echo ""
echo "═══ Triggering charge.refunded ═══"
"$STRIPE" trigger charge.refunded 2>&1 | tail -8

sleep 3

# 5. Inspect logs
echo ""
echo "═══ Stripe listen log (events forwarded) ═══"
grep -E "POST.*webhook|checkout|charge" /tmp/stripe-listen.log | tail -10

echo ""
echo "═══ Next.js dev server log (webhook hits) ═══"
grep -E "POST /api/stripe|webhook|signature|checkout|charge" /tmp/license-server-dev.log | tail -20

echo ""
echo "Done. Cleaning up..."
# (trap handles kill + restore)
