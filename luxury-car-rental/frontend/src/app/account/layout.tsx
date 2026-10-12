import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// ==========================================================
// MÉTADONNÉES — ESPACE CLIENT (PAGES PRIVÉES)
// ==========================================================
//
// Ce layout couvre /account, /account/profile
// et /account/reservations.
// ==========================================================

export const metadata: Metadata = {
  title: 'My account',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
