// scripts/revoke-key.ts — Revoke a license key.
//
// Use cases:
//   - Manual refund (where the Stripe webhook didn't fire, or it's a
//     manually-issued key with no Stripe session)
//   - Confirmed fraud / chargeback
//   - Buyer asked to be removed
//
// The Electron app's revalidateOnLaunch hits /api/validate every launch
// and returns { ok: false, status: 'revoked' } when status='revoked',
// which triggers the blocking modal in main.js. So a revoke takes effect
// the next time the buyer relaunches.
//
// Run:
//   vercel env pull .env.local
//   npx tsx scripts/revoke-key.ts SELAM-XXXXX-XXXXX-XXXXX

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');

async function main() {
  const [, , keyArg, reasonArg] = process.argv;
  if (!keyArg) {
    console.error('Usage: npx tsx scripts/revoke-key.ts <key> [reason]');
    console.error('Example: npx tsx scripts/revoke-key.ts SELAM-AAAAA-BBBBB-CCCCC "Refund per email 2026-05-04"');
    process.exit(2);
  }

  const key = keyArg.trim().toUpperCase();
  const reason = (reasonArg || '').trim();

  console.log(`Revoking key: ${key}`);
  if (reason) console.log(`Reason:       ${reason}`);
  console.log();

  try {
    const rows = await sql`
      UPDATE licenses
      SET status     = 'revoked',
          revoked_at = NOW(),
          notes      = COALESCE(notes, '') || ${reason ? `\nRevoked: ${reason}` : '\nRevoked manually'}
      WHERE key = ${key}
        AND status = 'active'
      RETURNING key, email, status
    ` as Array<{ key: string; email: string; status: string }>;
    if (rows.length === 0) {
      console.error('✗ No active license matched. Maybe already revoked?');
      const existing = await sql`
        SELECT key, status, to_char(revoked_at, 'YYYY-MM-DD HH24:MI') as revoked_at
        FROM licenses WHERE key = ${key}
      ` as Array<{ key: string; status: string; revoked_at: string | null }>;
      if (existing.length === 0) {
        console.error('  (and no license with that key exists.)');
      } else {
        console.error(`  Current status: ${existing[0].status}, revoked_at: ${existing[0].revoked_at || '—'}`);
      }
      process.exit(1);
    }
    console.log(`✓ Revoked. Buyer email: ${rows[0].email}`);
    console.log();
    console.log('The next time this buyer relaunches Selam, the validation');
    console.log('check will fail and the app will quit with a blocking modal.');
  } catch (e) {
    console.error('✗ Revoke failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
