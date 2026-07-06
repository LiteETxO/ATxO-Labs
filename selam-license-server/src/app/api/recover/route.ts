// POST /api/recover  — License key recovery endpoint.
//
// Wraps the pure handler from `../../../../recover.js` with:
//   - JSON body parsing
//   - IP extraction
//   - Vercel Postgres adapter (db.ts)
//   - Resend adapter (mailer.ts)
//   - KV/memory rate limiter (rate-limit.ts)
//
// CORS: allows POST from heyselam.app (configurable via ALLOWED_RECOVERY_ORIGIN).

import { NextRequest, NextResponse } from 'next/server';
import { findKeysByEmail } from '@/lib/db';
import { sendRecoveryEmail } from '@/lib/mailer';
import { getLimiter } from '@/lib/rate-limit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { recoverHandler } = require('../../../../recover.js') as {
  recoverHandler: (
    payload: { email?: string },
    ctx: {
      ip: string;
      db: { findKeysByEmail: (email: string) => Promise<Array<{ key: string }>> };
      mailer: { sendRecoveryEmail: (a: { to: string; keys: Array<{ key: string }>; sentAt: Date }) => Promise<void> };
      rateLimiter: { check: (key: string, max: number, windowMs: number) => Promise<{ allowed: boolean; retryAfterSec?: number }> };
      logger?: { info: (msg: string, ...args: unknown[]) => void; warn: (msg: string, ...args: unknown[]) => void; error: (msg: string, ...args: unknown[]) => void };
    },
  ) => Promise<{ status: number; body: Record<string, unknown>; headers?: Record<string, string> }>;
};

const ALLOWED_ORIGIN = process.env.ALLOWED_RECOVERY_ORIGIN || 'https://heyselam.app';

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  // Accept same-origin (api.heyselam.app), heyselam.app, and dev localhost.
  const allowed = origin === ALLOWED_ORIGIN
              || origin === 'https://heyselam.app'
              || origin.startsWith('http://localhost')
              || origin === '';   // server-side calls (no Origin header)
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  let payload: { email?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders(req) });
  }

  // Best-effort IP extraction. Vercel + most CDNs set x-forwarded-for.
  const ip = req.headers.get('x-real-ip')
          || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || 'unknown';

  const rateLimiter = await getLimiter();

  const result = await recoverHandler(payload, {
    ip,
    db:     { findKeysByEmail },
    mailer: { sendRecoveryEmail },
    rateLimiter,
    logger: console,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: { ...corsHeaders(req), ...(result.headers || {}) },
  });
}
