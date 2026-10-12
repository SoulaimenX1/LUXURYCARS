'use client';

import Link from 'next/link';

import {
    usePathname,
    useRouter,
} from 'next/navigation';

import {
    useEffect,
    useState,
} from 'react';

import NotificationBell from './notification-bell';
import ThemeToggle from './theme-toggle';

import styles from './site-chrome.module.css';

// ==========================================================
// HEADER COMMUN — LUXURY CARS
// ==========================================================
//
// Ce header est partagé par toutes les pages publiques et
// l'espace client. Il adapte ses actions à l'état de
// connexion (Sign in / Create account, ou My account /
// Sign out).
// ==========================================================

interface CurrentUser {
    role?: string;
}

const NAVIGATION = [
    { href: '/', label: 'Home' },
    { href: '/vehicles', label: 'Fleet' },
    { href: '/availability', label: 'Availability' },
];

export default function SiteHeader() {
    const pathname = usePathname();
    const router = useRouter();

    const [user, setUser] =
        useState<CurrentUser | null>(null);

    const [signingOut, setSigningOut] =
        useState(false);

    // Vérifier la session à chaque changement de page.
    useEffect(() => {
        let active = true;

        async function loadUser() {
            try {
                const response = await fetch(
                    '/api/auth/session',
                    {
                        cache: 'no-store',
                    },
                );

                if (!active) {
                    return;
                }

                if (!response.ok) {
                    setUser(null);
                    return;
                }

                const data =
                    (await response.json()) as {
                        user?: CurrentUser | null;
                    };

                setUser(data.user ?? null);
            } catch {
                if (active) {
                    setUser(null);
                }
            }
        }

        void loadUser();

        return () => {
            active = false;
        };
    }, [pathname]);

    // Déconnexion : supprimer le cookie puis revenir à
    // l'accueil.
    async function handleLogout() {
        setSigningOut(true);

        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
            });
        } finally {
            setUser(null);
            setSigningOut(false);
            router.push('/');
            router.refresh();
        }
    }

    // Indiquer si un lien correspond à la page courante.
    function isActive(href: string): boolean {
        if (href === '/') {
            return pathname === '/';
        }

        return pathname?.startsWith(href) ?? false;
    }

    return (
        <header className={styles.header}>
            <div className={styles.headerInner}>

                <Link
                    href="/"
                    className={styles.brand}
                >
                    <span className={styles.brandMark}>
                        L
                    </span>

                    <span className={styles.brandText}>
                        <strong>
                            LUXURY
                            <em> CARS</em>
                        </strong>

                        <small>
                            PREMIUM CAR RENTAL
                        </small>
                    </span>
                </Link>

                <nav className={styles.navigation}>
                    {NAVIGATION.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={
                                isActive(item.href)
                                    ? styles.activeLink
                                    : undefined
                            }
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className={styles.headerActions}>
                    {user && <NotificationBell />}

                    <ThemeToggle />

                    {user ? (
                        <>
                            {user.role === 'admin' && (
                                <Link
                                    href="/admin"
                                    className={styles.signIn}
                                >
                                    Admin
                                </Link>
                            )}

                            <Link
                                href="/account"
                                className={
                                    styles.accountButton
                                }
                            >
                                My account
                            </Link>

                            <Link
                                href="/account/reservations"
                                className={
                                    styles.reservationsButton
                                }
                            >
                                My reservations
                            </Link>

                            <button
                                type="button"
                                className={styles.signOut}
                                onClick={handleLogout}
                                disabled={signingOut}
                            >
                                {signingOut
                                    ? 'Signing out...'
                                    : 'Sign out'}
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className={styles.signIn}
                            >
                                Sign in
                            </Link>

                            <Link
                                href="/register"
                                className={
                                    styles.accountButton
                                }
                            >
                                Create account
                            </Link>
                        </>
                    )}
                </div>

            </div>
        </header>
    );
}
