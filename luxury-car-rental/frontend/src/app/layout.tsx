import type {
  Metadata,
} from 'next';

import SiteChrome from '@/components/site-chrome';

import './globals.css';

// ==========================================================
// TYPOGRAPHIE — police sans-serif normale et claire.
// Une seule famille lisible est utilisée pour tout le site
// (titres et texte courant). Elle est définie dans globals.css
// via les variables CSS --sans et --serif.
// ==========================================================

// ==========================================================
// MÉTADONNÉES GÉNÉRALES
// ==========================================================

export const metadata: Metadata = {
  // URL de base utilisée pour construire les URLs absolues
  // (Open Graph, sitemap, robots...).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000',
  ),

  title: {
    default: 'Luxury Cars | Premium Car Rental',
    template: '%s | Luxury Cars',
  },

  description:
    'Discover premium vehicles, check real-time availability and manage your luxury car reservations online.',
};

// ==========================================================
// LAYOUT PRINCIPAL
// ==========================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        {/* Applique le thème enregistré avant la peinture du
            contenu, afin d'éviter tout flash clair/sombre. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('luxury-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />

        <SiteChrome>
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}