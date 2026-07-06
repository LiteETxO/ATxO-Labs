import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Default Vercel deployment; no special build mode needed.
  output: process.env.VERCEL ? undefined : 'standalone',
  // Recovery + validate are pure POSTs; no static page caching.
  experimental: {
    // Ensure server-only env vars don't leak to client bundles.
    serverActions: { bodySizeLimit: '1mb' },
  },
  // No remote images expected for the API surface.
  async rewrites() {
    return [
      // Selam v1.0 hard-codes the validate URL as `/validate` (no /api prefix).
      // Rewriting here keeps the canonical route at /api/validate while letting
      // already-shipped apps continue to work without a forced update.
      // (Don't add /recover here — that path is a buyer-facing recovery form,
      //  not the API endpoint.)
      { source: '/validate', destination: '/api/validate' },
    ];
  },
};

export default nextConfig;
