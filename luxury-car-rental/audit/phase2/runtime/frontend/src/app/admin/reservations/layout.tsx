import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// ==========================================================
// MÉTADONNÉES — ADMIN / RÉSERVATIONS (PAGE PRIVÉE)
// ==========================================================

export const metadata: Metadata = {
  title: 'Reservations',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminReservationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
