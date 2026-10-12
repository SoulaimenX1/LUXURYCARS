
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import styles from './reservations.module.css';

import { formatAmount } from '@/lib/format';

// ==========================================================
// TYPES DES RÉSERVATIONS
// ==========================================================

interface PendingReservation {
    id: string;
    reservationNumber: string;
    customerId: string;
    vehicleId: string;

    pickupAt: string;
    returnAt: string;

    rentalDays: number;
    dailyPrice: string;
    depositAmount: string;
    totalAmount: string;

    status: string;
    customerNotes: string | null;

    createdAt: string;
}

// ==========================================================
// TYPE DU CATALOGUE
// ==========================================================
//
// Le catalogue permet de retrouver le nom d'un véhicule
// à partir de son identifiant PostgreSQL.
// ==========================================================

interface CatalogVehicle {
    id: string;
    brandName: string;
    modelName: string;
}

// ==========================================================
// TYPES DES RÉPONSES API
// ==========================================================

interface AuthenticatedUser {
    role?: string;
}

interface ApiError {
    message?: string | string[];
}

// ==========================================================
// FORMATER LES DATES
// ==========================================================
//
// Les dates viennent du backend en ISO 8601.
//
// Exemple : 2026-11-03T00:00:00.000Z
// devient : 2026-11-03
// ==========================================================

function formatDate(value: string): string {
    return value.slice(0, 10);
}

// ==========================================================
// LIRE LE MESSAGE D'ERREUR
// ==========================================================

async function getErrorMessage(
    response: Response,
): Promise<string> {
    try {
        const data: ApiError = await response.json();

        if (Array.isArray(data.message)) {
            return data.message.join(' ');
        }

        if (typeof data.message === 'string') {
            return data.message;
        }
    } catch {
        // Réponse non JSON : conserver le message HTTP.
    }

    return `Request failed (HTTP ${response.status}).`;
}

// ==========================================================
// PAGE ADMIN RESERVATIONS
// ==========================================================

export default function AdminReservationsPage() {
    const router = useRouter();

    // ========================================================
    // DONNÉES DU BACKEND
    // ========================================================

    const [reservations, setReservations] =
        useState<PendingReservation[]>([]);

    const [vehicles, setVehicles] =
        useState<CatalogVehicle[]>([]);

    // ========================================================
    // ÉTATS DE L'INTERFACE
    // ========================================================

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState('');

    const [success, setSuccess] = useState('');

    // Numéro de la réservation en cours de traitement.
    const [processingNumber, setProcessingNumber] =
        useState<string | null>(null);

    // Motifs de refus renseignés par l'administrateur.
    const [reasons, setReasons] =
        useState<Record<string, string>>({});

    // ========================================================
    // CHARGER LES RÉSERVATIONS
    // ========================================================

    useEffect(() => {
        let active = true;

        async function loadData() {
            try {
                // --------------------------------------------------
                // 1. VÉRIFIER LA SESSION
                // --------------------------------------------------

                const authResponse = await fetch('/api/auth/me', {
                    method: 'GET',
                    cache: 'no-store',
                });

                if (authResponse.status === 401) {
                    router.replace('/login');
                    return;
                }

                if (!authResponse.ok) {
                    throw new Error('Unable to verify administrator.');
                }

                const user: AuthenticatedUser =
                    await authResponse.json();

                // Refuser l'accès aux comptes non administrateurs.
                if (user.role !== 'admin') {
                    router.replace('/account');
                    return;
                }

                // --------------------------------------------------
                // 2. CHARGER LES RÉSERVATIONS PENDING
                // --------------------------------------------------

                const response = await fetch(
                    '/api/admin/reservations',
                    {
                        method: 'GET',
                        cache: 'no-store',
                    },
                );

                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }

                if (response.status === 403) {
                    router.replace('/account');
                    return;
                }

                if (!response.ok) {
                    throw new Error(await getErrorMessage(response));
                }

                const data: unknown = await response.json();

                if (!Array.isArray(data)) {
                    throw new Error('Invalid reservation response.');
                }

                if (active) {
                    setReservations(data as PendingReservation[]);
                }

                // --------------------------------------------------
                // 3. RÉCUPÉRER LES NOMS DES VÉHICULES
                // --------------------------------------------------

                // Si le catalogue échoue, le tableau des
                // réservations reste utilisable avec les UUID.

                try {
                    const catalogResponse = await fetch(
                        '/api/vehicles/catalog',
                        {
                            method: 'GET',
                            cache: 'no-store',
                        },
                    );

                    if (catalogResponse.ok) {
                        const catalogData: unknown =
                            await catalogResponse.json();

                        if (Array.isArray(catalogData) && active) {
                            setVehicles(catalogData as CatalogVehicle[]);
                        }
                    }
                } catch {
                    // Le catalogue est facultatif pour afficher
                    // les réservations en attente.
                }
            } catch (caughtError) {
                if (active) {
                    setError(
                        caughtError instanceof Error
                            ? caughtError.message
                            : 'Unable to load reservations.',
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadData();

        return () => {
            active = false;
        };
    }, [router]);

    // ========================================================
    // RETROUVER LE NOM D'UN VÉHICULE
    // ========================================================

    function getVehicleName(vehicleId: string): string {
        const vehicle = vehicles.find(
            (item) => item.id === vehicleId,
        );

        if (!vehicle) {
            return `Vehicle ${vehicleId.slice(0, 8)}`;
        }

        return `${vehicle.brandName} ${vehicle.modelName}`;
    }

    // ========================================================
    // PRENDRE UNE DÉCISION
    // ========================================================

    async function handleDecision(
        reservationNumber: string,
        action: 'confirm' | 'reject',
    ) {
        // Empêcher deux décisions simultanées.
        if (processingNumber !== null) {
            return;
        }

        setError('');
        setSuccess('');

        // ------------------------------------------------------
        // VÉRIFIER LE MOTIF DE REFUS
        // ------------------------------------------------------

        const reason = reasons[reservationNumber]?.trim() ?? '';

        if (action === 'reject') {
            if (reason.length < 5 || reason.length > 500) {
                setError(
                    'Please enter a rejection reason between 5 and 500 characters.',
                );
                return;
            }
        }

        // ------------------------------------------------------
        // DEMANDER UNE CONFIRMATION À L'ADMINISTRATEUR
        // ------------------------------------------------------

        const question =
            action === 'confirm'
                ? `Confirm reservation ${reservationNumber}?`
                : `Reject reservation ${reservationNumber}?`;

        if (!window.confirm(question)) {
            return;
        }

        setProcessingNumber(reservationNumber);

        try {
            // ----------------------------------------------------
            // ENVOYER LA DÉCISION À NEXT.JS
            // ----------------------------------------------------

            const response = await fetch(
                '/api/admin/reservations',
                {
                    method: 'PATCH',

                    headers: {
                        'Content-Type': 'application/json',
                    },

                    body: JSON.stringify({
                        reservationNumber,
                        action,

                        ...(action === 'reject'
                            ? { reason }
                            : {}),
                    }),
                },
            );

            // ----------------------------------------------------
            // GÉRER LES ERREURS DU BACKEND
            // ----------------------------------------------------

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            // ----------------------------------------------------
            // DÉCISION ACCEPTÉE PAR LE BACKEND
            // ----------------------------------------------------

            // La réservation n'est plus pending.
            // On peut donc la retirer du tableau.
            setReservations((previous) =>
                previous.filter(
                    (reservation) =>
                        reservation.reservationNumber !==
                        reservationNumber,
                ),
            );

            setSuccess(
                action === 'confirm'
                    ? `Reservation ${reservationNumber} confirmed successfully.`
                    : `Reservation ${reservationNumber} rejected successfully.`,
            );

            // ----------------------------------------------------
            // ACTUALISER DEPUIS POSTGRESQL
            // ----------------------------------------------------

            const refreshResponse = await fetch(
                '/api/admin/reservations',
                {
                    method: 'GET',
                    cache: 'no-store',
                },
            );

            if (refreshResponse.ok) {
                const freshData: unknown =
                    await refreshResponse.json();

                if (Array.isArray(freshData)) {
                    setReservations(
                        freshData as PendingReservation[],
                    );
                }
            }
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : 'Unable to process reservation.',
            );
        } finally {
            setProcessingNumber(null);
        }
    }

    // ========================================================
    // INTERFACE
    // ========================================================

    return (
        <main className={styles.page}>

            {/* ================================================= */}
            {/* NAVIGATION                                       */}
            {/* ================================================= */}

            <header className={styles.header}>
                <div className={styles.headerInner}>

                    <Link href="/admin" className={styles.brand}>
                        LUXURY ADMINISTRATION
                    </Link>

                    <nav className={styles.nav}>
                        <Link href="/">Home</Link>
                        <Link href="/admin">Dashboard</Link>
                        <Link href="/admin/reservations">
                            Reservations
                        </Link>
                    </nav>

                </div>
            </header>

            {/* ================================================= */}
            {/* CONTENU PRINCIPAL                                */}
            {/* ================================================= */}

            <section className={styles.container}>

                <Link href="/admin" className={styles.back}>
                    ← Back to dashboard
                </Link>

                <p className={styles.eyebrow}>
                    ADMINISTRATOR MANAGEMENT
                </p>

                <h1 className={styles.title}>
                    Reservation management.
                </h1>

                <p className={styles.intro}>
                    Review pending reservations, confirm eligible
                    requests or reject them with a reason.
                </p>

                {/* ================================================= */}
                {/* MESSAGES                                        */}
                {/* ================================================= */}

                {error && (
                    <div className={styles.error} role="alert">
                        {error}
                    </div>
                )}

                {success && (
                    <div className={styles.success} role="status">
                        {success}
                    </div>
                )}

                {/* ================================================= */}
                {/* CHARGEMENT                                      */}
                {/* ================================================= */}

                {loading && (
                    <div className={styles.empty}>
                        Loading pending reservations...
                    </div>
                )}

                {/* ================================================= */}
                {/* LISTE VIDE                                      */}
                {/* ================================================= */}

                {!loading &&
                    !error &&
                    reservations.length === 0 && (
                        <div className={styles.empty}>
                            <h2>No pending reservations</h2>

                            <p>
                                All reservation requests have been processed.
                            </p>
                        </div>
                    )}

                {/* ================================================= */}
                {/* LISTE DES RÉSERVATIONS                          */}
                {/* ================================================= */}

                {!loading && (
                    <>

                        <div className={styles.topRow}>
                            <h2>Pending requests</h2>

                            <span className={styles.count}>
                                {reservations.length} pending
                            </span>
                        </div>

                        <div className={styles.grid}>

                            {reservations.map((reservation) => (
                                <article
                                    key={reservation.id}
                                    className={styles.card}
                                >

                                    {/* ===================================== */}
                                    {/* EN-TÊTE                              */}
                                    {/* ===================================== */}

                                    <div className={styles.cardTop}>

                                        <div>
                                            <span className={styles.cardLabel}>
                                                RESERVATION NUMBER
                                            </span>

                                            <h3>
                                                {reservation.reservationNumber}
                                            </h3>
                                        </div>

                                        <span className={styles.pendingBadge}>
                                            Pending
                                        </span>

                                    </div>

                                    {/* ===================================== */}
                                    {/* VÉHICULE                             */}
                                    {/* ===================================== */}

                                    <div className={styles.vehicleSection}>
                                        <span className={styles.cardLabel}>
                                            SELECTED VEHICLE
                                        </span>

                                        <h4>
                                            {getVehicleName(reservation.vehicleId)}
                                        </h4>
                                    </div>

                                    {/* ===================================== */}
                                    {/* DÉTAILS DE LA RÉSERVATION            */}
                                    {/* ===================================== */}

                                    <div className={styles.details}>

                                        <div>
                                            <span>Pickup date</span>
                                            <strong>
                                                {formatDate(reservation.pickupAt)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Return date</span>
                                            <strong>
                                                {formatDate(reservation.returnAt)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Rental duration</span>
                                            <strong>
                                                {reservation.rentalDays} days
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Daily rate</span>
                                            <strong>
                                                {formatAmount(reservation.dailyPrice)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Total amount</span>
                                            <strong className={styles.totalAmount}>
                                                {formatAmount(reservation.totalAmount)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Security deposit</span>
                                            <strong>
                                                {formatAmount(reservation.depositAmount)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Customer reference</span>
                                            <strong>
                                                {reservation.customerId.slice(0, 8)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Created on</span>
                                            <strong>
                                                {formatDate(reservation.createdAt)}
                                            </strong>
                                        </div>

                                    </div>

                                    {/* ===================================== */}
                                    {/* NOTES CLIENT                         */}
                                    {/* ===================================== */}

                                    {reservation.customerNotes && (
                                        <div className={styles.notes}>
                                            <span className={styles.cardLabel}>
                                                CUSTOMER NOTES
                                            </span>

                                            <p>{reservation.customerNotes}</p>
                                        </div>
                                    )}

                                    {/* ===================================== */}
                                    {/* MOTIF DE REFUS                       */}
                                    {/* ===================================== */}

                                    <div className={styles.decisionSection}>

                                        <label
                                            htmlFor={`reason-${reservation.id}`}
                                            className={styles.reasonLabel}
                                        >
                                            Rejection reason
                                        </label>

                                        <textarea
                                            id={`reason-${reservation.id}`}
                                            className={styles.reasonInput}
                                            rows={3}
                                            minLength={5}
                                            maxLength={500}
                                            placeholder="Reason for rejecting this reservation..."
                                            value={
                                                reasons[reservation.reservationNumber] ??
                                                ''
                                            }
                                            onChange={(event) =>
                                                setReasons((previous) => ({
                                                    ...previous,
                                                    [reservation.reservationNumber]:
                                                        event.target.value,
                                                }))
                                            }
                                        />

                                        <p className={styles.hint}>
                                            Required only when rejecting (5–500 characters).
                                        </p>

                                        {/* =================================== */}
                                        {/* ACTIONS ADMIN                       */}
                                        {/* =================================== */}

                                        <div className={styles.actions}>

                                            <button
                                                type="button"
                                                className={styles.confirmButton}
                                                disabled={processingNumber !== null}
                                                onClick={() =>
                                                    handleDecision(
                                                        reservation.reservationNumber,
                                                        'confirm',
                                                    )
                                                }
                                            >
                                                {processingNumber ===
                                                    reservation.reservationNumber
                                                    ? 'Processing...'
                                                    : 'Confirm reservation'}
                                            </button>

                                            <button
                                                type="button"
                                                className={styles.rejectButton}
                                                disabled={processingNumber !== null}
                                                onClick={() =>
                                                    handleDecision(
                                                        reservation.reservationNumber,
                                                        'reject',
                                                    )
                                                }
                                            >
                                                Reject
                                            </button>

                                        </div>

                                    </div>

                                </article>
                            ))}

                        </div>

                    </>
                )}

            </section>

        </main>
    );
}
