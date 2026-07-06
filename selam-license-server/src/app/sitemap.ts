// Sitemap for api.heyselam.app — only the public legal/utility pages.
// Marketing content's sitemap lives on heyselam.app.

import type { MetadataRoute } from 'next';

const BASE = 'https://api.heyselam.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-05-03');
  return [
    { url: `${BASE}/privacy`, lastModified, changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${BASE}/terms`,   lastModified, changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${BASE}/eula`,    lastModified, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${BASE}/recover`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/buy`,     lastModified, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/status`,  lastModified, changeFrequency: 'always',  priority: 0.3 },
  ];
}
