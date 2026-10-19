'use client';

import type { CalendarSlot } from '@/lib/booking';
import styles from './booking.module.css';

// ==========================================================
// SÉLECTION DE L'HEURE DE PRISE EN CHARGE ET DE RETOUR
// ==========================================================
//
// Les créneaux proposés sont ceux calculés par le serveur pour le
// lieu et le véhicule choisis. Aucune heure n'est inventée : si un
// créneau n'est pas renvoyé, il est réellement indisponible.

function formatDateLabel(date: string): string {
  if (!date) return '—';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DateTimeSelection({
  locationName,
  timezone,
  pickupDate,
  returnDate,
  pickupSlots,
  returnSlots,
  pickupAt,
  returnAt,
  onPickupTime,
  onReturnTime,
  onReset,
}: {
  locationName: string;
  timezone: string;
  pickupDate: string;
  returnDate: string;
  pickupSlots: CalendarSlot[];
  returnSlots: CalendarSlot[];
  pickupAt: string;
  returnAt: string;
  onPickupTime: (at: string) => void;
  onReturnTime: (at: string) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className={styles.twoCols}>
        <div>
          <p className={styles.slotTitle}>Pickup — {formatDateLabel(pickupDate)}</p>
          {pickupDate && pickupSlots.length ? (
            <div className={styles.slotGrid}>
              {pickupSlots.map((slot) => (
                <button
                  key={slot.at}
                  type="button"
                  className={`${styles.slot} ${pickupAt === slot.at ? styles.slotActive : ''}`}
                  aria-pressed={pickupAt === slot.at}
                  onClick={() => onPickupTime(slot.at)}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.loading}>Select an available pickup date on the calendar.</p>
          )}
        </div>

        <div>
          <p className={styles.slotTitle}>Return — {formatDateLabel(returnDate)}</p>
          {returnDate && returnSlots.length ? (
            <div className={styles.slotGrid}>
              {returnSlots.map((slot) => (
                <button
                  key={slot.at}
                  type="button"
                  className={`${styles.slot} ${returnAt === slot.at ? styles.slotActive : ''}`}
                  aria-pressed={returnAt === slot.at}
                  onClick={() => onReturnTime(slot.at)}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.slotTitle}>
              {pickupDate ? 'Choose a return date on the calendar.' : 'Pickup date first.'}
            </p>
          )}
        </div>
      </div>

      <div className={styles.summaryLine}>
        Pickup and return at <strong>{locationName}</strong> ({timezone}). One-way drop-off is not offered:
        the vehicle is returned to the same location.
      </div>

      {(pickupDate || returnDate) && (
        <p style={{ marginTop: '.75rem' }}>
          <button type="button" className={styles.slot} onClick={onReset}>
            Reset selected dates and times
          </button>
        </p>
      )}
    </div>
  );
}
