import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Db } from '../zones/zones.queries.js';
import { canonicalCountry, normalizeCity } from '../zones/zones.queries.js';

// ============================================================
// DEVIS DE LIVRAISON (persistés, immuables, serveur-autoritaire)
// ============================================================
//
// Un devis est un instantané du calcul serveur (jamais du client) :
// véhicule, fenêtres, points de service, ventilation complète.
// À la réservation, le devis est revalidé (propriété, date de
// validité, empreinte des entrées, total recalculé) puis marqué
// « accepté » de façon atomique. Le montant final reste toujours
// recalculé par premium.quote : le devis ne peut rien falsifier.

export const QUOTE_TTL_MS = 15 * 60 * 1000;

// Empreinte normalisée d'un côté de prestation : uniquement les
// informations qui influencent le prix (mode, lieu, pays, ville).
export type ServiceFingerprint = {
  mode: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
  locationId: string | null;
  countryCode: string | null;
  city: string | null;
};

export function buildSideFingerprint(params: {
  mode: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
  locationId?: string | null;
  address?: { countryCode: string; city: string } | null;
}): ServiceFingerprint {
  if (params.mode === 'APPROVED_POINT') {
    return { mode: params.mode, locationId: params.locationId ?? null, countryCode: null, city: null };
  }
  return {
    mode: params.mode,
    locationId: null,
    countryCode: params.address ? canonicalCountry(params.address.countryCode) : null,
    city: params.address ? normalizeCity(params.address.city) : null,
  };
}

const sameFingerprint = (a: ServiceFingerprint, b: ServiceFingerprint): boolean =>
  a.mode === b.mode && a.locationId === b.locationId &&
  a.countryCode === b.countryCode && a.city === b.city;

export type PersistQuoteInput = {
  createdFor: string | null;
  vehicleId: string;
  pickupAt: Date;
  returnAt: Date;
  zoneId: string | null;
  pickupPoint: ServiceFingerprint;
  dropoffPoint: ServiceFingerprint;
  breakdown: unknown;
};

export async function persistQuote(
  db: Db,
  input: PersistQuoteInput,
): Promise<{ id: string; expiresAt: Date }> {
  const rows: { id: string; expires_at: string }[] = await db.query(
    `INSERT INTO delivery_quotes
       (created_for, vehicle_id, pickup_at, return_at, zone_id,
        pickup_method, dropoff_method, pickup_point, dropoff_point,
        breakdown, policy_version, status, calculated_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,1,'issued',NOW(),NOW()+interval '15 minutes')
     RETURNING id, expires_at`,
    [
      input.createdFor, input.vehicleId, input.pickupAt.toISOString(), input.returnAt.toISOString(),
      input.zoneId, input.pickupPoint.mode, input.dropoffPoint.mode,
      JSON.stringify(input.pickupPoint), JSON.stringify(input.dropoffPoint),
      JSON.stringify(input.breakdown),
    ]);
  return { id: rows[0].id, expiresAt: new Date(rows[0].expires_at) };
}

// Revalidation complète avant création de réservation. Chaque
// échec a un message distinct : jamais un « devis invalide » muet.
export async function validateQuoteForBooking(
  db: Db,
  params: {
    quoteId: string;
    userId: string;
    expected: {
      vehicleId: string;
      pickupAt: Date;
      returnAt: Date;
      pickupPoint: ServiceFingerprint;
      dropoffPoint: ServiceFingerprint;
    };
  },
): Promise<{ breakdown: { totalAmount?: unknown } }> {
  type QuoteRow = {
    id: string; created_for: string | null; vehicle_id: string;
    pickup_at: string; return_at: string;
    pickup_point: ServiceFingerprint; dropoff_point: ServiceFingerprint;
    breakdown: { totalAmount?: unknown }; status: string; expires_at: string;
  };
  const rows: QuoteRow[] = await db.query(
    `SELECT id, created_for, vehicle_id, pickup_at, return_at, pickup_point,
            dropoff_point, breakdown, status, expires_at
       FROM delivery_quotes WHERE id=$1`, [params.quoteId]);
  const row = rows[0];
  // Un devis d'un autre client n'existe pas (pas de fuite d'info).
  if (!row || (row.created_for !== null && row.created_for !== params.userId)) {
    throw new NotFoundException('Delivery quote not found');
  }
  if (row.status !== 'issued') {
    throw new ConflictException('This delivery quote has already been used');
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ConflictException('This delivery quote has expired: request a new price');
  }
  const same =
    row.vehicle_id === params.expected.vehicleId &&
    new Date(row.pickup_at).getTime() === params.expected.pickupAt.getTime() &&
    new Date(row.return_at).getTime() === params.expected.returnAt.getTime() &&
    sameFingerprint(row.pickup_point, params.expected.pickupPoint) &&
    sameFingerprint(row.dropoff_point, params.expected.dropoffPoint);
  if (!same) {
    throw new ConflictException('This delivery quote does not match the requested booking');
  }
  return { breakdown: row.breakdown ?? {} };
}

// Comparaison du total recalculé par le serveur avec le total du
// devis : toute divergence (tarif modifié entre-temps) refuse la
// réservation plutôt que de facturer une surprise.
export function assertQuoteMatchesFreshTotal(
  breakdown: { totalAmount?: unknown },
  freshTotalAmount: string,
): void {
  if (breakdown.totalAmount === undefined) return;
  const quoted =
    typeof breakdown.totalAmount === 'string' ||
    typeof breakdown.totalAmount === 'number'
      ? String(breakdown.totalAmount)
      : null;
  // Type inattendu = devis corrompu → refuser, jamais passer en silence.
  if (quoted === null || quoted !== freshTotalAmount) {
    throw new ConflictException('Pricing has changed since this quote: request a new price');
  }
}

// Réclamation atomique du devis au moment de l'insertion de la
// réservation (dans la transaction) : deux réservations ne peuvent
// pas accepter le même devis.
export async function markQuoteAccepted(
  db: Db,
  quoteId: string,
  reservationId: string,
): Promise<void> {
  const rows: { id: string }[] = await db.query(
    `UPDATE delivery_quotes
        SET status='accepted', accepted_reservation_id=$2
      WHERE id=$1 AND status='issued' AND expires_at>NOW()
      RETURNING id`, [quoteId, reservationId]);
  if (!rows[0]) {
    throw new ConflictException('This delivery quote has expired: request a new price');
  }
}
