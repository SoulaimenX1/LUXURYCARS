'use client';

import {
  firstWeekdayOfMonth,
  formatMonthLabel,
  type CalendarResponse,
} from '@/lib/booking';
import styles from './booking.module.css';

// ==========================================================
// CALENDRIER DE DISPONIBILITÉ
// ==========================================================
//
// Vert  : au moins un créneau d'enlèvement valide.
// Ambre : partiellement disponible (certains créneaux bloqués).
// Rouge : totalement indisponible pour la durée minimale.
// Gris  : passé ou hors politique.
//
// Les statuts proviennent exclusivement de NestJS/PostgreSQL.
// Aucune date ni aucun créneau n'est inventé côté navigateur.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_CLASS: Record<string, string> = {
  available: styles.dayAvailable,
  partial: styles.dayPartial,
  unavailable: styles.dayUnavailable,
  past: styles.dayPast,
};

const STATUS_LABEL: Record<string, string> = {
  available: 'available',
  partial: 'partially available',
  unavailable: 'unavailable',
  past: 'past',
};

export default function AvailabilityCalendar({
  month,
  calendar,
  loading,
  error,
  pickupDate,
  returnDate,
  minMonth,
  onMonthChange,
  onPickup,
  onReturn,
}: {
  month: string;
  calendar: CalendarResponse | null;
  loading: boolean;
  error: string;
  pickupDate: string;
  returnDate: string;
  minMonth: string;
  onMonthChange: (month: string) => void;
  onPickup: (date: string) => void;
  onReturn: (date: string) => void;
}) {
  const offset = firstWeekdayOfMonth(month);
  const prevDisabled = month <= minMonth;

  const changeMonth = (delta: number) => {
    if (delta < 0 && prevDisabled) return;
    const [year, index] = month.split('-').map(Number);
    const next = new Date(year, index - 1 + delta, 1);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div>
      <div className={styles.calendarHeader}>
        <span className={styles.calendarTitle}>{formatMonthLabel(month, 'en-GB')}</span>
        <div className={styles.monthNav}>
          <button
            type="button"
            className={styles.monthButton}
            aria-label="Previous month"
            disabled={prevDisabled}
            onClick={() => changeMonth(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.monthButton}
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            ›
          </button>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <>
          <div className={styles.calendarGrid} role="grid" aria-label="Availability calendar">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className={styles.weekday}>
                {weekday}
              </span>
            ))}

            {Array.from({ length: offset }).map((_, index) => (
              <span key={`pad-${index}`} className={styles.dayOutside} />
            ))}

            {calendar?.days.map((day) => {
              const dayNumber = Number(day.date.slice(8, 10));
              const isPickup = day.date === pickupDate;
              const isReturn = day.date === returnDate;
              const inRange =
                Boolean(pickupDate) && Boolean(returnDate) && day.date > pickupDate && day.date < returnDate;

              const selectablePickup = day.status !== 'past' && day.slots.length > 0;
              const selectableReturn =
                Boolean(pickupDate) && day.date > pickupDate && day.returnSlots.length > 0;

              let clickable = false;
              if (isPickup) clickable = true;
              else if (!pickupDate || day.date < pickupDate) clickable = selectablePickup;
              else clickable = selectableReturn;

              const classes = [
                styles.day,
                STATUS_CLASS[day.status] ?? '',
                isPickup ? styles.dayPickup : '',
                isReturn ? styles.dayReturn : '',
                inRange ? styles.dayInRange : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!clickable}
                  aria-pressed={isPickup || isReturn}
                  aria-label={`${day.date}, ${STATUS_LABEL[day.status]}${day.slots.length ? `, ${day.slots.length} pickup slots` : ''}`}
                  title={day.reason ?? undefined}
                  className={classes}
                  onClick={() => {
                    if (isPickup) onPickup('');
                    else if (!pickupDate || day.date < pickupDate) onPickup(day.date);
                    else onReturn(day.date);
                  }}
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>

          {loading && (
            <p className={styles.loading} role="status">
              Updating availability…
            </p>
          )}

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotAvailable}`} /> Available
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotPartial}`} /> Partially available
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotUnavailable}`} /> Unavailable
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotPast}`} /> Past / outside policy
            </span>
          </div>
        </>
      )}
    </div>
  );
}
