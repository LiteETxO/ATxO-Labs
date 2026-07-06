// robots.txt — discourage indexing of api.heyselam.app since the public
// pages here are mostly transactional (recover, buy, welcome, legal copy
// that's also on heyselam.app). Marketing SEO lives on heyselam.app.

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Allow the legal pages so search engines can index them and link
        // to the canonical URLs. Disallow API routes (don't waste crawler
        // budget; nothing to index).
        allow: ['/privacy', '/terms', '/eula', '/recover', '/buy'],
        disallow: ['/api/', '/welcome', '/admin', '/status'],
      },
    ],
    sitemap: 'https://api.heyselam.app/sitemap.xml',
    host: 'https://api.heyselam.app',
  };
}
