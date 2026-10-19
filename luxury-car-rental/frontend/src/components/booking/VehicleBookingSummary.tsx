'use client';

import { useState } from 'react';
import { Price } from '@/components/currency-provider';
import type { VehicleItem } from '@/lib/booking';
import { formatLabel } from '@/lib/format';
import styles from './booking.module.css';

// ==========================================================
// RÉCAPITULATIF DU VÉHICULE CHOISI
// ==========================================================
//
// Le véhicule est toujours celui sélectionné dans la flotte :
// cette fiche ne fait qu'afficher les données réelles renvoyées
// par le catalogue. Aucun identifiant n'est inventé ni remplacé.

export default function VehicleBookingSummary({ vehicle }: { vehicle: VehicleItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(vehicle.imageUrl) && !imageFailed;

  return (
    <div className={styles.vehicleSummary}>
      <div className={styles.vehicleMedia}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.vehicleImage}
            src={vehicle.imageUrl ?? ''}
            alt={`${vehicle.brandName} ${vehicle.modelName}`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className={styles.vehiclePlaceholder}>{vehicle.brandName}</span>
        )}
      </div>

      <div>
        <span className={styles.vehicleBrand}>{vehicle.brandName}</span>
        <h3 className={styles.vehicleName}>{vehicle.modelName}</h3>

        <div className={styles.vehicleSpecs}>
          <span className={styles.chip}>{formatLabel(vehicle.transmission)}</span>
          <span className={styles.chip}>{formatLabel(vehicle.fuelType)}</span>
          <span className={styles.chip}>{vehicle.seats} seats</span>
          <span className={styles.chip}>{vehicle.powerHp} hp</span>
          <span className={styles.chip}>{vehicle.manufactureYear}</span>
        </div>

        <dl className={styles.rateRow}>
          <div>
            <dt>Daily rate</dt>
            <dd>
              <Price value={vehicle.dailyPrice} />
            </dd>
          </div>
          <div>
            <dt>Security deposit</dt>
            <dd>
              <Price value={vehicle.securityDeposit} />
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
