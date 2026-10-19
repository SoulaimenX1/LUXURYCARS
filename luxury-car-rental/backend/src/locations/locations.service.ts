import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

// ==========================================================
// LIEUX DE PRISE EN CHARGE (points de service réels)
// ==========================================================
//
// Aucune branche fictive n'est codée en dur : tout provient de
// la table PostgreSQL `rental_locations`. Un véhicule sans
// affectation explicite reste disponible dans tous les lieux
// activés (comportement historique préservé).

export interface RentalLocation {
  id: string;
  code: string;
  name: string;
  category: string;
  city: string;
  country: string;
  address: string;
  canPickup: boolean;
  canDropoff: boolean;
  enabled: boolean;
  timezone: string;
  opensAt: string;
  closesAt: string;
  turnaroundMinutes: number;
}

// Éligibilité demandée : prise en charge, restitution ou les deux.
export type LocationScope = 'pickup' | 'dropoff' | 'all';

const LOCATION_COLUMNS = `
  id, code, name, category, city, country, address,
  can_pickup AS "canPickup", can_dropoff AS "canDropoff", enabled,
  timezone,
  to_char(opens_at, 'HH24:MI') AS "opensAt",
  to_char(closes_at, 'HH24:MI') AS "closesAt",
  turnaround_minutes AS "turnaroundMinutes"`;

@Injectable()
export class LocationsService {
  constructor(private readonly dataSource: DataSource) {}

  // Lieux réels où le client peut récupérer (ou déposer) ce véhicule précis.
  // `scope` distingue les points de prise en charge et de restitution ; par
  // défaut « pickup » pour préserver les consommateurs existants.
  async listForVehicle(
    vehicleId: string,
    scope: LocationScope = 'pickup',
  ): Promise<Partial<RentalLocation>[]> {
    const vehicle: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM vehicles WHERE id = $1::uuid`,
      [vehicleId],
    );
    if (!vehicle[0]) throw new NotFoundException('Vehicle not found');

    // Capacité exigée, choisie dans un ensemble figé (aucune entrée utilisateur).
    const capability =
      scope === 'dropoff'
        ? 'can_dropoff = true'
        : scope === 'all'
          ? '(can_pickup = true OR can_dropoff = true)'
          : 'can_pickup = true';

    return this.dataSource.query(
      `SELECT ${LOCATION_COLUMNS}
       FROM rental_locations
       WHERE enabled = true AND ${capability}
         AND (
           NOT EXISTS (
             SELECT 1 FROM vehicle_rental_locations v WHERE v.vehicle_id = $1::uuid
           )
           OR EXISTS (
             SELECT 1 FROM vehicle_rental_locations v
             WHERE v.vehicle_id = $1::uuid AND v.location_id = rental_locations.id
           )
         )
       ORDER BY city, name`,
      [vehicleId],
    );
  }

  async getLocation(locationId: string): Promise<RentalLocation> {
    const rows: RentalLocation[] = await this.dataSource.query(
      `SELECT ${LOCATION_COLUMNS} FROM rental_locations WHERE id = $1::uuid`,
      [locationId],
    );
    if (!rows[0]) throw new NotFoundException('Pickup location not found');
    return rows[0];
  }

  // Un véhicule sans affectation accepte tous les lieux activés.
  async vehicleSupportsLocation(vehicleId: string, locationId: string): Promise<boolean> {
    const rows: { total: string; assigned: string }[] = await this.dataSource.query(
      `SELECT
         (SELECT count(*) FROM vehicle_rental_locations WHERE vehicle_id = $1::uuid) AS total,
         (SELECT count(*) FROM vehicle_rental_locations
            WHERE vehicle_id = $1::uuid AND location_id = $2::uuid) AS assigned`,
      [vehicleId, locationId],
    );
    const total = Number(rows[0]?.total ?? 0);
    if (total === 0) return true;
    return Number(rows[0]?.assigned ?? 0) > 0;
  }

  // -------------------- Administration ------------------

  async allLocationsForAdmin(): Promise<RentalLocation[]> {
    return this.dataSource.query(
      `SELECT ${LOCATION_COLUMNS} FROM rental_locations ORDER BY city, name`,
    );
  }

  async listVehiclesForAssignment(): Promise<
    { id: string; brandName: string; modelName: string; licensePlate: string; status: string }[]
  > {
    return this.dataSource.query(
      `SELECT v.id, b.name AS "brandName", m.name AS "modelName",
              v.license_plate AS "licensePlate", v.status
       FROM vehicles v
       JOIN vehicle_models m ON m.id = v.model_id
       JOIN brands b ON b.id = m.brand_id
       ORDER BY b.name, m.name, v.license_plate`,
    );
  }

  async assignedVehicleIds(locationId: string): Promise<string[]> {
    const rows: { vehicle_id: string }[] = await this.dataSource.query(
      `SELECT vehicle_id FROM vehicle_rental_locations WHERE location_id = $1::uuid`,
      [locationId],
    );
    return rows.map((row) => row.vehicle_id);
  }

  // Remplacer l'ensemble des véhicules affectés à un lieu.
  async setAssignedVehicles(locationId: string, vehicleIds: string[]): Promise<{ saved: true }> {
    const location = await this.dataSource.query(
      `SELECT id FROM rental_locations WHERE id = $1::uuid`,
      [locationId],
    );
    if (!location[0]) throw new NotFoundException('Pickup location not found');

    if (vehicleIds.length) {
      const found: { id: string }[] = await this.dataSource.query(
        `SELECT id FROM vehicles WHERE id = ANY($1::uuid[])`,
        [vehicleIds],
      );
      if (found.length !== vehicleIds.length) {
        throw new BadRequestException('One or more vehicles do not exist');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM vehicle_rental_locations WHERE location_id = $1::uuid`,
        [locationId],
      );
      for (const vehicleId of vehicleIds) {
        await manager.query(
          `INSERT INTO vehicle_rental_locations (vehicle_id, location_id)
           VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
          [vehicleId, locationId],
        );
      }
    });

    return { saved: true };
  }
}
