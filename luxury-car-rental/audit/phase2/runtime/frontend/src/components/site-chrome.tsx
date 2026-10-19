'use client';

import { usePathname } from 'next/navigation';

import type {
    ReactNode,
} from 'react';

import SiteFooter from './site-footer';
import SiteHeader from './site-header';

// ==========================================================
// CHROME COMMUN — HEADER + FOOTER
// ==========================================================
//
// Enveloppe toutes les pages du site avec le header et le
// footer communs.
//
// L'espace d'administration possède sa propre mise en page
// (barre latérale) : le chrome public y est masqué.
// ==========================================================

export default function SiteChrome({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();

    if (pathname?.startsWith('/admin')) {
        return <>{children}</>;
    }

    return (
        <>
            <SiteHeader />

            {children}

            <SiteFooter />
        </>
    );
}
