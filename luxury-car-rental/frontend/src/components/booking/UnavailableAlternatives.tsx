'use client';

import Link from 'next/link';

import { Price } from '@/components/currency-provider';
import type { AlternativesResponse } from '@/lib/booking';
import styles from './booking.module.css';

// ==========================================================
// VÉHICULE INDISPONIBLE — ALTERNATIVES RÉELLES
// ==========================================================
//
// Aucune donnée n'est inventée : la prochaine période libre et
// les véhicules proposés proviennent de NestJS/PostgreSQL, qui
// revalide chaque intervalle. Le véhicule choisi n'est jamais
// remplacé automatiquement : le client reste maître du choix.

function formatInstant(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    timeZone: timezone || undefined,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UnavailableAlternatives({
  data,
  loading,
  error,
  timezone,
  onUseInterval,
}: {
  data: AlternativesResponse | null;
  loading: boolean;
  error: string;
  timezone: string;
  onUseInterval: (pickupAt: string, returnAt: string) => void;
}) {
  if (loading) {
    return (
      <p className={styles.loading} role="status" style={{ marginTop: '.85rem' }}>
        Looking for the next available period…
      </p>
    );
  }

  if (error) {
    return (
      <p className={styles.error} role="alert" style={{ marginTop: '.85rem' }}>
        {error}
      </p>
    );
  }

  if (!data || data.available) return null;

  const { nextAvailable, alternatives } = data;

  return (
    <div className={styles.altPanel} role="region" aria-label="Availability alternatives">
      <h3 className={styles.altTitle}>This vehicle is unavailable for your selected dates</h3>
      {data.message && <p className={styles.altMessage}>{data.message}</p>}

      {nextAvailable && (
        <>
          <p className={styles.altSubhead}>Next available period for this vehicle</p>
          <div className={styles.altInterval}>
            <span className={styles.altIntervalDates}>
              <strong>{formatInstant(nextAvailable.pickupAt, timezone)}</strong>
              <span>→ {formatInstant(nextAvailable.returnAt, timezone)}</span>
            </span>
            <button
              type="button"
              className={styles.altIntervalButton}
              onClick={() => onUseInterval(nextAvailable.pickupAt, nextAvailable.returnAt)}
            >
              Use these dates
            </button>
          </div>
        </>
      )}

      {alternatives.length > 0 && (
        <>
          <p className={styles.altSubhead}>Similar vehicles available for your dates</p>
          <div className={styles.altVehicleList}>
            {alternatives.map((vehicle) => {
              const label = [vehicle.brandName, vehicle.modelName].filter(Boolean).join(' ') || 'Vehicle';
              return (
                <Link
                  key={vehicle.vehicleId}
                  href={`/vehicles/${vehicle.vehicleId}/reserve`}
                  className={styles.altVehicleCard}
                >
                  <span className={styles.altVehicleMedia}>
                    {vehicle.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vehicle.imageUrl}
                        alt={label}
                        className={styles.altVehicleImage}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.altVehiclePlaceholder}>{label}</span>
                    )}
                  </span>
                  <span className={styles.altVehicleName}>{label}</span>
                  {vehicle.dailyPrice != null && (
                    <span className={styles.altVehicleMeta}>
                      <Price value={vehicle.dailyPrice} /> / day
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
