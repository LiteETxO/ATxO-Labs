// scripts/issue-key.ts — Manually mint a license key for a buyer.
//
// Use cases:
//   - Comp keys for press, advisors, family
//   - Replacing a key for a buyer who can't recover via email
//   - Pre-launch testing without going through Stripe
//
// Run:
//   vercel env pull .env.local        # gets POSTGRES_*
//   npx tsx scripts/issue-key.ts buyer@example.com
//   # or with a custom SKU:
//   npx tsx scripts/issue-key.ts buyer@example.com selam-press-2026

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no O/0/I/1

function mintLicenseKey(): string {
  const bytes = new Uint8Array(15);
  // crypto.getRandomValues is in Node 20+ globalThis.crypto
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]);
  return `SELAM-${chars.slice(0, 5).join('')}-${chars.slice(5, 10).join('')}-${chars.slice(10, 15).join('')}`;
}

async function main() {
  const [, , emailArg, skuArg] = process.argv;
  if (!emailArg) {
    console.error('Usage: npx tsx scripts/issue-key.ts <email> [product-sku]');
    console.error('Example: npx tsx scripts/issue-key.ts press@example.com selam-press-2026');
    process.exit(2);
  }

  const email = emailArg.trim().toLowerCase();
  const sku   = (skuArg || 'selam-v1').trim();

  if (!email.includes('@')) {
    console.error('Invalid email:', email);
    process.exit(2);
  }

  const key = mintLicenseKey();
  // Tag manually-issued keys with a synthetic stripe_session value so
  // the unique-constraint isn't violated and so audit can distinguish
  // them from Stripe-minted keys later. Format: 'manual:<timestamp>:<random>'.
  const stripeSession = `manual:${Date.now()}:${key.slice(-5)}`;

  console.log(`Minting key:`);
  console.log(`  email: ${email}`);
  console.log(`  sku:   ${sku}`);
  console.log(`  key:   ${key}`);
  console.log(`  stripe_session: ${stripeSession}`);
  console.log();

  try {
    const rows = await sql`
      INSERT INTO licenses (key, email, product_sku, stripe_session, status, notes)
      VALUES (${key}, ${email}, ${sku}, ${stripeSession}, 'active', 'Manually issued via scripts/issue-key.ts')
      RETURNING key
    ` as Array<{ key: string }>;
    if (rows.length > 0) {
      console.log('✓ Inserted.');
      console.log();
      console.log('Email this key to the buyer manually, or run:');
      console.log(`  npx tsx scripts/send-recovery.ts ${email}`);
    } else {
      console.error('✗ No row inserted (unexpected).');
      process.exit(1);
    }
  } catch (e) {
    console.error('✗ Insert failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
