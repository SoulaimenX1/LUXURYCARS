'use client';

import Link from 'next/link';

import {
  useEffect,
  useState,
} from 'react';

import type {
  VehicleItem,
} from '@/lib/catalog-types';

import {
  formatAmount,
} from '@/lib/format';

import styles from './highlights.module.css';

// ==========================================================
// VITRINE DE L'ACCUEIL
// ==========================================================
//
// Présente deux sélections sur la page d'accueil :
//
//  1. Les voitures les plus louées (classées par nombre de
//     réservations honorées ; à défaut, les modèles les plus
//     prestigieux du moment).
//  2. Les éditions limitées actuellement disponibles.
//
// Les données proviennent du catalogue public, avec sa photo
// réelle pour chaque véhicule.
// ==========================================================

function isVehicle(value: unknown): value is VehicleItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'brandName' in value &&
    typeof value.brandName === 'string' &&
    'modelName' in value &&
    typeof value.modelName === 'string' &&
    'dailyPrice' in value
  );
}

function ShowcaseCard({
  vehicle,
}: {
  vehicle: VehicleItem;
}) {
  return (
    <Link
      href="/vehicles"
      className={styles.card}
    >
      <div className={styles.media}>
        {vehicle.imageUrl ? (
          <img
            className={styles.image}
            src={vehicle.imageUrl}
            alt={`${vehicle.brandName} ${vehicle.modelName}`}
            loading="lazy"
          />
        ) : (
          <div className={styles.imageFallback} />
        )}

        {vehicle.isLimited && (
          <span className={styles.badge}>
            Limited
            {vehicle.editionSize
              ? ` · ${vehicle.editionSize} units`
              : ''}
          </span>
        )}

        {!vehicle.isLimited && vehicle.isSpecial && (
          <span className={styles.badge}>
            Special edition
          </span>
        )}
      </div>

      <div className={styles.body}>
        <span className={styles.brand}>
          {vehicle.brandName}
        </span>

        <h3>{vehicle.modelName}</h3>

        <div className={styles.meta}>
          <span className={styles.price}>
            {formatAmount(vehicle.dailyPrice)}
            <small> / day</small>
          </span>

          <span className={styles.arrow}>↗</span>
        </div>
      </div>
    </Link>
  );
}

export default function HomeHighlights() {
  const [vehicles, setVehicles] = useState<
    VehicleItem[]
  >([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(
          '/api/vehicles/catalog',
        );

        if (!response.ok) {
          return;
        }

        const data: unknown = await response.json();

        if (!active || !Array.isArray(data)) {
          return;
        }

        setVehicles(data.filter(isVehicle));
      } catch {
        // Vitrine silencieuse : en cas d'erreur, rien
        // n'est affiché.
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (vehicles.length === 0) {
    return null;
  }

  // Classement par popularité réelle (réservations
  // honorées). À défaut de réservation, on met en avant
  // les modèles les plus prestigieux.
  const byBookings = [...vehicles].sort(
    (a, b) =>
      (b.reservationCount ?? 0) -
      (a.reservationCount ?? 0),
  );

  const hasBookings =
    (byBookings[0]?.reservationCount ?? 0) > 0;

  // À défaut de réservation, on évite de répéter les
  // éditions limitées (déjà mises en avant plus bas).
  const fallbackPool = vehicles.filter(
    (vehicle) => !vehicle.isLimited,
  );

  const mostRented = (
    hasBookings
      ? byBookings
      : [...fallbackPool].sort(
          (a, b) =>
            Number(b.dailyPrice) -
            Number(a.dailyPrice),
        )
  ).slice(0, 3);

  const limited = vehicles
    .filter((vehicle) => vehicle.isLimited)
    .slice(0, 3);

  return (
    <section className={styles.highlights}>
      <div className={styles.container}>
        <div className={styles.showcase}>
          <header className={styles.head}>
            <p className={styles.label}>
              MOST REQUESTED
            </p>

            <h2>
              The most rented
              <em> cars.</em>
            </h2>

            <p className={styles.lead}>
              {hasBookings
                ? 'Ranked by confirmed bookings across our fleet.'
                : 'A selection of the most prestigious models in our collection.'}
            </p>
          </header>

          <div className={styles.grid}>
            {mostRented.map((vehicle) => (
              <ShowcaseCard
                key={vehicle.id}
                vehicle={vehicle}
              />
            ))}
          </div>
        </div>

        {limited.length > 0 && (
          <div className={styles.showcase}>
            <header className={styles.head}>
              <p className={styles.label}>
                LIMITED EDITIONS
              </p>

              <h2>
                Available now,
                <em> in limited numbers.</em>
              </h2>

              <p className={styles.lead}>
                Rare editions available for a short
                period only.
              </p>
            </header>

            <div className={styles.grid}>
              {limited.map((vehicle) => (
                <ShowcaseCard
                  key={vehicle.id}
                  vehicle={vehicle}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
