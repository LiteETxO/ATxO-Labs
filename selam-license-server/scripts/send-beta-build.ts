// scripts/send-beta-build.ts — Mint comp keys for beta testers + email them.
//
// Use case: a new signed beta DMG is on R2, and you want to hand it to
// the 3-5 testers from LAUNCH item S3. This script:
//   1. Reads a list of testers (email + optional name) from a TSV/JSON
//   2. Mints one comp key per tester (sku: selam-beta) — idempotent on
//      repeated runs by skipping anyone who already has an active beta key
//   3. Sends each tester the beta-invite email with their key + the
//      signed DMG download link
//
// Run:
//   vercel env pull .env.local
//   npx tsx scripts/send-beta-build.ts --version 1.0.0-beta.3 --dmg https://updates.heyselam.app/mac/Selam-1.0.0-beta.3-arm64.dmg --testers testers.tsv
//
// testers.tsv format (tab-separated, comments allowed):
//   # email                          name (optional)
//   sarah@example.com                Sarah
//   evan@example.com                 Evan
//   anonymous-tester@example.com
//
// Or JSON: [{"email": "...", "name": "..."}, ...]
//
// Dry-run (mint nothing, send nothing, just print what would happen):
//   ... --dry-run
//
// Resend a previously-issued key without minting a new one (e.g. tester
// re-installed and lost the email):
//   ... --resend-only

import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { Resend } from 'resend';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildBetaInviteEmail } = require('../email-templates/beta-invite.js') as {
  buildBetaInviteEmail: (input: {
    to: string;
    key: string;
    buildVersion: string;
    downloadUrl: string;
    testerName?: string | null;
    feedbackUrl?: string | null;
    sentAt?: Date;
    from?: string;
  }) => { from: string; to: string; subject: string; html: string; text: string };
};

const RESEND_FROM = process.env.RESEND_FROM || 'Selam <support@heyselam.app>';
const BETA_SKU = 'selam-beta';

// Lazy DB init — `neon()` throws at module load if no URL is set, which
// would break `--dry-run` runs done before infra is provisioned. Real
// runs require POSTGRES_URL; dry-runs without it are allowed and treat
// every tester as "no existing key" so the email-render path can still
// be exercised end-to-end.
let _sql: ReturnType<typeof neon> | null = null;
function getSql() {
  if (_sql) return _sql;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL not set — required for non-dry-run mode.');
  _sql = neon(url);
  return _sql;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function mintKey(): string {
  const bytes = new Uint8Array(15);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]);
  return `SELAM-${chars.slice(0, 5).join('')}-${chars.slice(5, 10).join('')}-${chars.slice(10, 15).join('')}`;
}

type Tester = { email: string; name: string | null };

function parseArgs(argv: string[]): {
  version: string | null;
  dmg: string | null;
  testersPath: string | null;
  feedbackUrl: string | null;
  dryRun: boolean;
  resendOnly: boolean;
} {
  const out = {
    version: null as string | null,
    dmg: null as string | null,
    testersPath: null as string | null,
    feedbackUrl: null as string | null,
    dryRun: false,
    resendOnly: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version')      out.version     = argv[++i];
    else if (a === '--dmg')     out.dmg         = argv[++i];
    else if (a === '--testers') out.testersPath = argv[++i];
    else if (a === '--feedback')out.feedbackUrl = argv[++i];
    else if (a === '--dry-run') out.dryRun      = true;
    else if (a === '--resend-only') out.resendOnly = true;
  }
  return out;
}

function readTesters(path: string): Tester[] {
  const raw = fs.readFileSync(path, 'utf8');

  if (path.endsWith('.json')) {
    const data = JSON.parse(raw) as Array<{ email: string; name?: string }>;
    return data
      .filter(t => t.email && t.email.includes('@'))
      .map(t => ({ email: t.email.trim().toLowerCase(), name: t.name?.trim() || null }));
  }

  // TSV — strip blank lines and # comments, take first two columns
  const out: Tester[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [emailRaw, nameRaw] = trimmed.split(/\t+|\s{2,}/);
    if (!emailRaw || !emailRaw.includes('@')) continue;
    out.push({
      email: emailRaw.trim().toLowerCase(),
      name: nameRaw?.trim() || null,
    });
  }
  return out;
}

async function findExistingBetaKey(email: string): Promise<string | null> {
  const rows = await getSql()`
    SELECT key
    FROM licenses
    WHERE LOWER(email) = ${email}
      AND product_sku = ${BETA_SKU}
      AND status = 'active'
    ORDER BY issued_at DESC
    LIMIT 1
  ` as Array<{ key: string }>;
  return rows[0]?.key || null;
}

async function insertBetaKey(email: string, key: string, buildVersion: string): Promise<void> {
  // Synthetic stripe_session — distinguishable from real Stripe ('cs_...')
  // and from manually-issued ('manual:...'). Lets a future audit query
  // pull "all beta-issued keys for build X".
  const stripeSession = `beta:${buildVersion}:${Date.now()}:${key.slice(-5)}`;
  await getSql()`
    INSERT INTO licenses (key, email, product_sku, stripe_session, status, notes)
    VALUES (${key}, ${email}, ${BETA_SKU}, ${stripeSession}, 'active', ${`Beta tester — build ${buildVersion}`})
  `;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.version || !args.dmg || !args.testersPath) {
    console.error('Usage: npx tsx scripts/send-beta-build.ts --version <v> --dmg <url> --testers <path> [--feedback <url>] [--dry-run] [--resend-only]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx scripts/send-beta-build.ts \\');
    console.error('    --version 1.0.0-beta.3 \\');
    console.error('    --dmg https://updates.heyselam.app/mac/Selam-1.0.0-beta.3-arm64.dmg \\');
    console.error('    --testers testers.tsv \\');
    console.error('    --feedback https://docs.google.com/...');
    process.exit(2);
  }

  if (!process.env.RESEND_API_KEY && !args.dryRun) {
    console.error('RESEND_API_KEY not set. Add it to .env.local before running, or pass --dry-run.');
    process.exit(2);
  }

  const testers = readTesters(args.testersPath);
  if (testers.length === 0) {
    console.error(`No valid tester rows found in ${args.testersPath}.`);
    process.exit(1);
  }

  console.log(`Build:        ${args.version}`);
  console.log(`DMG:          ${args.dmg}`);
  console.log(`Testers:      ${testers.length} (${args.testersPath})`);
  console.log(`Mode:         ${args.dryRun ? 'DRY RUN' : args.resendOnly ? 'resend existing keys only' : 'mint + send'}`);
  console.log('');

  const resend = args.dryRun ? null : new Resend(process.env.RESEND_API_KEY!);
  const summary = { minted: 0, reused: 0, sent: 0, skipped: 0, failed: 0 };

  // In dry-run with no DB URL configured, skip the lookup and treat every
  // tester as "no existing key" — lets you exercise the email render path
  // before infra is provisioned.
  const dbAvailable = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  if (!dbAvailable && !args.dryRun) {
    console.error('POSTGRES_URL not set — cannot mint or look up keys. Set it or use --dry-run.');
    process.exit(2);
  }

  for (const tester of testers) {
    try {
      let key = dbAvailable ? await findExistingBetaKey(tester.email) : null;
      let action: 'minted' | 'reused' | 'skipped' = 'skipped';

      if (!key && args.resendOnly) {
        console.warn(`  ${tester.email}: no existing beta key, skipping (--resend-only)`);
        summary.skipped++;
        continue;
      }

      if (!key) {
        key = mintKey();
        if (!args.dryRun) await insertBetaKey(tester.email, key, args.version);
        action = 'minted';
        summary.minted++;
      } else {
        action = 'reused';
        summary.reused++;
      }

      const msg = buildBetaInviteEmail({
        to: tester.email,
        key,
        buildVersion: args.version,
        downloadUrl: args.dmg,
        testerName: tester.name,
        feedbackUrl: args.feedbackUrl,
        from: RESEND_FROM,
      });

      if (args.dryRun) {
        console.log(`  ${tester.email}: ${action} ${key} → would send "${msg.subject}"`);
        continue;
      }

      const r = await resend!.emails.send({
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });

      if (r.error) {
        console.error(`  ${tester.email}: ${action} ${key} → resend error: ${JSON.stringify(r.error)}`);
        summary.failed++;
      } else {
        console.log(`  ${tester.email}: ${action} ${key} → sent (${r.data?.id})`);
        summary.sent++;
      }
    } catch (e) {
      console.error(`  ${tester.email}: failed — ${e instanceof Error ? e.message : e}`);
      summary.failed++;
    }
  }

  console.log('');
  console.log(`Summary: ${summary.minted} minted, ${summary.reused} reused, ${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed`);
  if (summary.failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Crashed:', e);
  process.exit(1);
});
