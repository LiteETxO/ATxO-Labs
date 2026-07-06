// GET /api/updates/latest-mac.yml
//
// Pass-through of the raw electron-updater manifest YAML. This is the
// vendor-portable URL — buyers' apps could be pointed at this instead
// of the R2 URL directly, letting us swap hosting providers without
// pushing an update first.
//
// For v1.0 we keep electron-updater pointed at R2 directly (one less
// hop = lower latency for the check). This route exists as a fallback
// surface and is what the manifest proxy uses when the dashboard
// or status page wants the YAML form.

import { NextResponse } from 'next/server';
import { getRawManifest } from '@/lib/update-feed';

export async function GET() {
  const yaml = await getRawManifest();
  if (!yaml) {
    return new NextResponse('Update feed unavailable.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return new NextResponse(yaml, {
    status: 200,
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
