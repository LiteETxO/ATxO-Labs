// GET /api/validate?key=SELAM-XXXXX-XXXXX-XXXXX — License validation.
//
// Called from:
//   - Electron wizard at first activation (license/validate.js → activateLicense)
//   - Electron app at every launch (license/validate.js → revalidateOnLaunch)
//
// Pure logic lives in `../../../../validate-logic.js`. This file is the
// thin Next.js adapter.

import { NextRequest, NextResponse } from 'next/server';
import { findKeyByValue } from '@/lib/db';
import { getLimiter } from '@/lib/rate-limit';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateHandler } = require('../../../../validate-logic.js') as {
  validateHandler: (
    payload: { key?: string; ip: string },
    ctx: {
      db: { findKeyByValue: typeof findKeyByValue };
      rateLimiter: { check: (key: string, max: number, windowMs: number) => Promise<{ allowed: boolean; retryAfterSec?: number }> };
      logger?: Console;
    },
  ) => Promise<{ status: number; body: Record<string, unknown>; headers?: Record<string, string> }>;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || '';
  const ip = req.headers.get('x-real-ip')
          || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || 'unknown';

  const rateLimiter = await getLimiter();
  const result = await validateHandler({ key, ip }, {
    db:         { findKeyByValue },
    rateLimiter,
    logger:     console,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.headers,
  });
}
