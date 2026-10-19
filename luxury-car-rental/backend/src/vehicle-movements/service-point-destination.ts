import type { Db } from '../zones/zones.queries.js';

// ============================================================
// DESTINATION CONTRACTUELLE D'UNE RÉSERVATION
// ============================================================
// Résout, pour un côté (pickup / dropoff), la destination
// physique telle que la réservation l'a figée :
//   1. `reservation_service_points` — empreinte contractuelle du
//      côté (point approuvé OU adresse porte-à-porte) ;
//   2. repli historique `reservation_preferences.pickup/dropoff_location_id`
//      (les réservations d'avant la migration 022) ;
//   3. sinon aucune destination : position explicitement
//      « inconnue » (projection à NULL) — jamais inventée.
//
// Fonction pure à executor (`Db`) : utilisable dans une
// transaction existante (EntityManager) comme hors transaction.

export interface ServicePointDestination {
  locationId: string | null;
  address: unknown;
}

export async function resolveServicePointDestination(
  db: Db,
  reservationId: string,
  direction: 'pickup' | 'dropoff',
): Promise<ServicePointDestination> {
  const points: { method: string; location_id: string | null; address: unknown }[] =
    await db.query(
      `SELECT method, location_id, address
         FROM reservation_service_points
        WHERE reservation_id = $1 AND direction = $2`,
      [reservationId, direction],
    );
  const point = points[0];
  if (point) {
    return point.method === 'DOOR_TO_DOOR'
      ? { locationId: null, address: point.address ?? null }
      : { locationId: point.location_id, address: null };
  }

  // Identifiant de colonne dérivé d'une constante fermée (jamais
  // d'une entrée utilisateur) : l'interpolation n'a aucun risque.
  const column = direction === 'pickup' ? 'pickup_location_id' : 'dropoff_location_id';
  const prefs: { location_id: string | null }[] = await db.query(
    `SELECT ${column} AS location_id
       FROM reservation_preferences
      WHERE reservation_id = $1`,
    [reservationId],
  );
  return { locationId: prefs[0]?.location_id ?? null, address: null };
}
