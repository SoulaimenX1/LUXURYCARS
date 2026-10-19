import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Db } from '../zones/zones.queries.js';

// ============================================================
// REGISTRE PHYSIQUE DES VÉHICULES (journal d'événements)
// ============================================================
// La position « physique » d'un véhicule DÉRIVE du dernier
// événement vérifié — jamais d'une affectation de mission, jamais
// d'un ré-assignation de lieu. `vehicles.current_location_id` n'est
// qu'une projection pratique ; la table d'événements reste la
// source de vérité (append-only, aucune mise à jour en place).
// Les adresses privées (retour porte-à-porte) restent visibles
// uniquement via les endpoints sécurisés.

export type VehicleEventKind =
  | 'reservation_pickup'
  | 'reservation_return'
  | 'mission_parked_confirmed'
  | 'mission_reposition'
  | 'admin_manual'
  | 'maintenance'
  | 'correction';

export type VehicleEventSource = 'system' | 'driver' | 'admin';

export type RecordVehicleLocationInput = {
  vehicleId: string;
  eventKind: VehicleEventKind;
  fromLocationId?: string | null;
  fromAddress?: unknown;
  toLocationId?: string | null;
  toAddress?: unknown;
  missionId?: string | null;
  reservationId?: string | null;
  rentalId?: string | null;
  actorId?: string | null;
  source?: VehicleEventSource;
  occurredAt?: Date;
  verifiedAt?: Date | null;
  note?: string | null;
};

// Enregistre un événement de localisation et met à jour la
// projection `current_location_id` ATOMIQUEMENT (CTE) :
// événement à adresse seule → projection = NULL (le véhicule n'est
// plus sur aucun lieu enregistré — jamais une position fausse).
export async function recordVehicleLocation(
  db: Db,
  input: RecordVehicleLocationInput,
): Promise<{ id: string }> {
  const rows: { id: string }[] = await db.query(
    `WITH ev AS (
       INSERT INTO vehicle_location_events
         (vehicle_id, event_kind, occurred_at, from_location_id, to_location_id,
          from_address, to_address, mission_id, reservation_id, rental_id,
          actor_id, source, verified_at, note)
       VALUES ($1,$2,COALESCE($3::timestamptz, NOW()),$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id
     ), proj AS (
       UPDATE vehicles SET current_location_id=$5, updated_at=NOW() WHERE id=$1
     )
     SELECT id FROM ev`,
    [
      input.vehicleId,
      input.eventKind,
      input.occurredAt?.toISOString() ?? null,
      input.fromLocationId ?? null,
      input.toLocationId ?? null,
      input.fromAddress ? JSON.stringify(input.fromAddress) : null,
      input.toAddress ? JSON.stringify(input.toAddress) : null,
      input.missionId ?? null,
      input.reservationId ?? null,
      input.rentalId ?? null,
      input.actorId ?? null,
      input.source ?? 'system',
      input.verifiedAt ? input.verifiedAt.toISOString() : null,
      input.note ?? null,
    ],
  );
  return { id: rows[0]?.id ?? '' };
}

const POSITION_SELECT = `
  SELECT v.id, v.license_plate, v.status, v.manufacture_year,
         b.name AS brand_name, m.name AS model_name,
         v.home_location_id, hl.name AS home_location_name, hl.code AS home_location_code,
         v.current_location_id, cl.name AS current_location_name, cl.code AS current_location_code,
         ev.id AS last_event_id, ev.event_kind AS last_event_kind,
         ev.occurred_at AS last_event_at, ev.source AS last_event_source,
         ev.to_address AS last_event_address, ev.to_location_id AS last_event_location_id,
         ev.verified_at AS last_event_verified_at
    FROM vehicles v
    LEFT JOIN vehicle_models m ON m.id = v.model_id
    LEFT JOIN brands b ON b.id = m.brand_id
    LEFT JOIN rental_locations hl ON hl.id = v.home_location_id
    LEFT JOIN rental_locations cl ON cl.id = v.current_location_id
    LEFT JOIN LATERAL (
      SELECT e.id, e.event_kind, e.occurred_at, e.source, e.to_address,
             e.to_location_id, e.verified_at
        FROM vehicle_location_events e
       WHERE e.vehicle_id = v.id
       ORDER BY e.occurred_at DESC, e.id DESC
       LIMIT 1
    ) ev ON TRUE`;

export async function currentVehiclePositions(
  db: Db,
  params: { vehicleId?: string },
) {
  return db.query(
    `${POSITION_SELECT}
      WHERE ($1::uuid IS NULL OR v.id = $1)
      ORDER BY b.name, m.name, v.license_plate`,
    [params.vehicleId ?? null],
  );
}

export async function listVehicleMovements(
  db: Db,
  params: { vehicleId?: string; limit?: number },
) {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  return db.query(
    `SELECT e.id, e.vehicle_id, e.event_kind, e.occurred_at, e.source,
            e.from_location_id, fl.name AS from_location_name,
            e.to_location_id, tl.name AS to_location_name,
            e.from_address, e.to_address,
            e.mission_id, e.reservation_id, e.rental_id,
            e.actor_id, e.verified_at, e.note
       FROM vehicle_location_events e
       LEFT JOIN rental_locations fl ON fl.id = e.from_location_id
       LEFT JOIN rental_locations tl ON tl.id = e.to_location_id
      WHERE ($1::uuid IS NULL OR e.vehicle_id = $1)
      ORDER BY e.occurred_at DESC, e.id DESC
      LIMIT $2`,
    [params.vehicleId ?? null, limit],
  );
}

// Affectation du lieu de base (« domicile » du véhicule).
// NE touche JAMAIS à current_location_id : une affectation de lieu
// ne change pas la position physique réelle du véhicule.
export async function setVehicleHomeLocation(
  db: Db,
  vehicleId: string,
  homeLocationId: string | null,
): Promise<{ id: string; home_location_id: string | null }> {
  if (homeLocationId) {
    const locations: { id: string }[] = await db.query(
      `SELECT id FROM rental_locations WHERE id=$1 AND enabled`, [homeLocationId],
    );
    if (!locations[0]) throw new NotFoundException('Service location not found or disabled');
  }
  const vehicles: { id: string }[] = await db.query(
    `SELECT id FROM vehicles WHERE id=$1`, [vehicleId],
  );
  if (!vehicles[0]) throw new NotFoundException('Vehicle not found');
  const rows: { id: string; home_location_id: string | null }[] = await db.query(
    `UPDATE vehicles SET home_location_id=$2, updated_at=NOW()
      WHERE id=$1 RETURNING id, home_location_id`,
    [vehicleId, homeLocationId],
  );
  return rows[0];
}

// Vérifie qu'au moins une destination est renseignée (position
// dérivée d'un événement, jamais d'une valeur implicite).
export function requireDestination(input: {
  toLocationId?: string | null;
  toAddress?: unknown;
}): void {
  if (!input.toLocationId && !input.toAddress) {
    throw new BadRequestException(
      'A destination is required: provide toLocationId or toAddress',
    );
  }
}
