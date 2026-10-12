'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { VehicleItem } from '@/lib/catalog-types';
import { formatAmount, formatLabel } from '@/lib/format';

import LuxeVideo from '@/components/luxe-video';
import {
  applyLuxeTilt,
  resetLuxeTilt,
  vehicleVideoAt,
} from '@/lib/luxury-videos';

import styles from './vehicle-card.module.css';

// ==========================================================
// CARTE VÉHICULE PARTAGÉE
// Utilisée par /vehicles et /availability.
// Conserve les animations, vidéos, badges et réservations.
// ==========================================================

interface VehicleCardProps {
  vehicle: VehicleItem;
  index: number;
  availableLabel?: string;
  cta: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

// Remplace les underscores par des espaces si le formatage
// existant conserve les valeurs stockées en base (ex. plug_in_hybrid).
function formatVehicleSpec(value: string): string {
  return formatLabel(value).replace(/_/g, ' ');
}

export default function VehicleCard({
  vehicle,
  index,
  availableLabel,
  cta,
}: VehicleCardProps) {
  const video = vehicleVideoAt(index);
  const [imageFailed, setImageFailed] = useState(false);

  // Priorité : vidéo du véhicule, photo réelle, vidéo générique.
  const hasVideo = Boolean(vehicle.videoUrl);
  const hasImage = Boolean(vehicle.imageUrl) && !imageFailed;

  return (
    <article
      className={styles.vehicleCard}
      onMouseMove={(event) =>
        applyLuxeTilt(
          event.currentTarget,
          event.clientX,
          event.clientY,
        )
      }
      onMouseLeave={(event) => resetLuxeTilt(event.currentTarget)}
    >
      {/* ================================================ */}
      {/* VISUEL CINÉMATIQUE                              */}
      {/* ================================================ */}
      <div className={styles.vehicleVisual}>
        {hasVideo ? (
          <LuxeVideo
            className={styles.vehicleVideo}
            src={vehicle.videoUrl ?? ''}
            poster={vehicle.imageUrl ?? video.poster}
          />
        ) : hasImage ? (
          <img
            className={styles.vehicleImage}
            src={vehicle.imageUrl ?? ''}
            alt={`${vehicle.brandName} ${vehicle.modelName}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <LuxeVideo
            className={styles.vehicleVideo}
            src={video.src}
            poster={video.poster}
          />
        )}

        <div className={styles.visualScrim} />
        <div className={styles.visualShine} />

        <div className={styles.visualTop}>
          <span className={styles.categoryBadge}>
            {vehicle.categoryName}
          </span>
          <span className={styles.yearBadge}>
            {vehicle.manufactureYear}
          </span>
        </div>

        {(vehicle.isLimited || vehicle.isSpecial) && (
          <div className={styles.editionFlag}>
            <span
              className={
                vehicle.isLimited
                  ? styles.flagLimited
                  : styles.flagSpecial
              }
            >
              {vehicle.isLimited
                ? vehicle.editionSize
                  ? `Limited · ${vehicle.editionSize} units`
                  : 'Limited edition'
                : 'Special edition'}
            </span>
          </div>
        )}

        {availableLabel && (
          <div className={styles.availableLabel}>
            {availableLabel}
          </div>
        )}
      </div>

      {/* ================================================ */}
      {/* INFORMATIONS                                    */}
      {/* ================================================ */}
      <div className={styles.vehicleBody}>
        <span className={styles.vehicleBrand}>
          {vehicle.brandName}
        </span>

        <h3>{vehicle.modelName}</h3>

        <p className={styles.description}>
          {vehicle.description || 'Premium luxury vehicle.'}
        </p>

        {/* Spécifications : trois colonnes fixes par ligne. */}
        <div className={styles.specifications}>
          <div className={styles.specRow}>
            <div>
              <strong>{formatVehicleSpec(vehicle.transmission)}</strong>
              <span>Transmission</span>
            </div>

            <div>
              <strong>{formatVehicleSpec(vehicle.fuelType)}</strong>
              <span>Fuel</span>
            </div>

            <div>
              <strong>{vehicle.seats}</strong>
              <span>Seats</span>
            </div>
          </div>

          <span className={styles.specDivider} aria-hidden="true">
            ✦
          </span>

          <div className={styles.specRow}>
            <div>
              <strong>{vehicle.powerHp} HP</strong>
              <span>Power</span>
            </div>

            <div>
              <strong>{formatVehicleSpec(vehicle.color)}</strong>
              <span>Colour</span>
            </div>

            <div>
              <strong>{vehicle.manufactureYear}</strong>
              <span>Year</span>
            </div>
          </div>

          <span className={styles.specDivider} aria-hidden="true">
            ✦
          </span>

          {/* La troisième ligne est toujours présente.
              Une valeur absente s'affiche comme un tiret afin
              que les positions restent identiques. */}
          <div className={styles.specRow}>
            <div>
              <strong>{vehicle.engine || '—'}</strong>
              <span>Engine</span>
            </div>

            <div>
              <strong>
                {vehicle.acceleration0To100 != null
                  ? `${Number(vehicle.acceleration0To100).toFixed(1)}s`
                  : '—'}
              </strong>
              <span>0–100 km/h</span>
            </div>

            <div>
              <strong>
                {vehicle.topSpeedKmh != null
                  ? `${vehicle.topSpeedKmh} km/h`
                  : '—'}
              </strong>
              <span>Top speed</span>
            </div>
          </div>
        </div>

        {/* Tarifs : alignés en bas, quelle que soit la description. */}
        <div className={styles.pricing}>
          <div className={styles.dailyRate}>
            <span>DAILY RATE</span>
            <div>
              <strong>{formatAmount(vehicle.dailyPrice)}</strong>
              <small>/ day</small>
            </div>
          </div>

          <div className={styles.deposit}>
            <span>Security deposit</span>
            <strong>{formatAmount(vehicle.securityDeposit)}</strong>
          </div>
        </div>

        {/* Bouton de réservation : lien ou action existante. */}
        {cta.href ? (
          <Link href={cta.href} className={styles.reserveButton}>
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            className={styles.reserveButton}
            onClick={cta.onClick}
          >
            {cta.label}
          </button>
        )}
      </div>
    </article>
  );
}
