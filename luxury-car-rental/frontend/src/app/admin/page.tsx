import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

import { buildApiUrl } from '@/lib/api';
import styles from './admin.module.css';

// ==========================================================
// MÉTADONNÉES — ADMIN (PAGE PRIVÉE)
// ==========================================================

export const metadata: Metadata = {
    title: 'Admin dashboard',
    robots: {
        index: false,
        follow: false,
    },
};

// ==========================================================
// TYPES DES DONNÉES DU DASHBOARD
// ==========================================================
//
// Les statistiques sont récupérées depuis NestJS.
// Nous ne créons aucune donnée fictive.
// ==========================================================

type DashboardResult =
    | {
        success: true;
        data: Record<string, unknown>;
    }
    | {
        success: false;
        message: string;
    };

// ==========================================================
// VÉRIFIER QU'UNE VALEUR EST UN OBJET
// ==========================================================

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

// ==========================================================
// RÉCUPÉRER UNE SECTION DU JSON
// ==========================================================
//
// Exemple :
//
// dashboard.vehicles
// dashboard.reservations
// dashboard.customers
// ==========================================================

function getSection(
    object: Record<string, unknown>,
    key: string,
): Record<string, unknown> {
    const value = object[key];

    return isRecord(value) ? value : {};
}

// ==========================================================
// FORMATTER UN COMPTEUR
// ==========================================================
//
// Si une valeur n'est pas fournie par le backend,
// afficher "—" plutôt qu'inventer zéro.
// ==========================================================

function formatCount(value: unknown): string {
    if (
        typeof value === 'number' &&
        Number.isFinite(value)
    ) {
        return new Intl.NumberFormat('en-US').format(value);
    }

    if (
        typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(Number(value))
    ) {
        return new Intl.NumberFormat('en-US').format(
            Number(value),
        );
    }

    return '—';
}

// ==========================================================
// CHARGER LES STATISTIQUES DEPUIS NESTJS
// ==========================================================

async function loadDashboard(): Promise<DashboardResult> {
    // --------------------------------------------------------
    // 1. RÉCUPÉRER LE JWT DEPUIS LE COOKIE HTTPONLY
    // --------------------------------------------------------

    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;

    // Utilisateur non connecté.
    if (!token) {
        redirect('/login');
    }

    // --------------------------------------------------------
    // 2. CONTACTER LE BACKEND
    // --------------------------------------------------------
    //
    // Cet appel s'exécute sur le serveur Next.js.
    //
    // Le JWT ne sera pas exposé au JavaScript du navigateur.
    // --------------------------------------------------------

    let response: Response;

    try {
        response = await fetch(
            buildApiUrl('/dashboard/admin'),
            {
                method: 'GET',

                headers: {
                    Authorization: `Bearer ${token}`,
                },

                cache: 'no-store',
            },
        );
    } catch {
        return {
            success: false,
            message:
                'Unable to connect to the dashboard service.',
        };
    }

    // --------------------------------------------------------
    // 3. GÉRER LES PERMISSIONS
    // --------------------------------------------------------

    // Token absent, invalide ou expiré.
    if (response.status === 401) {
        redirect('/login');
    }

    // Utilisateur connecté sans permission ADMIN.
    if (response.status === 403) {
        redirect('/account');
    }

    // Autre erreur du backend.
    if (!response.ok) {
        return {
            success: false,
            message:
                `Dashboard service returned HTTP ${response.status}.`,
        };
    }

    // --------------------------------------------------------
    // 4. LIRE LES STATISTIQUES
    // --------------------------------------------------------

    try {
        const data: unknown = await response.json();

        if (!isRecord(data)) {
            return {
                success: false,
                message: 'Invalid dashboard data received.',
            };
        }

        return {
            success: true,
            data,
        };
    } catch {
        return {
            success: false,
            message: 'Unable to read dashboard information.',
        };
    }
}

// ==========================================================
// PAGE ADMIN DASHBOARD
// ==========================================================

export default async function AdminPage() {
    // Charger les vraies statistiques PostgreSQL.
    const result = await loadDashboard();

    // ========================================================
    // ERREUR DE CHARGEMENT
    // ========================================================

    if (!result.success) {
        return (
            <main className={styles.errorPage}>
                <div className={styles.errorCard}>
                    <span className={styles.eyebrow}>
                        ADMINISTRATION
                    </span>

                    <h1>Dashboard unavailable</h1>

                    <p>{result.message}</p>

                    <Link href="/" className={styles.primaryLink}>
                        Return to home
                    </Link>
                </div>
            </main>
        );
    }

    // ========================================================
    // LIRE LES SECTIONS DU DASHBOARD
    // ========================================================

    const dashboard = result.data;

    const vehicles = getSection(dashboard, 'vehicles');
    const reservations = getSection(dashboard, 'reservations');
    const customers = getSection(dashboard, 'customers');

    const vehicleStatus = getSection(vehicles, 'byStatus');

    const reservationStatus = getSection(
        reservations,
        'byStatus',
    );

    // ========================================================
    // CRÉER LES INDICATEURS
    // ========================================================
    //
    // Chaque valeur provient du backend.
    // ========================================================

    const statistics = [
        {
            label: 'TOTAL VEHICLES',
            value: formatCount(vehicles.total),
            description: 'Vehicles registered in the fleet',
        },
        {
            label: 'ACTIVE VEHICLES',
            value: formatCount(vehicleStatus.active),
            description: 'Vehicles currently active',
        },
        {
            label: 'MAINTENANCE',
            value: formatCount(vehicleStatus.maintenance),
            description: 'Vehicles under maintenance',
        },
        {
            label: 'TOTAL CUSTOMERS',
            value: formatCount(customers.total),
            description: 'Registered customer accounts',
        },
        {
            label: 'TOTAL RESERVATIONS',
            value: formatCount(reservations.total),
            description: 'All reservation requests',
        },
        {
            label: 'PENDING',
            value: formatCount(reservationStatus.pending),
            description: 'Waiting for administrator review',
        },
        {
            label: 'CONFIRMED',
            value: formatCount(reservationStatus.confirmed),
            description: 'Approved reservations',
        },
        {
            label: 'CANCELLED',
            value: formatCount(reservationStatus.cancelled),
            description: 'Cancelled reservations',
        },
        {
            label: 'REJECTED',
            value: formatCount(reservationStatus.rejected),
            description: 'Rejected reservation requests',
        },
    ];

    // ========================================================
    // INTERFACE ADMIN
    // ========================================================

    return (
        <main className={styles.page}>

            {/* ================================================= */}
            {/* PAGE TITLE                                       */}
            {/* ================================================= */}

            <section className={styles.hero}>
                <div className={styles.container}>

                    <span className={styles.eyebrow}>
                        ADMINISTRATOR CONTROL PANEL
                    </span>

                    <h1>
                        Management
                        <span> overview.</span>
                    </h1>

                    <p>
                        Monitor your luxury vehicle fleet,
                        customer accounts and reservations
                        using real-time database statistics.
                    </p>

                </div>
            </section>

            {/* ================================================= */}
            {/* DASHBOARD STATISTICS                             */}
            {/* ================================================= */}

            <section className={styles.dashboard}>
                <div className={styles.container}>

                    <div className={styles.sectionHeading}>
                        <div>
                            <span className={styles.eyebrow}>
                                LIVE BUSINESS DATA
                            </span>

                            <h2>Key performance indicators</h2>
                        </div>

                        <span className={styles.liveText}>
                            Connected to PostgreSQL
                        </span>
                    </div>

                    {/* CARTES STATISTIQUES */}

                    <div className={styles.statsGrid}>
                        {statistics.map((statistic) => (
                            <article
                                key={statistic.label}
                                className={styles.statCard}
                            >
                                <span className={styles.statLabel}>
                                    {statistic.label}
                                </span>

                                <strong className={styles.statValue}>
                                    {statistic.value}
                                </strong>

                                <p className={styles.statDescription}>
                                    {statistic.description}
                                </p>
                            </article>
                        ))}
                    </div>

                    {/* ============================================= */}
                    {/* MODULES ADMIN DISPONIBLES                       */}
                    {/* ============================================= */}

                    <div className={styles.sectionHeading}>
                        <div>
                            <span className={styles.eyebrow}>
                                ADMINISTRATIVE OPERATIONS
                            </span>

                            <h2>Management modules</h2>
                        </div>
                    </div>

                    <div className={styles.modulesGrid}>

                        <Link
                            href="/admin/reservations"
                            className={styles.moduleCard}
                        >
                            <span className={styles.moduleNumber}>
                                01
                            </span>

                            <h3>Reservation Management</h3>

                            <p>
                                Review incoming reservations,
                                confirm or reject customer requests.
                            </p>

                            <span className={styles.moduleAction}>
                                OPEN MODULE →
                            </span>
                        </Link>

                        <Link
                            href="/admin/vehicles"
                            className={styles.moduleCard}
                        >
                            <span className={styles.moduleNumber}>
                                02
                            </span>

                            <h3>Fleet Management</h3>

                            <p>
                                Manage brands, categories,
                                vehicle models and fleet records.
                            </p>

                            <span className={styles.moduleAction}>
                                OPEN MODULE →
                            </span>
                        </Link>

                    </div>

                </div>
            </section>

        </main>
    );
}

