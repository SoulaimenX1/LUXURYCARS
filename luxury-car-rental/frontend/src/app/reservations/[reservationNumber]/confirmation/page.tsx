'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Price } from '@/components/currency-provider';
import type { VehicleItem } from '@/lib/catalog-types';
import bookingStyles from '@/components/booking/booking.module.css';
import styles from './confirmation.module.css';

// ==========================================================
// CONFIRMATION DE RÉSERVATION
// ==========================================================
//
// La page ne s'appuie que sur la réservation réellement
// enregistrée en PostgreSQL (GET /reservations/me). Elle ne
// fabrique aucun statut ni aucun montant.

interface ReservationRow {
  reservationNumber: string;
  status: string;
  vehicleId: string;
  pickupAt: string;
  returnAt: string;
  rentalDays: number;
  dailyPrice: string;
  depositAmount: string;
  totalAmount: string;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
}

function formatInstant(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'short',
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(date);
  }
}

export default function ConfirmationPage() {
  const params = useParams<{ reservationNumber: string }>();
  const number = decodeURIComponent(params.reservationNumber ?? '').toUpperCase();

  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'auth' | 'error'>(
    'loading' as const,
  );
  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [vehicle, setVehicle] = useState<VehicleItem | null>(null);
  const [timezone, setTimezone] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const listResponse = await fetch('/api/reservations', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (listResponse.status === 401) {
          setState('auth');
          return;
        }
        if (!listResponse.ok) {
          throw new Error('Unable to load your reservations.');
        }

        const list: unknown = await listResponse.json();
        const rows = Array.isArray(list) ? (list as ReservationRow[]) : [];
        const found =
          rows.find(
            (row) =>
              typeof row.reservationNumber === 'string' &&
              row.reservationNumber.toUpperCase() === number,
          ) ?? null;

        if (!found) {
          setState('missing');
          return;
        }
        setReservation(found);

        // Résoudre la marque / le modèle réels du véhicule réservé.
        try {
          const catalogResponse = await fetch('/api/vehicles/catalog', {
            cache: 'no-store',
            signal: controller.signal,
          });
          if (catalogResponse.ok) {
            const catalog: unknown = await catalogResponse.json();
            const list2 = Array.isArray(catalog) ? (catalog as VehicleItem[]) : [];
            setVehicle(list2.find((item) => item.id === found.vehicleId) ?? null);
          }
        } catch {
          // Le nom du véhicule reste facultatif à l'affichage.
        }

        // Fuseau horaire du point de service, pour un affichage cohérent.
        try {
          const locationResponse = await fetch(`/api/vehicles/${found.vehicleId}/locations`, {
            cache: 'no-store',
            signal: controller.signal,
          });
          if (locationResponse.ok) {
            const locations: unknown = await locationResponse.json();
            const match = Array.isArray(locations)
              ? (locations as { name?: string; timezone?: string }[]).find(
                  (item) => item.name === found.pickupLocation,
                )
              : null;
            if (match?.timezone) setTimezone(match.timezone);
          }
        } catch {
          // L'affichage retombe sur le fuseau local du navigateur.
        }

        setState('ok');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [number]);

  if (state === 'loading') {
    return (
      <main className={styles.page}>
        <p className={bookingStyles.loading}>Loading your reservation…</p>
      </main>
    );
  }

  if (state === 'auth') {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Sign in required</h1>
          <p className={styles.lead}>Please sign in to view this reservation.</p>
          <div className={styles.actions}>
            <Link href="/login" className={styles.primary}>
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (state !== 'ok' || !reservation) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Reservation not found</h1>
          <p className={styles.lead}>
            We could not find this reservation in your account. It may belong to another account or the
            reference may be incorrect.
          </p>
          <div className={styles.actions}>
            <Link href="/account/reservations" className={styles.primary}>
              My reservations
            </Link>
            <Link href="/vehicles" className={styles.secondary}>
              Browse the collection
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const vehicleLabel = vehicle
    ? `${vehicle.brandName} ${vehicle.modelName}`
    : 'Selected vehicle';

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.badge}>Reservation received</span>
        <h1 className={styles.title}>Thank you, your vehicle is reserved</h1>
        <p className={styles.lead}>
          Your request has been recorded in our system. Our team will confirm the details; the rental is
          paid according to our standard pay-on-arrival policy. No online payment was taken.
        </p>

        <div className={styles.reference}>
          <span>Reservation number</span>
          <strong>{reservation.reservationNumber}</strong>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>Status</dt>
            <dd>{reservation.status}</dd>
          </div>
          <div>
            <dt>Vehicle</dt>
            <dd>{vehicleLabel}</dd>
          </div>
          <div>
            <dt>Pickup</dt>
            <dd>{formatInstant(reservation.pickupAt, timezone)}</dd>
          </div>
          <div>
            <dt>Return</dt>
            <dd>{formatInstant(reservation.returnAt, timezone)}</dd>
          </div>
          <div>
            <dt>Pickup location</dt>
            <dd>{reservation.pickupLocation ?? '—'}</dd>
          </div>
          <div>
            <dt>Return location</dt>
            <dd>{reservation.dropoffLocation ?? '—'}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              {reservation.rentalDays} {reservation.rentalDays === 1 ? 'day' : 'days'}
            </dd>
          </div>
          <div>
            <dt>Daily rate</dt>
            <dd>
              <Price value={reservation.dailyPrice} />
            </dd>
          </div>
          <div>
            <dt>Rental total</dt>
            <dd>
              <Price value={reservation.totalAmount} />
            </dd>
          </div>
          <div>
            <dt>Security deposit</dt>
            <dd>
              <Price value={reservation.depositAmount} />
            </dd>
          </div>
        </dl>

        <div className={styles.actions}>
          <Link href="/account/reservations" className={styles.primary}>
            View my reservations
          </Link>
          <Link href="/vehicles" className={styles.secondary}>
            Browse the collection
          </Link>
        </div>
      </div>
    </main>
  );
}
