// ==========================================================
// CONVERSIONS DE FUSEAU HORAIRE SANS DÉPENDANCE EXTERNE
// ==========================================================
//
// Les horaires des points de service sont exprimés en heure
// locale (ex. « 09:00 » à Genève). PostgreSQL et ce service
// stockent les instants en UTC. Ces helpers convertissent de
// manière déterministe entre heure locale et instant UTC, en
// tenant compte de l'heure d'été, sans bibliothèque tierce.

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = FORMATTER_CACHE.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const map: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Certains moteurs ICU renvoient « 24 » pour minuit.
    hour: Number(map.hour === '24' ? '0' : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// Décalage (ms) appliqué à l'instant UTC pour obtenir l'heure locale.
function offsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

// Convertir une heure locale (mur) en instant UTC.
export function zonedWallTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // Une première estimation, puis une correction (couvre les
  // transitions d'heure d'été proches de minuit).
  const firstOffset = offsetMs(new Date(guess), timeZone);
  const corrected = guess - firstOffset;
  const secondOffset = offsetMs(new Date(corrected), timeZone);

  return new Date(guess - secondOffset);
}

// « 2026-10-15 » dans le fuseau demandé.
export function formatDateInZone(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

// « 09:30 » dans le fuseau demandé.
export function formatTimeInZone(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

// Convertir « HH:MM » en nombre de minutes depuis minuit.
export function parseMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

// Liste des heures « HH:MM » entre l'ouverture (incluse) et la
// fermeture (exclue), par pas de `stepMinutes`.
export function slotTimes(
  opensAt: string,
  closesAt: string,
  stepMinutes: number,
): string[] {
  const open = parseMinutes(opensAt);
  const close = parseMinutes(closesAt);
  const times: string[] = [];

  for (let minutes = open; minutes < close; minutes += stepMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    times.push(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    );
  }

  return times;
}

// Nombre de jours de location facturés : au moins 1, arrondi
// au jour supérieur pour toute fraction de journée.
export function rentalDaysBetween(pickupAt: Date, returnAt: Date): number {
  const milliseconds = returnAt.getTime() - pickupAt.getTime();
  return Math.max(1, Math.ceil(milliseconds / 86_400_000));
}
