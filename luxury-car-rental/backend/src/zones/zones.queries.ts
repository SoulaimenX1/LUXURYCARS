import type { DataSource, EntityManager } from 'typeorm';

// ============================================================
// ZONES DE SERVICE & TARIFS DE LIVRAISON (requêtes SQL pures)
// ============================================================
//
// Fonctions autonomes (executor passé en paramètre) afin d'être
// réutilisées par PremiumService, AvailabilityService et
// ReservationsService SANS modifier leurs constructeurs (les
// specs unitaires existantes restent inchangées).

export type Db = Pick<DataSource, 'query'> | Pick<EntityManager, 'query'>;

export type ZoneRow = {
  id: string;
  code: string;
  name: string;
  country_code: string;
  active: boolean;
  address_service_enabled: boolean;
  cities: unknown;
  timezone: string;
  opens_at: string;
  closes_at: string;
  lead_time_minutes: number;
  cutoff_time: string | null;
  after_hours_allowed: boolean;
  holiday_exceptions: unknown;
  fleet_restrictions: unknown;
  notes: string | null;
};

export const ZONE_COLUMNS = `id, code, name, country_code, active, address_service_enabled,
  cities, timezone, opens_at, closes_at, lead_time_minutes, cutoff_time,
  after_hours_allowed, holiday_exceptions, fleet_restrictions, notes`;

// ------------------------------------------------------------
// Helpers purs (aucune base, aucune config)
// ------------------------------------------------------------

// Pays sous forme de code ISO 3166-1 alpha-2. Les libellés français /
// anglais rencontrés dans l'historique (France, Allemagne, Suisse,
// Hongrie) et les pays frontaliers connus sont mappés ; tout autre
// libellé est normalisé en minuscules pour une comparaison texte.
const COUNTRY_ALIASES: Record<string, string> = {
  france: 'FR', 'france metropolitaine': 'FR',
  germany: 'DE', allemagne: 'DE',
  switzerland: 'CH', suisse: 'CH',
  hungary: 'HU', hongrie: 'HU',
  austria: 'AT', autriche: 'AT',
  slovakia: 'SK', slovaquie: 'SK',
  slovenia: 'SI', slovenie: 'SI',
  romania: 'RO', roumanie: 'RO',
  serbia: 'RS', serbie: 'RS',
  croatia: 'HR', croatie: 'HR',
  ukraine: 'UA',
  belgium: 'BE', belgique: 'BE',
};

const stripAccents = (v: string): string =>
  v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export function canonicalCountry(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = stripAccents(String(value).trim());
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
  return COUNTRY_ALIASES[key] ?? key;
}

export function normalizeCity(value: string | null | undefined): string {
  if (!value) return '';
  return stripAccents(String(value).trim()).toLowerCase().replace(/\s+/g, ' ');
}

export function timeToMinutes(value: string | null | undefined): number {
  if (!value) return 0;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value));
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Date/heure locales DANS un fuseau (jamais un décalage simulé).
export function zonedParts(date: Date, timeZone: string): { date: string; minutes: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}

// ------------------------------------------------------------
// Éligibilité géographique (zone active + ville couverte)
// ------------------------------------------------------------

export type ZoneVerdict = { zone: ZoneRow | null; reason?: string };

export async function findEligibleZone(
  db: Db,
  params: { countryCode: string; city?: string },
): Promise<ZoneVerdict> {
  const cc = canonicalCountry(params.countryCode);
  const zones: ZoneRow[] = await db.query(
    `SELECT ${ZONE_COLUMNS} FROM service_zones
      WHERE country_code=$1 AND active AND address_service_enabled
      ORDER BY CASE WHEN jsonb_typeof(cities)='array'
                    THEN jsonb_array_length(cities) ELSE 0 END DESC,
               created_at`, [cc]);
  if (!zones.length) {
    // Raison explicite : pays jamais couvert, zone désactivée, ou
    // service adresse désactivé — jamais un « oui/non » muet.
    const any: { active: boolean; address_service_enabled: boolean }[] = await db.query(
      `SELECT active, address_service_enabled FROM service_zones
        WHERE country_code=$1 ORDER BY created_at`, [cc]);
    if (!any.length) return { zone: null, reason: 'address-not-in-zone' };
    if (any.some((z) => !z.active)) return { zone: null, reason: 'no-active-zone' };
    return { zone: null, reason: 'address-service-disabled' };
  }
  if (!params.city) return { zone: zones[0] };
  const wanted = normalizeCity(params.city);
  const hit = zones.find((z) => {
    const cities = Array.isArray(z.cities) ? z.cities : [];
    return cities.length === 0 || cities.some((c) => normalizeCity(String(c)) === wanted);
  });
  return hit ? { zone: hit } : { zone: null, reason: 'city-not-in-zone' };
}

// ------------------------------------------------------------
// Tarif « porte-à-porte » : zone + règle active + majorations
// explicites + faisabilité horaire. Aucun montant n'est inventé :
// pas de règle active = service non tarifé = refus explicite.
// ------------------------------------------------------------

export type DoorFeeOutcome =
  | { ok: true; feeCents: number; zoneCode: string }
  | { ok: false; reason: string };

export type DoorServiceType = 'door_pickup' | 'door_dropoff';

type RuleRow = {
  fee_mode: string;
  fixed_fee: string | null;
  minimum_fee: string | null;
  modifiers: unknown;
};

const asCents = (v: unknown): number | null => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

export async function quoteDoorService(
  db: Db,
  params: {
    countryCode: string;
    city: string;
    scheduledAt: Date;
    serviceType: DoorServiceType;
    vehicleId: string;
  },
): Promise<DoorFeeOutcome> {
  const verdict = await findEligibleZone(db, { countryCode: params.countryCode, city: params.city });
  if (!verdict.zone) return { ok: false, reason: verdict.reason ?? 'address-not-in-zone' };
  const zone = verdict.zone;

  // Une seule règle active par (zone, type) est garantie par index partiel.
  const rules: RuleRow[] = await db.query(
    `SELECT fee_mode, fixed_fee, minimum_fee, modifiers FROM delivery_pricing_rules
      WHERE zone_id=$1 AND service_type=$2 AND status='active'
        AND (effective_from IS NULL OR effective_from<=NOW())
        AND (effective_to IS NULL OR effective_to>NOW())`,
    [zone.id, params.serviceType]);
  if (rules.length !== 1) return { ok: false, reason: 'pricing-not-configured' };
  const rule = rules[0];
  if (rule.fee_mode !== 'fixed') return { ok: false, reason: 'unsupported-fee-mode' };
  // Frais absents (NULL) = non approuvés → service non tarifé.
  // Jamais un « 0.00 » silencieux (Number(null) vaudrait 0).
  if (rule.fixed_fee === null || rule.fixed_fee === undefined) {
    return { ok: false, reason: 'pricing-not-configured' };
  }
  const base = Number(rule.fixed_fee);
  if (!Number.isFinite(base) || base < 0) return { ok: false, reason: 'pricing-not-configured' };

  // Restrictions de flotte (liste blanche de catégories) : la
  // catégorie du véhicule vient du modèle, jamais d'une valeur client.
  const restrictions = (zone.fleet_restrictions ?? {}) as { categories?: unknown };
  if (Array.isArray(restrictions.categories) && restrictions.categories.length) {
    const rows: { category_name: string | null }[] = await db.query(
      `SELECT c.name AS category_name FROM vehicles v
         LEFT JOIN vehicle_models m ON m.id = v.model_id
         LEFT JOIN categories c ON c.id = m.category_id
        WHERE v.id=$1`, [params.vehicleId]);
    const categoryName = normalizeCity(rows[0]?.category_name ?? '');
    const allowed = restrictions.categories.some((c) => normalizeCity(String(c)) === categoryName);
    if (!allowed) return { ok: false, reason: 'vehicle-not-allowed-in-zone' };
  }

  // Heure locale contractuelle de la prestation ET heure d'aujourd'hui.
  let local: { date: string; minutes: number; weekday: number };
  let today: { date: string; minutes: number; weekday: number };
  try {
    local = zonedParts(params.scheduledAt, zone.timezone);
    today = zonedParts(new Date(), zone.timezone);
  } catch {
    return { ok: false, reason: 'invalid-zone-configuration' };
  }

  // Délai minimum avant la prestation.
  const lead = Number(zone.lead_time_minutes) || 0;
  if (lead > 0 && params.scheduledAt.getTime() - Date.now() < lead * 60000) {
    return { ok: false, reason: 'insufficient-lead-time' };
  }

  // Heure limite de réservation pour une prestation le jour même.
  if (zone.cutoff_time && today.date === local.date && today.minutes > timeToMinutes(zone.cutoff_time)) {
    return { ok: false, reason: 'booking-after-cutoff' };
  }

  // Horaires d'ouverture, avec exceptions (fériés / fermetures) de la zone.
  const exceptions = Array.isArray(zone.holiday_exceptions)
    ? (zone.holiday_exceptions as { date?: string; closed?: boolean; opensAt?: string; closesAt?: string }[])
    : [];
  const exception = exceptions.find((e) => e && e.date === local.date);
  if (exception?.closed) return { ok: false, reason: 'zone-closed' };
  const openMin = timeToMinutes(exception?.opensAt ?? zone.opens_at);
  const closeMin = timeToMinutes(exception?.closesAt ?? zone.closes_at);
  // Conventions alignées sur availability.check : fermeture EXCLUE au
  // pickup (comme « outside_pickup_hours »), fermeture INCLUSE au
  // retour (comme « outside_return_hours »).
  const outsideHours = params.serviceType === 'door_pickup'
    ? (local.minutes < openMin || local.minutes >= closeMin)
    : (local.minutes < openMin || local.minutes > closeMin);

  // Majorations : uniquement celles explicitement configurées.
  const modifiers = (rule.modifiers ?? {}) as {
    afterHours?: { fee?: unknown };
    holiday?: { fee?: unknown };
    weekend?: { days?: unknown; fee?: { fee?: unknown } };
  };
  let extra = 0;
  if (outsideHours) {
    if (!zone.after_hours_allowed) return { ok: false, reason: 'outside-operating-hours' };
    const add = asCents(modifiers.afterHours?.fee);
    if (add === null) return { ok: false, reason: 'invalid-pricing-configuration' };
    extra += add;
  }
  if (exception) {
    const add = asCents(modifiers.holiday?.fee);
    if (add === null) return { ok: false, reason: 'invalid-pricing-configuration' };
    extra += add;
  }
  const weekend = modifiers.weekend;
  if (weekend && Array.isArray(weekend.days) && weekend.days.some((d) => Number(d) === local.weekday)) {
    const add = asCents(weekend.fee?.fee);
    if (add === null) return { ok: false, reason: 'invalid-pricing-configuration' };
    extra += add;
  }

  let fee = Math.round(base * 100) + extra;
  if (rule.minimum_fee !== null && rule.minimum_fee !== undefined) {
    const minimum = Number(rule.minimum_fee);
    if (!Number.isFinite(minimum) || minimum < 0) return { ok: false, reason: 'invalid-pricing-configuration' };
    fee = Math.max(fee, Math.round(minimum * 100));
  }
  if (!Number.isSafeInteger(fee) || fee < 0) return { ok: false, reason: 'invalid-pricing-configuration' };
  return { ok: true, feeCents: fee, zoneCode: zone.code };
}

// Fuseau horaire contractuel d'un côté « porte-à-porte » (après
// éligibilité validée par quoteDoorService / quote point).
export async function zoneTimezoneFor(
  db: Db,
  params: { countryCode: string; city: string },
): Promise<string> {
  const verdict = await findEligibleZone(db, params);
  return verdict.zone?.timezone ?? 'Europe/Budapest';
}
