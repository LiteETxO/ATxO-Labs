// scripts/list-recent.ts — List recent licenses for support / sanity checks.
//
// Run:
//   vercel env pull .env.local
//   npx tsx scripts/list-recent.ts            # last 20
//   npx tsx scripts/list-recent.ts 100        # last 100
//   npx tsx scripts/list-recent.ts 50 revoked # last 50 revoked

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');

type Row = {
  key: string;
  email: string;
  status: string;
  sku: string;
  issued: string;
  revoked: string | null;
};

async function main() {
  const limit  = parseInt(process.argv[2] || '20', 10);
  const status = process.argv[3]; // 'active' | 'revoked' | undefined

  if (status && !['active', 'revoked'].includes(status)) {
    console.error('Status must be "active" or "revoked" if provided.');
    process.exit(2);
  }

  // Neon's tagged template doesn't support dynamic LIMIT/WHERE neatly;
  // we branch instead.
  const rows = (status
    ? await sql`
        SELECT key, email, status, product_sku as sku,
               to_char(issued_at,  'YYYY-MM-DD HH24:MI') as issued,
               to_char(revoked_at, 'YYYY-MM-DD HH24:MI') as revoked
        FROM licenses
        WHERE status = ${status}
        ORDER BY issued_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT key, email, status, product_sku as sku,
               to_char(issued_at,  'YYYY-MM-DD HH24:MI') as issued,
               to_char(revoked_at, 'YYYY-MM-DD HH24:MI') as revoked
        FROM licenses
        ORDER BY issued_at DESC
        LIMIT ${limit}
      `) as Row[];

  if (rows.length === 0) {
    console.log('(no licenses match)');
    return;
  }

  console.log(['key', 'email', 'status', 'sku', 'issued', 'revoked'].map(c => pad(c, 28)).join(''));
  console.log('—'.repeat(28 * 6));
  for (const r of rows) {
    console.log([
      pad(r.key, 28),
      pad(r.email, 28),
      pad(r.status, 28),
      pad(r.sku, 28),
      pad(r.issued, 28),
      pad(r.revoked || '—', 28),
    ].join(''));
  }
  console.log();
  console.log(`${rows.length} row${rows.length === 1 ? '' : 's'}`);
}

function pad(s: string, n: number): string {
  if (s.length >= n - 1) return s.slice(0, n - 2) + '… ';
  return s + ' '.repeat(n - s.length);
}

main();
