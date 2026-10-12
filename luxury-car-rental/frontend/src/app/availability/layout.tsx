import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// ==========================================================
// MÉTADONNÉES SEO — DISPONIBILITÉ
// ==========================================================

export const metadata: Metadata = {
  title: 'Availability',
  description:
    'Check real-time availability of our luxury vehicles for your chosen rental dates.',
};

export default function AvailabilityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
