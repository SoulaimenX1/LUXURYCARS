import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// ==========================================================
// MÉTADONNÉES — ADMIN / FLOTTE (PAGE PRIVÉE)
// ==========================================================

export const metadata: Metadata = {
  title: 'Fleet management',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminVehiclesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
