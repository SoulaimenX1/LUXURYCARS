'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import styles from './account.module.css';

// ==========================================================
// TYPE DE L'UTILISATEUR CONNECTÉ
// ==========================================================

interface AuthenticatedUser {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
    role?: string;
    status?: string;
}

// ==========================================================
// PAGE CUSTOMER DASHBOARD
// ==========================================================

export default function AccountPage() {
    const router = useRouter();

    const [user, setUser] =
        useState<AuthenticatedUser | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ======================================================
    // CHARGER L'UTILISATEUR CONNECTÉ
    // ======================================================

    useEffect(() => {
        let active = true;

        async function loadUser() {
            try {
                const response = await fetch('/api/auth/me', {
                    method: 'GET',
                    cache: 'no-store',
                });

                // Aucun JWT valide : retour au login.
                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }

                if (!response.ok) {
                    throw new Error('Unable to retrieve account.');
                }

                const data: AuthenticatedUser =
                    await response.json();

                if (!data || typeof data.email !== 'string') {
                    throw new Error('Invalid account response.');
                }

                // Un administrateur ne doit pas utiliser
                // l'espace réservé aux clients.
                if (data.role === 'admin') {
                    router.replace('/admin');
                    return;
                }

                // Tout autre rôle inattendu est refusé.
                if (data.role !== 'customer') {
                    router.replace('/login');
                    return;
                }

                if (active) {
                    setUser(data);
                }
            } catch {
                if (active) {
                    setError(
                        'Unable to load your account information.',
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadUser();

        return () => {
            active = false;
        };
    }, [router]);

    // ======================================================
    // CHARGEMENT
    // ======================================================

    if (loading) {
        return (
            <main className={styles.centerPage}>
                <div className={styles.loadingCard}>
                    <span className={styles.loadingMark}>L</span>
                    <p>Loading your account...</p>
                </div>
            </main>
        );
    }

    // ======================================================
    // ERREUR
    // ======================================================

    if (!user) {
        return (
            <main className={styles.centerPage}>
                <div className={styles.errorCard}>
                    <span className={styles.eyebrow}>
                        CUSTOMER AREA
                    </span>

                    <h1>Account unavailable</h1>

                    <p>
                        {error ||
                            'Unable to retrieve your account.'}
                    </p>

                    <Link
                        href="/login"
                        className={styles.primaryButton}
                    >
                        Return to sign in
                    </Link>
                </div>
            </main>
        );
    }

    // ======================================================
    // INFORMATIONS À AFFICHER
    // ======================================================

    const fullName =
        [user.firstName, user.lastName]
            .filter(Boolean)
            .join(' ') || 'Customer';

    const initials =
        `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`
            .toUpperCase() || 'C';

    const firstName =
        user.firstName || 'Customer';

    // ======================================================
    // INTERFACE CLIENT
    // ======================================================

    return (
        <main className={styles.page}>

            {/* ================================================= */}
            {/* DASHBOARD                                        */}
            {/* ================================================= */}

            <div className={styles.dashboard}>

                {/* INTRODUCTION */}

                <section className={styles.intro}>
                    <div>
                        <span className={styles.eyebrow}>
                            YOUR PRIVATE GARAGE
                        </span>

                        <h1>
                            Welcome, {firstName}.
                        </h1>

                        <p>
                            Everything you need to discover,
                            reserve and manage your luxury
                            rental experience.
                        </p>
                    </div>

                    <div className={styles.customerBadge}>
                        <span className={styles.avatar}>
                            {initials}
                        </span>

                        <div>
                            <strong>{fullName}</strong>
                            <span>{user.email}</span>
                        </div>
                    </div>
                </section>

                {error && (
                    <div
                        className={styles.errorBanner}
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {/* ================================================= */}
                {/* RÉSERVATIONS — ACCÈS PRIVILÉGIÉ                   */}
                {/* ================================================= */}

                <section className={styles.reservationsBanner}>
                    <div className={styles.reservationsText}>
                        <span
                            className={styles.reservationsEyebrow}
                        >
                            RESERVATIONS
                        </span>

                        <h2>Your reservations &amp; status</h2>

                        <p>
                            Track every booking — pending,
                            confirmed, cancelled or completed —
                            in one place.
                        </p>
                    </div>

                    <Link
                        href="/account/reservations"
                        className={styles.reservationsCta}
                    >
                        View my reservations
                        <span aria-hidden="true">→</span>
                    </Link>
                </section>

                {/* ================================================= */}
                {/* ACTIONS PRINCIPALES                               */}
                {/* ================================================= */}

                <section className={styles.quickSection}>
                    <div className={styles.sectionTitle}>
                        <span>QUICK ACCESS</span>
                        <h2>What would you like to do?</h2>
                    </div>

                    <div className={styles.actionGrid}>

                        <Link
                            href="/vehicles"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                01
                            </span>

                            <div>
                                <h3>Browse cars</h3>
                                <p>
                                    Explore the luxury vehicle
                                    collection.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                        <Link
                            href="/availability"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                02
                            </span>

                            <div>
                                <h3>Check availability</h3>
                                <p>
                                    Choose dates and find an
                                    available vehicle.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                        <Link
                            href="/account/reservations"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                03
                            </span>

                            <div>
                                <h3>My reservations</h3>
                                <p>
                                    Review and manage your current
                                    bookings.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                        <Link
                            href="/account/profile"
                            className={styles.actionCard}
                        >
                            <span className={styles.actionNumber}>
                                04
                            </span>

                            <div>
                                <h3>Profile & licence</h3>
                                <p>
                                    Manage personal information and
                                    driving licence details.
                                </p>
                            </div>

                            <span className={styles.arrow}>
                                →
                            </span>
                        </Link>

                    </div>
                </section>

                {/* ================================================= */}
                {/* RÉSUMÉ DU COMPTE                                 */}
                {/* ================================================= */}

                <section className={styles.accountSection}>

                    <div className={styles.sectionTitle}>
                        <span>ACCOUNT</span>
                        <h2>Your details</h2>
                    </div>

                    <div className={styles.accountCard}>

                        <div className={styles.accountIdentity}>
                            <span className={styles.largeAvatar}>
                                {initials}
                            </span>

                            <div>
                                <h3>{fullName}</h3>
                                <p>{user.email}</p>
                            </div>
                        </div>

                        <div className={styles.detailsGrid}>

                            <div className={styles.detail}>
                                <span>First name</span>
                                <strong>
                                    {user.firstName ||
                                        'Not provided'}
                                </strong>
                            </div>

                            <div className={styles.detail}>
                                <span>Last name</span>
                                <strong>
                                    {user.lastName ||
                                        'Not provided'}
                                </strong>
                            </div>

                            <div className={styles.detail}>
                                <span>Phone</span>
                                <strong>
                                    {user.phone ||
                                        'Not provided'}
                                </strong>
                            </div>

                            <div className={styles.detail}>
                                <span>Status</span>
                                <strong
                                    className={styles.status}
                                >
                                    {user.status ||
                                        'Not available'}
                                </strong>
                            </div>

                        </div>

                        <Link
                            href="/account/profile"
                            className={styles.profileButton}
                        >
                            Edit profile
                            <span aria-hidden="true">→</span>
                        </Link>

                    </div>
                </section>

            </div>
        </main>
    );
}
