// scripts/send-recovery.ts — Manually send a recovery email to a buyer.
//
// Use cases:
//   - Buyer hits a Resend bounce (typo in their original email) and you
//     reissued under a new address — send them the new key
//   - Webhook fired but the purchase email got lost; fill the gap
//   - Internal QA — confirm the recovery template renders correctly
//
// Differs from /api/recover in that:
//   - No rate limit (it's you running it locally)
//   - No enumeration defense (you know the email exists)
//   - Logs which keys were sent for the record
//
// Run:
//   vercel env pull .env.local
//   npx tsx scripts/send-recovery.ts buyer@example.com

import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildRecoveryEmail } = require('../email-templates/recovery.js') as {
  buildRecoveryEmail: (input: {
    to: string;
    keys: Array<{ key: string }>;
    sentAt?: Date;
    from?: string;
  }) => { from: string; to: string; subject: string; html: string; text: string };
};

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');
const RESEND_FROM = process.env.RESEND_FROM || 'Selam <support@heyselam.app>';

async function main() {
  const [, , emailArg] = process.argv;
  if (!emailArg) {
    console.error('Usage: npx tsx scripts/send-recovery.ts <email>');
    process.exit(2);
  }

  const email = emailArg.trim().toLowerCase();
  if (!email.includes('@')) {
    console.error('Invalid email:', email);
    process.exit(2);
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set. Add it to .env.local before running.');
    process.exit(2);
  }

  console.log(`Looking up active licenses for ${email}...`);
  const rows = await sql`
    SELECT key
    FROM licenses
    WHERE LOWER(email) = ${email}
      AND status = 'active'
    ORDER BY issued_at DESC
  ` as Array<{ key: string }>;

  if (rows.length === 0) {
    console.error(`✗ No active licenses found for ${email}.`);
    console.error('  (To check revoked keys: SELECT * FROM licenses WHERE LOWER(email) = ...)');
    process.exit(1);
  }

  console.log(`Found ${rows.length} active license${rows.length === 1 ? '' : 's'}:`);
  rows.forEach(r => console.log(`  - ${r.key}`));
  console.log();
  console.log(`Sending recovery email to ${email}...`);

  const msg = buildRecoveryEmail({ to: email, keys: rows, from: RESEND_FROM });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const r = await resend.emails.send({
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  if (r.error) {
    console.error('✗ Resend error:', r.error);
    process.exit(1);
  }

  console.log(`✓ Sent.  resend id: ${r.data?.id}`);
}

main().catch(e => {
  console.error('Crashed:', e);
  process.exit(1);
});
