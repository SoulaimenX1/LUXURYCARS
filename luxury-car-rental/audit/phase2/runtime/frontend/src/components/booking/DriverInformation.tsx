'use client';

import Link from 'next/link';
import styles from './booking.module.css';

// ==========================================================
// INFORMATIONS DU CONDUCTEUR
// ==========================================================
//
// Réutilise le profil client existant (permis de conduire).
// Aucune approbation manuelle n'est demandée : le backend
// revérifie le titulaire, la validité et l'éligibilité au moment
// de créer la réservation. Cette section ne fait qu'informer.

function asText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—';
}

export default function DriverInformation({
  profile,
  missing,
  loading,
  error,
  returnDate,
}: {
  profile: Record<string, unknown> | null;
  missing: boolean;
  loading: boolean;
  error: string;
  returnDate: string;
}) {
  if (loading) {
    return <p className={styles.loading}>Checking your driving licence…</p>;
  }

  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  if (missing || !profile) {
    return (
      <div className={styles.driverCard}>
        <span className={`${styles.badge} ${styles.badgeWarn}`}>Licence required</span>
        <p className={styles.notice}>
          Add your driving licence details to your profile before confirming. The licence must remain
          valid until the scheduled return date.
        </p>
        <Link href="/account/profile" className={styles.inlineLink}>
          Complete your profile →
        </Link>
      </div>
    );
  }

  const expiresOn = typeof profile.licenseExpiresOn === 'string'
    ? profile.licenseExpiresOn.slice(0, 10)
    : '';
  const expired = Boolean(returnDate) && Boolean(expiresOn) && expiresOn < returnDate;

  return (
    <div className={styles.driverCard}>
      <span className={`${styles.badge} ${expired ? styles.badgeWarn : styles.badgeOk}`}>
        {expired ? 'Licence expires before the return date' : 'Licence verified on file'}
      </span>

      <dl className={styles.detailGrid}>
        <div>
          <dt>Full name</dt>
          <dd>{asText(profile.fullName)}</dd>
        </div>
        <div>
          <dt>Licence number</dt>
          <dd>{asText(profile.licenseNumber)}</dd>
        </div>
        <div>
          <dt>Country</dt>
          <dd>{asText(profile.licenseCountry)}</dd>
        </div>
        <div>
          <dt>Issued on</dt>
          <dd>{asText(profile.licenseIssuedOn).slice(0, 10)}</dd>
        </div>
        <div>
          <dt>Expires on</dt>
          <dd>{expiresOn || '—'}</dd>
        </div>
      </dl>

      {expired && (
        <p className={styles.error}>
          Your licence expires on {expiresOn}, before the selected return date {returnDate}.{' '}
          <Link href="/account/profile" className={styles.inlineLink}>
            Update your profile
          </Link>
          .
        </p>
      )}
    </div>
  );
}
