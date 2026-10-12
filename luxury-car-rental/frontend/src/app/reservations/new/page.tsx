'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './reservation.module.css';

// ==========================================================
// TYPES BASÉS SUR LES RÉPONSES DE NESTJS
// ==========================================================

interface AvailableVehicle {
  id: string;
  brandName: string;
  modelName: string;
  categoryName: string;
  manufactureYear: number;
  dailyPrice: string;
  securityDeposit: string;
  description: string | null;
}

interface Selection {
  brandName: string;
  modelName: string;
  vehicleId: string;
  pickupDate: string;
  returnDate: string;
}

interface CreatedReservation {
  reservationNumber: string;
  status: string;
  rentalDays: number;
  dailyPrice: string;
  totalAmount: string;
  depositAmount: string;
}

interface ApiError {
  message?: string | string[];
}

// ==========================================================
// OUTILS
// ==========================================================

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function amount(value: string | number): string {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(number)
    : String(value);
}

async function apiError(response: Response): Promise<string> {
  try {
    const body: ApiError = await response.json();
    if (Array.isArray(body.message)) return body.message.join(' ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    // Retourner un message générique en cas de réponse non JSON.
  }
  return `Request failed (HTTP ${response.status}).`;
}

function isAvailableVehicle(value: unknown): value is AvailableVehicle {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<AvailableVehicle>;
  return typeof item.id === 'string' &&
    typeof item.brandName === 'string' &&
    typeof item.modelName === 'string' &&
    typeof item.dailyPrice === 'string' &&
    typeof item.securityDeposit === 'string';
}

function isCreatedReservation(value: unknown): value is CreatedReservation {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<CreatedReservation>;
  return typeof item.reservationNumber === 'string' &&
    typeof item.status === 'string' &&
    typeof item.totalAmount === 'string';
}

// ==========================================================
// PAGE : /reservations/new
// ==========================================================

export default function NewReservationPage() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [vehicle, setVehicle] = useState<AvailableVehicle | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<CreatedReservation | null>(null);

  // Bloquer deux clics rapides sur « Confirm reservation ».
  const submitLock = useRef(false);

  // ========================================================
  // CONTRÔLER LES PARAMÈTRES DE L'URL ET LA DISPONIBILITÉ
  // ========================================================

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const current: Selection = {
          brandName: params.get('brandName') ?? '',
          modelName: params.get('modelName') ?? '',
          vehicleId: params.get('vehicleId') ?? '',
          pickupDate: params.get('pickupDate') ?? '',
          returnDate: params.get('returnDate') ?? '',
        };

        if (
          !current.brandName || !current.modelName || !current.vehicleId ||
          !validDate(current.pickupDate) ||
          !validDate(current.returnDate) ||
          current.returnDate <= current.pickupDate
        ) {
          throw new Error(
            'Invalid selection. Please choose a vehicle from Availability.',
          );
        }

        const query = new URLSearchParams({
          from: current.pickupDate,
          to: current.returnDate,
        });

        // Requête de contrôle : le backend revalidera encore au POST.
        const response = await fetch(
          `/api/vehicles/available?${query.toString()}`,
          { method: 'GET', cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error(await apiError(response));

        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isAvailableVehicle)) {
          throw new Error('Invalid availability response.');
        }

        // Contrôler l'UUID, la marque et le modèle sélectionnés.
        const matching = data.find((item) =>
          item.id === current.vehicleId &&
          item.brandName === current.brandName &&
          item.modelName === current.modelName,
        );
        if (!matching) {
          throw new Error(
            'This vehicle is no longer available for the chosen dates.',
          );
        }

        if (!controller.signal.aborted) {
          setSelection(current);
          setVehicle(matching);
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error ? caught.message : 'Unable to load reservation.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  // ========================================================
  // CALCUL INDICATIF : LE BACKEND FIXE LE TARIF RÉEL
  // ========================================================

  const rentalDays = selection
    ? Math.round(
        (Date.parse(`${selection.returnDate}T00:00:00Z`) -
          Date.parse(`${selection.pickupDate}T00:00:00Z`)) / 86400000,
      )
    : 0;
  const estimatedTotal = vehicle
    ? rentalDays * Number(vehicle.dailyPrice)
    : 0;

  // ========================================================
  // ENVOYER LA DEMANDE : POST /api/reservations
  // ========================================================

  async function confirmReservation() {
    if (!selection || !vehicle || submitLock.current || reservation) return;

    submitLock.current = true;
    setSubmitting(true);
    setError('');

    try {
      // L'UUID n'est pas envoyé : le DTO NestJS sélectionne
      // automatiquement une voiture disponible de ce modèle.
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: selection.brandName,
          modelName: selection.modelName,
          pickupDate: selection.pickupDate,
          returnDate: selection.returnDate,
          ...(customerNotes.trim()
            ? { customerNotes: customerNotes.trim() }
            : {}),
        }),
      });

      if (!response.ok) throw new Error(await apiError(response));
      const data: unknown = await response.json();
      if (!isCreatedReservation(data)) {
        throw new Error(
          'Unexpected response. Check My reservations before trying again.',
        );
      }
      setReservation(data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Reservation could not be created.',
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  // ========================================================
  // INTERFACE
  // ========================================================

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <Link href="/availability" className={styles.back}>
          ← Back to availability
        </Link>
        <p className={styles.eyebrow}>RESERVATION REQUEST</p>
        <h1 className={styles.title}>Confirm your experience.</h1>
        <p className={styles.intro}>
          Review your vehicle, rental dates and estimated pricing.
        </p>

        {loading && <p className={styles.notice}>Checking availability...</p>}
        {error && <div className={styles.error} role="alert">{error}</div>}

        {/* Afficher uniquement la confirmation si le POST a réussi. */}
        {reservation && (
          <article className={styles.success} role="status">
            <p className={styles.eyebrow}>RESERVATION CREATED</p>
            <h2>Request received.</h2>
            <p>We have received your reservation request.</p>
            <dl className={styles.details}>
              <div><dt>Reservation number</dt><dd>{reservation.reservationNumber}</dd></div>
              <div><dt>Status</dt><dd>{reservation.status}</dd></div>
              <div><dt>Rental duration</dt><dd>{reservation.rentalDays} days</dd></div>
              <div><dt>Daily rate</dt><dd>{amount(reservation.dailyPrice)}</dd></div>
              <div><dt>Rental total</dt><dd>{amount(reservation.totalAmount)}</dd></div>
              <div><dt>Security deposit</dt><dd>{amount(reservation.depositAmount)}</dd></div>
            </dl>
            <p className={styles.muted}>The reservation is not approved until confirmed by an administrator.</p>
            <Link href="/account/reservations" className={styles.primaryLink}>
              View my reservations →
            </Link>
          </article>
        )}

        {/* Demande de réservation prête à être confirmée. */}
        {!loading && !reservation && selection && vehicle && (
          <div className={styles.grid}>
            <article className={styles.card}>
              <p className={styles.eyebrow}>SELECTED VEHICLE</p>
              <h2>{vehicle.brandName} {vehicle.modelName}</h2>
              <p className={styles.muted}>{vehicle.description || vehicle.categoryName}</p>
              <dl className={styles.details}>
                <div><dt>Category</dt><dd>{vehicle.categoryName}</dd></div>
                <div><dt>Year</dt><dd>{vehicle.manufactureYear}</dd></div>
                <div><dt>Pickup</dt><dd>{selection.pickupDate}</dd></div>
                <div><dt>Return</dt><dd>{selection.returnDate}</dd></div>
                <div><dt>Duration</dt><dd>{rentalDays} days</dd></div>
              </dl>
            </article>

            <article className={styles.card}>
              <p className={styles.eyebrow}>RESERVATION SUMMARY</p>
              <h2>Review your request</h2>
              <dl className={styles.details}>
                <div><dt>Daily rate</dt><dd>{amount(vehicle.dailyPrice)}</dd></div>
                <div><dt>Estimated rental total</dt><dd>{amount(estimatedTotal)}</dd></div>
                <div><dt>Security deposit</dt><dd>{amount(vehicle.securityDeposit)}</dd></div>
              </dl>
              <p className={styles.muted}>
                Estimates only. Final amounts and vehicle assignment are set by NestJS.
              </p>
              <label className={styles.label} htmlFor="customerNotes">
                Additional requests (optional)
              </label>
              <textarea
                id="customerNotes"
                className={styles.textarea}
                value={customerNotes}
                maxLength={1000}
                rows={4}
                placeholder="Special pickup instructions..."
                onChange={(event) => setCustomerNotes(event.target.value)}
              />
              <button
                type="button"
                className={styles.button}
                onClick={confirmReservation}
                disabled={submitting}
              >
                {submitting ? 'Creating reservation...' : 'Confirm reservation'}
              </button>
              <p className={styles.muted}>
                Press once. If a network error occurs, check My reservations before retrying.
              </p>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}
