import type { MetadataRoute } from 'next';

// ==========================================================
// SITEMAP.XML
// ==========================================================
//
// Seules les pages publiques indexables sont listées.
// Les pages privées sont exclues via robots.ts.
// ==========================================================

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/vehicles`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
