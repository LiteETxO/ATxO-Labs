// scripts/set-tax-origin.ts — Set the Stripe Tax head office address.
//
// Stripe Tax requires a head office (your business's primary location)
// before it can compute tax. This script writes that via the Tax Settings
// API. ONE-TIME setup; idempotent.
//
// Run:
//   npx tsx scripts/set-tax-origin.ts \
//     --line1 "123 Main St" \
//     --line2 "Suite 400" \    # optional
//     --city  "Wilmington" \
//     --state "DE" \           # 2-letter for US states
//     --postal "19801" \
//     --country "US"           # ISO 3166-1 alpha-2
//
// Reads STRIPE_SECRET_KEY from env. Use the live key (sk_live_... or
// rk_live_...) — Stripe Tax settings are per-account-mode, so dev/live
// configs are separate.

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Tiny CLI parser — no deps.
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[a.slice(2)] = next;
        i++;
      } else {
        out[a.slice(2)] = 'true';
      }
    }
  }
  return out;
}

function loadEnvLocal(): Record<string, string> {
  // Load .env.local if not already in env (so this script works without
  // dotenv as a dep when run via `tsx`).
  try {
    const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    const out: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = loadEnvLocal();

  const required = ['line1', 'city', 'postal', 'country'];
  const missing = required.filter(k => !args[k]);
  if (missing.length) {
    console.error('Missing required args:', missing.join(', '));
    console.error('');
    console.error('Usage: npx tsx scripts/set-tax-origin.ts \\');
    console.error('  --line1 "123 Main St" \\');
    console.error('  --city "Wilmington" \\');
    console.error('  --state "DE" \\           # optional, 2-letter for US states');
    console.error('  --postal "19801" \\');
    console.error('  --country "US"');
    process.exit(2);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || envFile.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not found in env or .env.local');
    process.exit(2);
  }

  console.log('Setting Stripe Tax head office:');
  console.log(`  line1:   ${args.line1}`);
  if (args.line2)  console.log(`  line2:   ${args.line2}`);
  console.log(`  city:    ${args.city}`);
  if (args.state)  console.log(`  state:   ${args.state}`);
  console.log(`  postal:  ${args.postal}`);
  console.log(`  country: ${args.country}`);
  console.log('');

  // POST /v1/tax/settings with nested head_office[address][...] params
  const params = new URLSearchParams();
  params.set('head_office[address][line1]',       args.line1);
  if (args.line2)  params.set('head_office[address][line2]',  args.line2);
  params.set('head_office[address][city]',        args.city);
  if (args.state)  params.set('head_office[address][state]',  args.state);
  params.set('head_office[address][postal_code]', args.postal);
  params.set('head_office[address][country]',     args.country);

  const resp = await fetch('https://api.stripe.com/v1/tax/settings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const result = await resp.json();
  if (!resp.ok || result.error) {
    console.error('✗ Stripe API error:', result.error || result);
    process.exit(1);
  }

  console.log('✓ Updated Stripe Tax settings:');
  console.log(`  status:        ${result.status}`);
  console.log(`  head_office:   ${JSON.stringify(result.head_office, null, 2)}`);
  if (result.status === 'pending') {
    console.log('');
    console.log('  status is still pending — likely missing tax registrations.');
    console.log('  Register at: https://dashboard.stripe.com/tax/registrations');
    console.log('  Recommended minimum: EU OSS + UK VAT.');
  }
}

main().catch(e => {
  console.error('Crashed:', e);
  process.exit(1);
});
