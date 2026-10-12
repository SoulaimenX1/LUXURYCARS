'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './reservations.module.css';

import { formatAmount } from '@/lib/format';

// ==========================================================
// TYPE DE RÉSERVATION RETOURNÉ PAR NESTJS
// ==========================================================

interface Reservation {
  id: string;
  reservationNumber: string;
  vehicleId: string;
  pickupAt: string;
  returnAt: string;
  rentalDays: number;
  dailyPrice: string;
  depositAmount: string;
  totalAmount: string;
  status: string;
  createdAt: string;
}

interface CatalogVehicle {
  id: string;
  brandName: string;
  modelName: string;
}

interface ApiError { message?: string | string[]; }

// ==========================================================
// OUTILS D'AFFICHAGE
// ==========================================================

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
}

async function readError(response: Response): Promise<string> {
  try {
    const error: ApiError = await response.json();
    if (Array.isArray(error.message)) return error.message.join(' ');
    if (typeof error.message === 'string') return error.message;
  } catch {
    // Réponse non JSON : garder l'erreur générique.
  }
  return `Request failed (HTTP ${response.status}).`;
}

function isReservation(value: unknown): value is Reservation {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<Reservation>;
  return typeof item.reservationNumber === 'string' &&
    typeof item.vehicleId === 'string' &&
    typeof item.pickupAt === 'string' &&
    typeof item.returnAt === 'string' &&
    typeof item.status === 'string' &&
    typeof item.totalAmount === 'string';
}

// ==========================================================
// PAGE /account/reservations
// ==========================================================

export default function MyReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicleNames, setVehicleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyNumber, setBusyNumber] = useState<string | null>(null);

  // Heure courante conservée dans un state.
  // Cela évite d'appeler Date.now() directement pendant le rendu.
  const [currentTime, setCurrentTime] =
    useState<number | null>(null);

  // ========================================================
  // CHARGER UNIQUEMENT LES RÉSERVATIONS DU CLIENT CONNECTÉ
  // ========================================================

  const loadReservations = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');

    try {
      // GET /api/reservations transmet à NestJS GET /reservations/me.
      const response = await fetch('/api/reservations', {
        method: 'GET', cache: 'no-store', signal,
      });

      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok) throw new Error(await readError(response));

      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(isReservation)) {
        throw new Error('Invalid reservations response.');
      }

      // Afficher les réservations les plus récentes en premier.
      const sorted = [...data].sort((a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      if (!signal?.aborted) setReservations(sorted);

      // Enrichissement purement visuel : nom du véhicule si présent
      // dans le catalogue public. Son absence ne bloque pas la page.
      try {
        const catalogResponse = await fetch('/api/vehicles/catalog', {
          method: 'GET', cache: 'no-store', signal,
        });
        if (catalogResponse.ok) {
          const catalog: unknown = await catalogResponse.json();
          if (Array.isArray(catalog)) {
            const names: Record<string, string> = {};
            for (const item of catalog) {
              const vehicle = item as Partial<CatalogVehicle>;
              if (
                typeof vehicle.id === 'string' &&
                typeof vehicle.brandName === 'string' &&
                typeof vehicle.modelName === 'string'
              ) {
                names[vehicle.id] = `${vehicle.brandName} ${vehicle.modelName}`;
              }
            }
            if (!signal?.aborted) setVehicleNames(names);
          }
        }
      } catch {
        // Le catalogue n'est pas obligatoire pour voir l'historique.
      }
    } catch (caught) {
      if (!signal?.aborted) {
        setError(
          caught instanceof Error ? caught.message : 'Unable to load reservations.',
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();

    // React 19 déconseille un setState déclenché
    // synchroniquement depuis le corps de l'effet.
    // On démarre donc le chargement dans une tâche asynchrone.
    const timerId = window.setTimeout(() => {
      setCurrentTime(Date.now());

      void loadReservations(
        controller.signal,
      );
    }, 0);

    // Mettre à jour l'heure une fois par minute
    // afin que le bouton Cancel reste cohérent.
    const intervalId = window.setInterval(
      () => {
        setCurrentTime(Date.now());
      },
      60_000,
    );

    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [loadReservations]);

  // ========================================================
  // ANNULER UNE RÉSERVATION PENDING
  // ========================================================

  async function handleCancel(reservation: Reservation) {
    if (busyNumber) return;
    if (
      reservation.status !== 'pending' ||
      currentTime === null ||
      Date.parse(reservation.pickupAt) <=
        currentTime
    ) {
      return;
    }

    // Confirmation explicite avant modification en base.
    const confirmed = window.confirm(
      `Cancel reservation ${reservation.reservationNumber}?`,
    );
    if (!confirmed) return;

    setError('');
    setSuccess('');
    setBusyNumber(reservation.reservationNumber);

    try {
      const response = await fetch(
        `/api/reservations/by-number/${encodeURIComponent(reservation.reservationNumber)}/cancel`,
        { method: 'PATCH' },
      );

      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok) throw new Error(await readError(response));

      // Recharger la liste réelle depuis NestJS après l'annulation.
      await loadReservations();
      setSuccess(`Reservation ${reservation.reservationNumber} cancelled.`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to cancel reservation.',
      );
    } finally {
      setBusyNumber(null);
    }
  }

  // ========================================================
  // INTERFACE
  // ========================================================

  const statusOrder = [
    'pending',
    'confirmed',
    'converted',
    'cancelled',
    'rejected',
    'expired',
  ];

  const statusCounts = reservations.reduce<
    Record<string, number>
  >((accumulator, reservation) => {
    accumulator[reservation.status] =
      (accumulator[reservation.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <Link href="/account" className={styles.back}>← Back to account</Link>
        <p className={styles.eyebrow}>CUSTOMER AREA</p>
        <h1>My reservations</h1>
        <p className={styles.intro}>
          Track your luxury car bookings and manage eligible pending requests.
        </p>

        {!loading && reservations.length > 0 && (
          <div className={styles.summary}>
            {statusOrder.map((status) => (
              <div
                key={status}
                className={styles.summaryItem}
              >
                <strong>
                  {statusCounts[status] ?? 0}
                </strong>
                <span>{status}</span>
              </div>
            ))}
          </div>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}
        {success && <div className={styles.success} role="status">{success}</div>}

        {loading ? (
          <div className={styles.notice}>Loading your reservations...</div>
        ) : reservations.length === 0 && !error ? (
          <div className={styles.empty}>
            <h2>No reservations yet</h2>
            <p>Your bookings will appear here after you make a reservation.</p>
            <Link href="/availability" className={styles.primaryLink}>
              Check availability →
            </Link>
          </div>
        ) : (
          <div className={styles.list}>
            {reservations.map((reservation) => {
              const canCancel =
                currentTime !== null &&
                reservation.status === 'pending' &&
                Date.parse(reservation.pickupAt) >
                  currentTime;
              const statusClass = reservation.status === 'pending'
                ? styles.pending
                : reservation.status === 'confirmed'
                  ? styles.confirmed
                  : styles.otherStatus;

              return (
                <article className={styles.card} key={reservation.reservationNumber}>
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.cardLabel}>RESERVATION NUMBER</p>
                      <h2>{reservation.reservationNumber}</h2>
                    </div>
                    <span className={`${styles.status} ${statusClass}`}>
                      {reservation.status}
                    </span>
                  </div>

                  <div className={styles.dataGrid}>
                    <div>
                      <span>Vehicle</span>
                      <strong>{vehicleNames[reservation.vehicleId] || 'Luxury vehicle'}</strong>
                      <small>ID: {reservation.vehicleId}</small>
                    </div>
                    <div><span>Pickup</span><strong>{formatDate(reservation.pickupAt)}</strong></div>
                    <div><span>Return</span><strong>{formatDate(reservation.returnAt)}</strong></div>
                    <div><span>Rental days</span><strong>{reservation.rentalDays}</strong></div>
                    <div><span>Daily rate</span><strong>{formatAmount(reservation.dailyPrice)}</strong></div>
                    <div><span>Rental total</span><strong>{formatAmount(reservation.totalAmount)}</strong></div>
                    <div><span>Security deposit</span><strong>{formatAmount(reservation.depositAmount)}</strong></div>
                  </div>

                  {canCancel && (
                    <button
                      type="button"
                      className={styles.cancelButton}
                      disabled={busyNumber !== null}
                      onClick={() => void handleCancel(reservation)}
                    >
                      {busyNumber === reservation.reservationNumber
                        ? 'Cancelling...'
                        : 'Cancel reservation'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
