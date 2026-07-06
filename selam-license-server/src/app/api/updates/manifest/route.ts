// GET /api/updates/manifest
//
// JSON shape of the current update manifest. Used by /download to render
// the current version + filename. Public, cached briefly.

import { NextResponse } from 'next/server';
import { getCurrentManifest } from '@/lib/update-feed';

export async function GET() {
  const m = await getCurrentManifest();
  if (!m) {
    return NextResponse.json(
      { error: 'Update feed unavailable.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
  return NextResponse.json(
    {
      version: m.version,
      releaseDate: m.releaseDate,
      fileName: m.fileName,
      fileUrl: m.fileUrl,
      size: m.size,
      sha512: m.sha512,
    },
    {
      status: 200,
      // Cache at the edge for 30s — manifest changes infrequently and
      // 30s of staleness on the download page is fine.
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
