import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { StartRentalDto } from './dto/start-rental.dto.js';
import { ExtendRentalDto } from './dto/extend-rental.dto.js';
import { rentalDaysBetween } from '../availability/timezone.js';
import { recordVehicleLocation } from '../vehicle-movements/vehicle-location.js';
import { resolveServicePointDestination } from '../vehicle-movements/service-point-destination.js';

// Résultat d'une lecture PostgreSQL, avec des noms adaptés à l'API.
interface ReservationForHandover {
  id: string;
  reservationNumber: string;
  vehicleId: string;
  status: string;
  pickupAt: Date;
  returnAt: Date;
  vehicleStatus: string;
  vehicleMileage: number;
  licenseIssuedOn: string;
  licenseExpiresOn: string;
  currentLocationId: string | null;
}

export interface RentalRow {
  id: string;
  contractNumber: string;
  reservationId: string;
  reservationNumber: string;
  vehicleId: string;
  customerId: string;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  status: string;
  startedAt: Date;
  expectedReturnAt: Date;
  returnedAt: Date | null;
  pickupMileageKm: number | null;
  pickupFuelLevelPct: number | null;
  pickupCondition: string | null;
  notes: string | null;
  isOverdue: boolean;
  extensions?: unknown[];
}

@Injectable()
export class RentalsService {
  constructor(private readonly dataSource: DataSource) {}

  // Liste des locations déjà démarrées, sans inventer de données.
  async findAll(): Promise<RentalRow[]> {
    return this.dataSource.query(`
      SELECT l.id,
             l.contract_number AS "contractNumber",
             l.reservation_id AS "reservationId",
             r.reservation_number AS "reservationNumber",
             r.vehicle_id AS "vehicleId",
             r.customer_id AS "customerId",
             CONCAT(u.first_name, ' ', u.last_name) AS "customerName",
             CONCAT(b.name, ' ', m.name) AS "vehicleName",
             v.license_plate AS "licensePlate",
             l.status,
             l.started_at AS "startedAt",
             l.expected_return_at AS "expectedReturnAt",
             l.returned_at AS "returnedAt",
             i.mileage_km AS "pickupMileageKm",
             i.fuel_level_pct AS "pickupFuelLevelPct",
             i.overall_condition AS "pickupCondition",
             l.notes,
             (SELECT COALESCE(json_agg(json_build_object(
               'id', e.id, 'oldReturnAt', e.old_return_at,
               'newReturnAt', e.new_return_at, 'additionalAmount', e.additional_amount,
               'reason', e.reason, 'createdAt', e.created_at
             ) ORDER BY e.created_at DESC), '[]'::json)
             FROM rental_extensions e WHERE e.rental_id = l.id) AS "extensions",
             (l.status = 'active' AND l.expected_return_at < NOW()) AS "isOverdue"
      FROM rentals l
      JOIN reservations r ON r.id = l.reservation_id
      JOIN users u ON u.id = r.customer_id
      JOIN vehicles v ON v.id = r.vehicle_id
      JOIN vehicle_models m ON m.id = v.model_id
      JOIN brands b ON b.id = m.brand_id
      LEFT JOIN inspections i ON i.rental_id = l.id AND i.type = 'handover'
      ORDER BY l.created_at DESC
    `);
  }

  // Les informations personnelles restent limitées aux locations du client authentifié.
  // Le filtrage s'effectue dans PostgreSQL, jamais uniquement dans l'interface.
  async findMyRentals(customerId: string): Promise<unknown[]> {
    return this.dataSource.query(`
      SELECT l.id,
             l.contract_number AS "contractNumber",
             r.reservation_number AS "reservationNumber",
             r.vehicle_id AS "vehicleId",
             CONCAT(b.name, ' ', m.name) AS "vehicleName",
             v.license_plate AS "licensePlate",
             l.status,
             l.started_at AS "startedAt",
             l.expected_return_at AS "expectedReturnAt",
             l.returned_at AS "returnedAt",
             i.mileage_km AS "pickupMileageKm",
             i.fuel_level_pct AS "pickupFuelLevelPct",
             i.overall_condition AS "pickupCondition",
             (SELECT COALESCE(json_agg(json_build_object(
               'id', e.id, 'oldReturnAt', e.old_return_at,
               'newReturnAt', e.new_return_at, 'createdAt', e.created_at
             ) ORDER BY e.created_at DESC), '[]'::json)
             FROM rental_extensions e WHERE e.rental_id = l.id) AS "extensions",
             (l.status = 'active' AND l.expected_return_at < NOW()) AS "isOverdue"
      FROM rentals l
      JOIN reservations r ON r.id = l.reservation_id
      JOIN vehicles v ON v.id = r.vehicle_id
      JOIN vehicle_models m ON m.id = v.model_id
      JOIN brands b ON b.id = m.brand_id
      LEFT JOIN inspections i ON i.rental_id = l.id AND i.type = 'handover'
      WHERE r.customer_id = $1
      ORDER BY l.started_at DESC, l.id DESC
    `, [customerId]);
  }

  // Prolonger une location existante dans une transaction unique.
  // La réservation garde les mêmes dates que la location pour bloquer
  // toute réservation concurrente dans la plage prolongée.
  async extendRental(adminId: string, rentalId: string, dto: ExtendRentalDto) {
    // Validate the requested civil date without touching the database so
    // that an invalid date never opens a transaction.
    const probe = new Date(`${dto.newReturnDate}T00:00:00.000Z`);
    if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== dto.newReturnDate) {
      throw new BadRequestException('Invalid new return date');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        // Verrouiller le véhicule avant d'inspecter les réservations : même
        // verrou que les triggers PostgreSQL anti-chevauchement.
        const vehicles: { id: string; status: string }[] = await manager.query(`
          SELECT v.id, v.status
          FROM vehicles v
          JOIN reservations r ON r.vehicle_id = v.id
          JOIN rentals l ON l.reservation_id = r.id
          WHERE l.id = $1::uuid
          FOR UPDATE OF v
        `, [rentalId]);
        if (!vehicles[0]) throw new NotFoundException('Rental not found');
        if (vehicles[0].status !== 'active') {
          throw new ConflictException('This vehicle is not active');
        }

        const rows: {
          id: string; status: string; contractNumber: string;
          reservationId: string; reservationStatus: string; vehicleId: string;
          pickupAt: Date; returnAt: Date; expectedReturnAt: Date;
          dailyPrice: string; totalAmount: string; licenseExpiresOn: string;
          turnaroundMinutes: number;
        }[] = await manager.query(`
          SELECT l.id, l.status, l.contract_number AS "contractNumber",
                 r.id AS "reservationId", r.status AS "reservationStatus",
                 r.vehicle_id AS "vehicleId", r.pickup_at AS "pickupAt",
                 r.return_at AS "returnAt", l.expected_return_at AS "expectedReturnAt",
                 r.daily_price AS "dailyPrice", r.total_amount AS "totalAmount",
                 to_char(cp.license_expires_on, 'YYYY-MM-DD') AS "licenseExpiresOn",
                 COALESCE(loc.turnaround_minutes, 0) AS "turnaroundMinutes"
          FROM rentals l
          JOIN reservations r ON r.id = l.reservation_id
          JOIN customer_profiles cp ON cp.user_id = r.customer_id
          LEFT JOIN reservation_preferences p ON p.reservation_id = r.id
          LEFT JOIN rental_locations loc ON loc.id = p.pickup_location_id
          WHERE l.id = $1::uuid
          FOR UPDATE OF l, r
        `, [rentalId]);
        const rental = rows[0];
        if (!rental) throw new NotFoundException('Rental not found');
        if (rental.status !== 'active' || rental.reservationStatus !== 'converted') {
          throw new ConflictException('Only active rentals can be extended');
        }
        const oldReturnAt = new Date(rental.expectedReturnAt);
        if (oldReturnAt.getTime() !== new Date(rental.returnAt).getTime()) {
          throw new ConflictException('Reservation and rental dates are inconsistent');
        }
        // Preserve the time-of-day from the existing expected return so that
        // midnight UTC is never imposed and timezone drift is avoided.
        const rawTime = dto.newReturnTime ?? oldReturnAt.toISOString().slice(11, 19);
        const timeOfDay = /^\d{2}:\d{2}$/.test(rawTime) ? `${rawTime}:00` : rawTime;
        const newReturnAt = new Date(`${dto.newReturnDate}T${timeOfDay}.000Z`);
        if (Number.isNaN(newReturnAt.getTime())) {
          throw new BadRequestException('Invalid new return date');
        }
        if (newReturnAt <= new Date()) {
          throw new BadRequestException('The new return date must be in the future');
        }
        if (newReturnAt <= oldReturnAt) {
          throw new BadRequestException('New return date must be later than the current return date');
        }
        if (rental.licenseExpiresOn < dto.newReturnDate) {
          throw new ConflictException('Customer driving licence expires before the new return date');
        }
        // Facturation : mêmes règles que la réservation et le devis
        // (`rentalDaysBetween`) afin que les jours facturables de la période
        // d'origine et de la période prolongée restent cohérents.
        const pickupAt = new Date(rental.pickupAt);
        const originalBillableDays = rentalDaysBetween(pickupAt, oldReturnAt);
        const newBillableDays = rentalDaysBetween(pickupAt, newReturnAt);
        if (newBillableDays < originalBillableDays) {
          throw new BadRequestException('The extension produces an invalid rental duration');
        }
        // Jours supplémentaires réellement facturés = différence des jours
        // facturables. La durée écoulée ajoutée est conservée séparément.
        const additionalBillableDays = newBillableDays - originalBillableDays;
        const extensionHours = Math.max(0, (newReturnAt.getTime() - oldReturnAt.getTime()) / 3_600_000);

        // Rechercher les réservations d'autres clients et les maintenances
        // uniquement sur la période supplémentaire (borne de début incluse),
        // en respectant le délai de remise à disposition du lieu de départ.
        const turnaroundMs = Math.max(0, Number(rental.turnaroundMinutes) || 0) * 60_000;
        const rangeStart = new Date(oldReturnAt.getTime() - turnaroundMs);
        const rangeEnd = new Date(newReturnAt.getTime() + turnaroundMs);
        const conflicts: { blocked: boolean }[] = await manager.query(`
          SELECT (
            EXISTS (
              SELECT 1 FROM reservations r
              WHERE r.vehicle_id = $1::uuid AND r.id <> $2::uuid
                AND r.status IN ('pending', 'confirmed', 'converted')
                AND r.period && tstzrange($3::timestamptz, $4::timestamptz, '[)')
            ) OR EXISTS (
              SELECT 1 FROM vehicle_unavailability u
              WHERE u.vehicle_id = $1::uuid
                AND u.period && tstzrange($3::timestamptz, $4::timestamptz, '[)')
            )
          ) AS blocked
        `, [rental.vehicleId, rental.reservationId, rangeStart.toISOString(), rangeEnd.toISOString()]);
        if (conflicts[0]?.blocked) {
          throw new ConflictException('Vehicle is reserved or unavailable during the requested extension');
        }

        // Le total de la réservation reste basé sur le tarif JOURNALIER
        // figé à la réservation, pas sur le prix catalogue courant.
        // Recalculer les prestations facturées par jour avec le prix figé
        // à la réservation. Les prestations ponctuelles ne sont pas multipliées.
        const updatedResult = await manager.query(`
          WITH extras AS (
            SELECT COALESCE(SUM(CASE WHEN pricing_snapshot = 'daily'
                  THEN unit_price_snapshot * $3 ELSE amount_snapshot END), 0)::numeric AS amount
            FROM reservation_extras WHERE reservation_id = $1::uuid
          )
          UPDATE reservations r
          SET return_at = $2::timestamptz,
              rental_days = $3,
              extras_amount = extras.amount,
              total_amount = r.daily_price * $3 + extras.amount + r.delivery_amount - r.discount_amount
          FROM extras
          WHERE r.id = $1::uuid AND r.status = 'converted'
          RETURNING r.total_amount AS "totalAmount"
        `, [rental.reservationId, newReturnAt.toISOString(), newBillableDays]);
        // TypeORM 1.x : UPDATE ... RETURNING renvoie [lignes, nombre].
        const updated: { totalAmount: string }[] =
          Array.isArray(updatedResult?.[0]) ? updatedResult[0] : updatedResult;
        if (!updated[0]) {
          throw new ConflictException('The reservation could not be extended');
        }
        if (!updated[0]) throw new ConflictException('Reservation cannot be extended');
        await manager.query(`
          UPDATE rentals SET expected_return_at = $2::timestamptz
          WHERE id = $1::uuid AND status = 'active'
        `, [rentalId, newReturnAt.toISOString()]);

        // Historique immuable : identifiant admin + montant de la prolongation.
        const history: {
          id: string; additionalAmount: string; createdAt: Date;
        }[] = await manager.query(`
          INSERT INTO rental_extensions (
            rental_id, old_return_at, new_return_at, old_total_amount,
            new_total_amount, additional_amount, extended_by, reason
          ) VALUES ($1::uuid, $2::timestamptz, $3::timestamptz, $4::numeric,
                    $5::numeric, $5::numeric - $4::numeric, $6::uuid, $7)
          RETURNING id, additional_amount AS "additionalAmount", created_at AS "createdAt"
        `, [rentalId, oldReturnAt.toISOString(), newReturnAt.toISOString(),
          rental.totalAmount, updated[0].totalAmount, adminId, dto.reason?.trim() || null]);

        return {
          rentalId, contractNumber: rental.contractNumber,
          previousReturnAt: oldReturnAt,
          expectedReturnAt: newReturnAt,
          previousTotalAmount: rental.totalAmount,
          newTotalAmount: updated[0].totalAmount,
          additionalAmount: history[0].additionalAmount,
          originalBillableDays,
          newBillableDays,
          additionalBillableDays,
          extensionHours,
          // Conservé pour compatibilité ascendante des consommateurs existants.
          additionalDays: additionalBillableDays,
          extensionId: history[0].id,
        };
      });
    } catch (error) {
      // L'exclusion GiST et les triggers restent l'ultime protection
      // contre les conflits qui apparaissent pendant la transaction.
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string } | undefined)?.code;
        if (code === '23P01') {
          throw new ConflictException('Vehicle is unavailable for this extension');
        }
      }
      throw error;
    }
  }

  // Remise du véhicule : une seule opération atomique dans PostgreSQL.
  async startRental(adminId: string, dto: StartRentalDto): Promise<RentalRow> {
    return this.dataSource.transaction(async (manager) => {
      // Verrouiller la réservation ET le véhicule : une remise concurrente
      // ne doit jamais démarrer deux locations pour une seule voiture.
      const reservations: ReservationForHandover[] = await manager.query(`
        SELECT r.id, r.reservation_number AS "reservationNumber",
               r.vehicle_id AS "vehicleId", r.status,
               r.pickup_at AS "pickupAt", r.return_at AS "returnAt",
               v.status AS "vehicleStatus", v.mileage_km AS "vehicleMileage",
               v.current_location_id AS "currentLocationId",
               to_char(cp.license_issued_on, 'YYYY-MM-DD') AS "licenseIssuedOn",
               to_char(cp.license_expires_on, 'YYYY-MM-DD') AS "licenseExpiresOn"
        FROM reservations r
        JOIN vehicles v ON v.id = r.vehicle_id
        JOIN customer_profiles cp ON cp.user_id = r.customer_id
        WHERE r.reservation_number = $1
        FOR UPDATE OF r, v
      `, [dto.reservationNumber.trim().toUpperCase()]);

      const reservation = reservations[0];
      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }
      if (reservation.status !== 'confirmed') {
        throw new ConflictException('Only confirmed reservations can start a rental');
      }
      if (reservation.vehicleStatus !== 'active') {
        throw new ConflictException('The selected vehicle is not active');
      }

      const now = new Date();
      // Revérifier le permis au moment de la remise, sans validation manuelle.
      // Il doit être délivré et rester valable jusqu'à la fin de la location.
      const pickupDay = now.toISOString().slice(0, 10);
      const returnDay = new Date(reservation.returnAt).toISOString().slice(0, 10);
      if (!reservation.licenseIssuedOn || !reservation.licenseExpiresOn ||
          reservation.licenseIssuedOn > pickupDay ||
          reservation.licenseExpiresOn < returnDay) {
        throw new ConflictException('Customer driving licence is not valid for the rental period');
      }
      if (now < new Date(reservation.pickupAt)) {
        throw new ConflictException('The scheduled pickup date has not arrived');
      }
      if (now >= new Date(reservation.returnAt)) {
        throw new ConflictException('The scheduled return date has already passed');
      }
      if (dto.mileageKm < reservation.vehicleMileage) {
        throw new ConflictException('Pickup mileage cannot be lower than current vehicle mileage');
      }

      // Une autre location encore active ne peut pas occuper ce véhicule.
      const overlapping: { id: string }[] = await manager.query(`
        SELECT l.id FROM rentals l
        JOIN reservations r ON r.id = l.reservation_id
        WHERE r.vehicle_id = $1 AND l.status = 'active'
        LIMIT 1
      `, [reservation.vehicleId]);
      if (overlapping.length) {
        throw new ConflictException('This vehicle already has an active rental');
      }

      const created: { id: string }[] = await manager.query(`
        INSERT INTO rentals (
          reservation_id, expected_return_at, opened_by, notes
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [reservation.id, reservation.returnAt, adminId, dto.notes?.trim() || null]);
      const rentalId = created[0]?.id;
      if (!rentalId) {
        throw new ConflictException('The rental could not be created');
      }

      // La première inspection mémorise l'état initial avant la sortie.
      await manager.query(`
        INSERT INTO inspections (
          rental_id, type, performed_by, mileage_km,
          fuel_level_pct, overall_condition, notes
        ) VALUES ($1, 'handover', $2, $3, $4, $5, $6)
      `, [rentalId, adminId, dto.mileageKm, dto.fuelLevelPct,
        dto.overallCondition, dto.notes?.trim() || null]);

      // La réservation reste liée à la location (historique conservé).
      await manager.query(`
        UPDATE reservations SET status = 'converted'
        WHERE id = $1 AND status = 'confirmed'
      `, [reservation.id]);

      // L'odomètre du véhicule reflète son kilométrage au départ.
      await manager.query(`
        UPDATE vehicles SET mileage_km = $2 WHERE id = $1
      `, [reservation.vehicleId, dto.mileageKm]);

      // Registre physique (journal append-only) : la remise sort le
      // véhicule de sa position connue vers la destination
      // CONTRACTUELLE de la réservation (point approuvé ou adresse
      // porte-à-porte). Destination résolue, jamais devinée ; si la
      // réservation ne porte aucun lieu, le véhicule devient
      // explicitement « non tracé » (projection NULL).
      const pickupDestination = await resolveServicePointDestination(
        manager,
        reservation.id,
        'pickup',
      );
      await recordVehicleLocation(manager, {
        vehicleId: reservation.vehicleId,
        eventKind: 'reservation_pickup',
        fromLocationId: reservation.currentLocationId,
        toLocationId: pickupDestination.locationId,
        toAddress: pickupDestination.address ?? undefined,
        reservationId: reservation.id,
        rentalId,
        actorId: adminId,
        source: 'admin',
        note: 'Rental started — vehicle handed over',
      });

      const rentals: RentalRow[] = await manager.query(`
        SELECT l.id, l.contract_number AS "contractNumber",
               l.reservation_id AS "reservationId",
               r.reservation_number AS "reservationNumber",
               r.vehicle_id AS "vehicleId",
               r.customer_id AS "customerId",
               CONCAT(u.first_name, ' ', u.last_name) AS "customerName",
               CONCAT(b.name, ' ', m.name) AS "vehicleName",
               v.license_plate AS "licensePlate",
               l.status, l.started_at AS "startedAt",
               l.expected_return_at AS "expectedReturnAt",
               l.returned_at AS "returnedAt",
               i.mileage_km AS "pickupMileageKm",
               i.fuel_level_pct AS "pickupFuelLevelPct",
               i.overall_condition AS "pickupCondition",
               l.notes
        FROM rentals l
        JOIN reservations r ON r.id = l.reservation_id
        JOIN users u ON u.id = r.customer_id
        JOIN vehicles v ON v.id = r.vehicle_id
        JOIN vehicle_models m ON m.id = v.model_id
        JOIN brands b ON b.id = m.brand_id
        LEFT JOIN inspections i ON i.rental_id = l.id AND i.type = 'handover'
        WHERE l.id = $1
      `, [rentalId]);
      return rentals[0];
    });
  }
}
