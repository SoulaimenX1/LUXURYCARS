'use client';

import type { BookingLocation } from '@/lib/booking';
import styles from './booking.module.css';

// ==========================================================
// SÉLECTION DU LIEU DE PRISE EN CHARGE
// ==========================================================
//
// Uniquement les points de service RÉELS et activés qui prennent
// en charge ce véhicule. La sélection est conservée dans le
// parcours et déclenche le rechargement du calendrier.

export default function PickupLocationSelector({
  locations,
  selectedId,
  loading,
  error,
  onSelect,
}: {
  locations: BookingLocation[];
  selectedId: string;
  loading: boolean;
  error: string;
  onSelect: (locationId: string) => void;
}) {
  if (loading) {
    return <p className={styles.loading}>Loading pickup locations…</p>;
  }

  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  if (!locations.length) {
    return (
      <p className={styles.notice}>
        No pickup location currently serves this vehicle. Please contact us.
      </p>
    );
  }

  return (
    <div className={styles.locationList} role="radiogroup" aria-label="Pickup location">
      {locations.map((location) => {
        const selected = location.id === selectedId;
        return (
          <button
            key={location.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.locationCard} ${selected ? styles.locationCardActive : ''}`}
            onClick={() => onSelect(location.id)}
          >
            <span className={styles.locationCategory}>{location.category.replace('_', ' ')}</span>
            <span className={styles.locationName}>{location.name}</span>
            <span className={styles.locationMeta}>{location.address}</span>
            <span className={styles.locationMeta}>
              {location.city}, {location.country} · {location.opensAt}–{location.closesAt} ({location.timezone})
            </span>
          </button>
        );
      })}
    </div>
  );
}
