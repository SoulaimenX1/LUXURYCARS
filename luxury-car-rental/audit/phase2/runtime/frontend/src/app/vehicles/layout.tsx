import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// ==========================================================
// MÉTADONNÉES SEO — CATALOGUE PUBLIC
// ==========================================================

export const metadata: Metadata = {
  title: 'Our Fleet',
  description:
    'Browse our curated collection of luxury and performance vehicles available for rent.',
};

export default function VehiclesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
