import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// ==========================================================
// MÉTADONNÉES — CONNEXION (PAGE PRIVÉE)
// ==========================================================
//
// Les pages d'authentification ne doivent pas
// être indexées par les moteurs de recherche.
// ==========================================================

export const metadata: Metadata = {
  title: 'Sign in',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
