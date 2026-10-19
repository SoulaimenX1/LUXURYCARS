import type { MetadataRoute } from 'next';

// ==========================================================
// ROBOTS.TXT
// ==========================================================
//
// Le site vitrine est indexable. Les espaces privés
// (administration, compte client) et l'API interne
// sont explicitement exclus.
// ==========================================================

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/api'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
