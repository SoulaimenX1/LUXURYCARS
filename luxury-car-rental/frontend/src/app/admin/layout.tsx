'use client';

import Link from 'next/link';
import NotificationBell from '@/components/notification-bell';
import { usePathname, useRouter } from 'next/navigation';
import {
    useEffect,
    useState,
    type ReactNode,
} from 'react';

import { useToast } from '@/components/toast';

import styles from './admin-layout.module.css';

// ==========================================================
// TYPES
// ==========================================================

interface AuthUser {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    status?: string;
}

interface AuthResponse {
    user?: AuthUser;
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    status?: string;
}

// ==========================================================
// PROPS
// ==========================================================

interface AdminLayoutProps {
    children: ReactNode;
}

// ==========================================================
// NAVIGATION ADMIN
// ==========================================================

const navigation = [
    {
        href: '/admin',
        label: 'Overview',
        number: '01',
    },
    {
        href: '/admin/reservations',
        label: 'Reservations',
        number: '02',
    },
    {
        href: '/admin/vehicles',
        label: 'Fleet management',
        number: '03',
    },
    { href: '/admin/rentals', label: 'Rental management', number: '04' },
    { href: '/admin/customers', label: 'Customers', number: '05' },
    { href: '/admin/availability', label: 'Availability calendar', number: '06' },
    { href: '/admin/premium', label: 'Premium extras & offers', number: '07' },
    { href: '/admin/operations', label: 'Finance & returns', number: '08' },
    { href: '/admin/locations', label: 'Pick-up & Drop-off', number: '09' },
    { href: '/admin/media', label: 'Media studio / 3D', number: '10' },
    { href: '/admin/notifications', label: 'Notifications', number: '11' },
];

// ==========================================================
// ADMIN LAYOUT
// ==========================================================

export default function AdminLayout({
    children,
}: AdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();

    const [user, setUser] =
        useState<AuthUser | null>(null);

    const [checkingSession, setCheckingSession] =
        useState(true);

    const [loggingOut, setLoggingOut] =
        useState(false);

    const toast = useToast();

    // ========================================================
    // VÉRIFIER LA SESSION ADMIN
    // ========================================================

    useEffect(() => {
        let cancelled = false;

        async function checkSession() {
            try {
                const response = await fetch(
                    '/api/auth/me',
                    {
                        method: 'GET',
                        cache: 'no-store',
                    },
                );

                // --------------------------------------------------
                // Aucun utilisateur connecté
                // --------------------------------------------------

                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }

                if (!response.ok) {
                    router.replace('/login');
                    return;
                }

                const data: AuthResponse =
                    await response.json();

                // --------------------------------------------------
                // /api/auth/me peut retourner :
                //
                // { user: {...} }
                //
                // ou directement :
                //
                // { id, email, role, ... }
                // --------------------------------------------------

                const authenticatedUser: AuthUser =
                    data.user ?? data;

                // --------------------------------------------------
                // PROTECTION DU PORTAIL ADMIN
                // --------------------------------------------------

                if (
                    authenticatedUser.role !== 'admin'
                ) {
                    router.replace('/account');
                    return;
                }

                if (!cancelled) {
                    setUser(authenticatedUser);
                    setCheckingSession(false);
                }
            } catch {
                router.replace('/login');
            }
        }

        void checkSession();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // ========================================================
    // DÉCONNEXION
    // ========================================================

    async function logout() {
        if (loggingOut) {
            return;
        }

        setLoggingOut(true);

        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Logout failed.');
            }

            toast.success('You have been signed out.', 'Session');
        } catch {
            toast.error(
                'Unable to sign out. Please try again.',
                'Session',
            );
        } finally {
            router.replace('/login');
            router.refresh();
        }
    }

    // ========================================================
    // DÉTERMINER LE LIEN ACTIF
    // ========================================================

    function isActive(href: string): boolean {
        if (href === '/admin') {
            return pathname === '/admin';
        }

        return pathname.startsWith(href);
    }

    // ========================================================
    // ÉCRAN DE VÉRIFICATION
    // ========================================================

    if (checkingSession) {
        return (
            <div className={styles.sessionScreen}>
                <div className={styles.sessionMark}>
                    LC
                </div>

                <p>
                    Verifying administrator session
                </p>
            </div>
        );
    }

    // ========================================================
    // INTERFACE ADMIN
    // ========================================================

    return (
        <div className={styles.shell}>

            {/* ================================================= */}
            {/* SIDEBAR ADMIN                                   */}
            {/* ================================================= */}

            <aside className={styles.sidebar}>

                {/* LOGO */}

                <div className={styles.identity}>
                    <Link
                        href="/admin"
                        className={styles.logo}
                    >
                        LC
                    </Link>

                    <div>
                        <strong>
                            LUXURY CARS
                        </strong>

                        <span>
                            ADMINISTRATION
                        </span>
                    </div>
                </div>

                {/* TITRE */}

                <div className={styles.workspace}>
                    <span>
                        PRIVATE OFFICE
                    </span>

                    <h1>
                        Control
                        <br />
                        centre
                    </h1>
                </div>

                {/* NAVIGATION */}

                <nav className={styles.navigation}>
                    {navigation.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={
                                isActive(item.href)
                                    ? styles.activeLink
                                    : styles.navLink
                            }
                        >
                            <span
                                className={styles.navNumber}
                            >
                                {item.number}
                            </span>

                            <span>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

                {/* BAS DE SIDEBAR */}

                <div className={styles.sidebarFooter}>

                    <div className={styles.adminAccount}>
                        <span
                            className={styles.avatar}
                        >
                            {user?.firstName
                                ?.charAt(0)
                                .toUpperCase() ??
                                user?.email
                                    ?.charAt(0)
                                    .toUpperCase() ??
                                'A'}
                        </span>

                        <div>
                            <strong>
                                {user?.firstName ||
                                    'Administrator'}
                            </strong>

                            <span>
                                {user?.email ??
                                    'Admin account'}
                            </span>
                        </div>
                    </div>

                    <Link
                        href="/"
                        className={styles.publicLink}
                    >
                        <span>
                            ↗
                        </span>

                        View public website
                    </Link>

                    <button
                        type="button"
                        onClick={logout}
                        disabled={loggingOut}
                        className={styles.logout}
                    >
                        <span>
                            ⏻
                        </span>

                        {loggingOut
                            ? 'Signing out...'
                            : 'Sign out'}
                    </button>

                </div>

            </aside>

            {/* ================================================= */}
            {/* CONTENU ADMIN                                    */}
            {/* ================================================= */}

            <section className={styles.main}>

                {/* TOP BAR */}

                <div className={styles.topbar}>
                    <div>
                        <span
                            className={styles.systemStatus}
                        >
                            <i />
                            SYSTEM ONLINE
                        </span>
                    </div>

                    <div className={styles.topbarActions}>
                        {/* Cloche personnelle de l’administrateur. */}
                        <NotificationBell admin />

                        <div className={styles.topbarRight}>
                            <span>
                                ADMINISTRATOR
                            </span>

                            <strong>
                                {user?.firstName
                                    ? `${user.firstName}${user.lastName
                                        ? ` ${user.lastName}`
                                        : ''
                                    }`
                                    : user?.email ??
                                    'Admin'}
                            </strong>
                        </div>
                    </div>
                </div>

                {/* PAGES ADMIN */}

                <div className={styles.content}>
                    {children}
                </div>

            </section>

        </div>
    );
}

