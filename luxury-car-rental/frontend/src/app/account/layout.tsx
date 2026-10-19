import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import ReviewPopup from '@/components/account/review-popup';

// ==========================================================
// MÉTADONNÉES — ESPACE CLIENT (PAGES PRIVÉES)
// ==========================================================
//
// Ce layout couvre /account, /account/profile
// et /account/reservations.
//
// Il monte aussi la fenêtre d'avis : dès qu'un client connecté a
// une location terminée non encore évaluée, elle s'ouvre
// automatiquement (avis voiture + avis service si des services
// optionnels ont été souscrits).
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
  return (
    <>
      {children}
      <ReviewPopup />
    </>
  );
}
