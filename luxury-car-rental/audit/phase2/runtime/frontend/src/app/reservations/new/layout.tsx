import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// ==========================================================
// MÉTADONNÉES — NOUVELLE RÉSERVATION (PAGE PRIVÉE)
// ==========================================================

export const metadata: Metadata = {
  title: 'New reservation',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NewReservationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
