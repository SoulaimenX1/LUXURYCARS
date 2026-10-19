import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Db } from '../zones/zones.queries.js';
import { recordVehicleLocation } from '../vehicle-movements/vehicle-location.js';
import {
  AssignDriverDto,
  CreateMissionDto,
  MissionActionDto,
  MissionListQueryDto,
} from './dto/mission.dto.js';

// ============================================================
// MISSIONS DE TRANSPORT (EXPÉDITION MANUELLE — MVP)
// ============================================================
// Règles non négociables :
//   • la réservation reste le système unique : une mission de
//     livraison/collecte référence la réservation et SON véhicule ;
//   • aucun frais, distance ni ETA n'est inventé — distance_km
//     n'est renseignée que par le chauffeur à l'achèvement ;
//   • les chevauchements (véhicule + chauffeur) sont garantis par
//     les exclusions PostgreSQL de la migration 022, appuyés ici
//     par un verrou FOR UPDATE sur le véhicule ;
//   • les missions valent engagements du véhicule contre les
//     réservations/indisponibilités/location active selon la MÊME
//     sémantique que AvailabilityService.loadBlocks (en excluant la
//     réservation liée : la mission la sert) ;
//   • le journal mission_events est append-only (seq unique),
//     la position physique du véhicule n'est mise à jour qu'à
//     l'achèvement (registre vehicle_location_events).

const MISSION_COLUMNS = `
  m.id, m.mission_number AS "missionNumber", m.type, m.state,
  m.reservation_id AS "reservationId", m.vehicle_id AS "vehicleId",
  m.origin_kind AS "originKind", m.origin_location_id AS "originLocationId",
  m.origin_address AS "originAddress",
  m.destination_kind AS "destinationKind",
  m.destination_location_id AS "destinationLocationId",
  m.destination_address AS "destinationAddress",
  m.planned_start AS "plannedStart", m.planned_end AS "plannedEnd",
  m.assigned_driver_id AS "assignedDriverId",
  m.distance_km AS "distanceKm", m.revision,
  m.created_by AS "createdBy", m.created_at AS "createdAt", m.updated_at AS "updatedAt"
`;

const MISSION_JOINS = `
  FROM transport_missions m
  LEFT JOIN reservations r ON r.id = m.reservation_id
  JOIN vehicles v ON v.id = m.vehicle_id
  JOIN vehicle_models vm ON vm.id = v.model_id
  JOIN brands b ON b.id = vm.brand_id
  LEFT JOIN users du ON du.id = m.assigned_driver_id
  LEFT JOIN rental_locations ol ON ol.id = m.origin_location_id
  LEFT JOIN rental_locations dl ON dl.id = m.destination_location_id
`;

const MISSION_LABELS = `,
  r.reservation_number AS "reservationNumber",
  CONCAT(b.name, ' ', vm.name) AS "vehicleName",
  v.license_plate AS "licensePlate",
  CONCAT(du.first_name, ' ', du.last_name) AS "driverName",
  du.email AS "driverEmail",
  ol.name AS "originLocationName",
  dl.name AS "destinationLocationName"
`;

// Machine d'états du chauffeur (les transitions admin sont gérées
// à part : affectation et annulation).
const DRIVER_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  accept: { from: ['assigned'], to: 'accepted' },
  start: { from: ['accepted'], to: 'in_progress' },
  pause: { from: ['in_progress'], to: 'paused' },
  resume: { from: ['paused'], to: 'in_progress' },
  complete: { from: ['in_progress'], to: 'completed' },
  fail: { from: ['accepted', 'in_progress', 'paused'], to: 'failed' },
};

export type DriverTransition = keyof typeof DRIVER_TRANSITIONS;

// Violation d'exclusion PostgreSQL (chevauchement) — identifié sur
// l'erreur pg brute comme sur QueryFailedError (TypeORM).
function isExclusionViolation(error: unknown): boolean {
  const code =
    (error as { code?: string } | null)?.code ??
    (error as { driverError?: { code?: string } } | null)?.driverError?.code;
  return code === '23P01';
}

@Injectable()
export class TransportMissionsService {
  constructor(private readonly dataSource: DataSource) {}

  // ---- Vérifications partagées ----

  private assertPointShape(
    label: string,
    kind: string,
    locationId: string | undefined,
    address: unknown,
  ): void {
    if (kind === 'LOCATION') {
      if (!locationId) {
        throw new BadRequestException(`${label}: a location is required for kind LOCATION`);
      }
      if (address) {
        throw new BadRequestException(`${label}: an address cannot accompany kind LOCATION`);
      }
      return;
    }
    if (!address) {
      throw new BadRequestException(`${label}: an address is required for kind ADDRESS`);
    }
    if (locationId) {
      throw new BadRequestException(`${label}: a location cannot accompany kind ADDRESS`);
    }
  }

  // Le roster est un réglage de mise en service : seul un profil
  // chauffeur ACTIF (utilisateur staff) peut être affecté.
  private async requireActiveDriver(db: Db, userId: string): Promise<void> {
    const rows: { role: string; active: boolean | null }[] = await db.query(
      `SELECT u.role, dp.active
         FROM users u
         LEFT JOIN driver_profiles dp ON dp.user_id = u.id
        WHERE u.id = $1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('Driver not found');
    if (rows[0].role !== 'staff') {
      throw new BadRequestException('Only staff users can be assigned as drivers');
    }
    if (!rows[0].active) {
      throw new ConflictException('Driver profile is not active (activate it in the roster first)');
    }
  }

  private async nextSeq(db: Db, missionId: string): Promise<number> {
    const rows: { seq: number }[] = await db.query(
      `SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM mission_events WHERE mission_id = $1`,
      [missionId],
    );
    return rows[0].seq;
  }

  private async appendEvent(
    db: Db,
    event: {
      missionId: string;
      seq: number;
      fromState: string | null;
      toState: string | null;
      eventType: string;
      actorId: string | null;
      actorRole: string | null;
      reason: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO mission_events
         (mission_id, seq, from_state, to_state, event_type, actor_id, actor_role, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        event.missionId,
        event.seq,
        event.fromState,
        event.toState,
        event.eventType,
        event.actorId,
        event.actorRole,
        event.reason,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  }

  private async audit(
    db: Db,
    actorId: string,
    action: string,
    missionId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, 'transport_mission', $3, $4::jsonb)`,
      [actorId, action, missionId, JSON.stringify(values)],
    );
  }

  private async loadRow(db: Db, missionId: string): Promise<Record<string, unknown>> {
    const rows: Record<string, unknown>[] = await db.query(
      `SELECT ${MISSION_COLUMNS} ${MISSION_LABELS} ${MISSION_JOINS} WHERE m.id = $1`,
      [missionId],
    );
    if (!rows[0]) throw new NotFoundException('Mission not found');
    return rows[0];
  }

  // ---- Administration ----

  async create(actorId: string, dto: CreateMissionDto): Promise<Record<string, unknown>> {
    this.assertPointShape('origin', dto.originKind, dto.originLocationId, dto.originAddress);
    this.assertPointShape(
      'destination',
      dto.destinationKind,
      dto.destinationLocationId,
      dto.destinationAddress,
    );
    if (dto.type !== 'REPOSITIONING' && !dto.reservationNumber) {
      throw new BadRequestException(
        'reservationNumber is required for DELIVERY and COLLECTION missions',
      );
    }
    const plannedStart = new Date(dto.plannedStart);
    const plannedEnd = new Date(dto.plannedEnd);
    if (!(plannedEnd > plannedStart)) {
      throw new BadRequestException('plannedEnd must be after plannedStart');
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Réservation liée : la mission transporte SON véhicule.
      let reservationId: string | null = null;
      if (dto.reservationNumber) {
        const reservations: { id: string; vehicleId: string; status: string }[] =
          await manager.query(
            `SELECT id, vehicle_id AS "vehicleId", status
               FROM reservations
              WHERE reservation_number = $1
              FOR UPDATE`,
            [dto.reservationNumber.trim().toUpperCase()],
          );
        const reservation = reservations[0];
        if (!reservation) throw new NotFoundException('Reservation not found');
        if (!['pending', 'confirmed', 'converted'].includes(reservation.status)) {
          throw new ConflictException(
            `Reservation cannot be dispatched in status '${reservation.status}'`,
          );
        }
        if (reservation.vehicleId !== dto.vehicleId) {
          throw new ConflictException('Mission vehicle must be the reserved vehicle');
        }
        reservationId = reservation.id;
      }

      // 2. Verrou véhicule : sérialise les créations concurrentes
      //    pour un même véhicule (l'exclusion DB couvre le reste).
      const vehicles: { id: string; status: string }[] = await manager.query(
        `SELECT id, status FROM vehicles WHERE id = $1 FOR UPDATE`,
        [dto.vehicleId],
      );
      if (!vehicles[0]) throw new NotFoundException('Vehicle not found');
      if (vehicles[0].status !== 'active') {
        throw new ConflictException('Vehicle is not active');
      }

      // 3. Engagements du véhicule sur la fenêtre — mêmes listes de
      //    statuts que AvailabilityService.loadBlocks (réservations,
      //    indisponibilités, locations actives), en excluant LA
      //    réservation liée (ainsi que sa location active) : la
      //    mission la sert précisément.
      const blocks: unknown[] = await manager.query(
        `SELECT 1
           FROM reservations
          WHERE vehicle_id = $1
            AND status IN ('pending', 'confirmed', 'converted')
            AND return_at > $2::timestamptz
            AND pickup_at < $3::timestamptz
            AND ($4::uuid IS NULL OR id <> $4::uuid)
          UNION ALL
         SELECT 1
           FROM vehicle_unavailability
          WHERE vehicle_id = $1
            AND ends_at > $2::timestamptz
            AND starts_at < $3::timestamptz
          UNION ALL
         SELECT 1
           FROM rentals l
           JOIN reservations r ON r.id = l.reservation_id
          WHERE r.vehicle_id = $1
            AND l.status = 'active'
            AND l.expected_return_at > $2::timestamptz
            AND l.started_at < $3::timestamptz
            AND ($4::uuid IS NULL OR r.id <> $4::uuid)
          LIMIT 1`,
        [
          dto.vehicleId,
          plannedStart.toISOString(),
          plannedEnd.toISOString(),
          reservationId,
        ],
      );
      if (blocks.length) {
        throw new ConflictException(
          'Vehicle is already committed during this window (reservation, rental or unavailability)',
        );
      }

      // 4. Affectation initiale optionnelle (roster actif exigé).
      let state = 'created';
      if (dto.driverUserId) {
        await this.requireActiveDriver(manager, dto.driverUserId);
        state = 'assigned';
      }

      // 5. INSERT — les exclusions DB (véhicule + chauffeur actifs)
      //    restent la dernière ligne de défense.
      let created: { id: string }[];
      try {
        created = await manager.query(
          `INSERT INTO transport_missions
             (type, reservation_id, vehicle_id,
              origin_kind, origin_location_id, origin_address,
              destination_kind, destination_location_id, destination_address,
              planned_start, planned_end, assigned_driver_id, state, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            dto.type,
            reservationId,
            dto.vehicleId,
            dto.originKind,
            dto.originLocationId ?? null,
            dto.originAddress ? JSON.stringify(dto.originAddress) : null,
            dto.destinationKind,
            dto.destinationLocationId ?? null,
            dto.destinationAddress ? JSON.stringify(dto.destinationAddress) : null,
            plannedStart.toISOString(),
            plannedEnd.toISOString(),
            dto.driverUserId ?? null,
            state,
            actorId,
          ],
        );
      } catch (error) {
        if (isExclusionViolation(error)) {
          throw new ConflictException(
            'Driver or vehicle already has an overlapping active mission',
          );
        }
        throw error;
      }
      const missionId = created[0].id;

      await this.appendEvent(manager, {
        missionId,
        seq: 1,
        fromState: null,
        toState: state,
        eventType: 'created',
        actorId,
        actorRole: 'admin',
        reason: dto.reservationNumber
          ? `Dispatch for ${dto.reservationNumber}`
          : 'Repositioning dispatch',
      });
      await this.audit(manager, actorId, 'MISSION_CREATED', missionId, {
        type: dto.type,
        state,
        vehicleId: dto.vehicleId,
        reservationNumber: dto.reservationNumber ?? null,
        plannedStart: plannedStart.toISOString(),
        plannedEnd: plannedEnd.toISOString(),
      });

      return this.loadRow(manager, missionId);
    });
  }

  async list(query: MissionListQueryDto): Promise<Record<string, unknown>[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (fragment: string, value: unknown) => {
      params.push(value);
      conditions.push(fragment.replace('?', `$${params.length}`));
    };
    if (query.state) push('m.state = ?', query.state);
    if (query.vehicleId) push('m.vehicle_id = ?::uuid', query.vehicleId);
    if (query.driverUserId) push('m.assigned_driver_id = ?::uuid', query.driverUserId);
    if (query.from) push('m.planned_end > ?::timestamptz', new Date(query.from).toISOString());
    if (query.to) push('m.planned_start < ?::timestamptz', new Date(query.to).toISOString());

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(query.limit ?? 50);
    // Le paramètre de limite est interne (entier validé par le DTO) :
    // seul son identifiant `$n` est construit, jamais une valeur.
    return this.dataSource.query(
      `SELECT ${MISSION_COLUMNS} ${MISSION_LABELS} ${MISSION_JOINS}
       ${where}
       ORDER BY m.planned_start DESC, m.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
  }

  async detail(id: string): Promise<{ mission: Record<string, unknown>; events: unknown[] }> {
    const mission = await this.loadRow(this.dataSource, id);
    const events = await this.dataSource.query(
      `SELECT e.id, e.seq, e.from_state AS "fromState", e.to_state AS "toState",
              e.event_type AS "eventType", e.actor_id AS "actorId",
              e.actor_role AS "actorRole", e.server_ts AS "serverTs",
              e.reason, e.metadata,
              CONCAT(u.first_name, ' ', u.last_name) AS "actorName"
         FROM mission_events e
         LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.mission_id = $1
        ORDER BY e.seq`,
      [id],
    );
    return { mission, events };
  }

  async assign(
    actorId: string,
    missionId: string,
    dto: AssignDriverDto,
  ): Promise<Record<string, unknown>> {
    return this.dataSource.transaction(async (manager) => {
      const missions: { id: string; state: string }[] = await manager.query(
        `SELECT id, state FROM transport_missions WHERE id = $1 FOR UPDATE`,
        [missionId],
      );
      const mission = missions[0];
      if (!mission) throw new NotFoundException('Mission not found');
      if (!['created', 'assigned'].includes(mission.state)) {
        throw new ConflictException(
          `Mission cannot be (re)assigned in state '${mission.state}'`,
        );
      }
      await this.requireActiveDriver(manager, dto.driverUserId);

      try {
        await manager.query(
          `UPDATE transport_missions
              SET assigned_driver_id = $2, state = 'assigned',
                  revision = revision + 1, updated_at = now()
            WHERE id = $1`,
          [missionId, dto.driverUserId],
        );
      } catch (error) {
        if (isExclusionViolation(error)) {
          throw new ConflictException(
            'Driver already has an overlapping active mission',
          );
        }
        throw error;
      }

      const seq = await this.nextSeq(manager, missionId);
      await this.appendEvent(manager, {
        missionId,
        seq,
        fromState: mission.state,
        toState: 'assigned',
        eventType: mission.state === 'assigned' ? 'reassigned' : 'assigned',
        actorId,
        actorRole: 'admin',
        reason: null,
      });
      await this.audit(manager, actorId, 'MISSION_ASSIGNED', missionId, {
        driverUserId: dto.driverUserId,
      });
      return this.loadRow(manager, missionId);
    });
  }

  async cancel(
    actorId: string,
    missionId: string,
    dto: MissionActionDto,
  ): Promise<Record<string, unknown>> {
    return this.dataSource.transaction(async (manager) => {
      const missions: { id: string; state: string }[] = await manager.query(
        `SELECT id, state FROM transport_missions WHERE id = $1 FOR UPDATE`,
        [missionId],
      );
      const mission = missions[0];
      if (!mission) throw new NotFoundException('Mission not found');
      if (['completed', 'cancelled', 'failed'].includes(mission.state)) {
        throw new ConflictException(`Mission is already '${mission.state}'`);
      }

      await manager.query(
        `UPDATE transport_missions
            SET state = 'cancelled', revision = revision + 1, updated_at = now()
          WHERE id = $1`,
        [missionId],
      );
      const seq = await this.nextSeq(manager, missionId);
      await this.appendEvent(manager, {
        missionId,
        seq,
        fromState: mission.state,
        toState: 'cancelled',
        eventType: 'cancelled',
        actorId,
        actorRole: 'admin',
        reason: dto.reason?.trim() || null,
      });
      await this.audit(manager, actorId, 'MISSION_CANCELLED', missionId, {
        fromState: mission.state,
        reason: dto.reason?.trim() || null,
      });
      return this.loadRow(manager, missionId);
    });
  }

  // ---- Côté chauffeur ----

  async driverMissions(driverId: string, limit = 50): Promise<Record<string, unknown>[]> {
    return this.dataSource.query(
      `SELECT ${MISSION_COLUMNS} ${MISSION_LABELS} ${MISSION_JOINS}
        WHERE m.assigned_driver_id = $1
        ORDER BY CASE WHEN m.state IN ('assigned', 'accepted', 'in_progress', 'paused')
                      THEN 0 ELSE 1 END,
                 m.planned_start DESC
        LIMIT $2`,
      [driverId, limit],
    );
  }

  async transition(
    actorId: string,
    missionId: string,
    action: DriverTransition,
    dto: MissionActionDto,
  ): Promise<Record<string, unknown>> {
    const rule = DRIVER_TRANSITIONS[action];
    if (!rule) throw new BadRequestException('Unknown mission action');

    return this.dataSource.transaction(async (manager) => {
      const missions: {
        id: string;
        state: string;
        type: string;
        vehicleId: string;
        assignedDriverId: string | null;
        reservationId: string | null;
        originKind: string;
        destinationKind: string;
        destinationLocationId: string | null;
        destinationAddress: unknown;
        missionNumber: string;
      }[] = await manager.query(
        `SELECT m.id, m.state, m.type, m.mission_number AS "missionNumber",
                m.vehicle_id AS "vehicleId", m.assigned_driver_id AS "assignedDriverId",
                m.reservation_id AS "reservationId",
                m.origin_kind AS "originKind", m.destination_kind AS "destinationKind",
                m.destination_location_id AS "destinationLocationId",
                m.destination_address AS "destinationAddress"
           FROM transport_missions m
          WHERE m.id = $1 FOR UPDATE OF m`,
        [missionId],
      );
      const mission = missions[0];
      if (!mission) throw new NotFoundException('Mission not found');
      if (!rule.from.includes(mission.state)) {
        throw new ConflictException(
          `Cannot ${action} a mission in state '${mission.state}'`,
        );
      }
      if (mission.assignedDriverId !== actorId) {
        throw new ForbiddenException('Mission is not assigned to you');
      }
      if (action === 'accept') {
        const drivers: { active: boolean | null }[] = await manager.query(
          `SELECT active FROM driver_profiles WHERE user_id = $1`,
          [actorId],
        );
        if (!drivers[0]?.active) {
          throw new ConflictException('Driver profile is not active');
        }
      }

      // Verrou véhicule (ordre : mission puis véhicule, partout) —
      // nécessaire pour figer la position avant l'événement final.
      const vehicles: { currentLocationId: string | null }[] = await manager.query(
        `SELECT current_location_id AS "currentLocationId"
           FROM vehicles WHERE id = $1 FOR UPDATE`,
        [mission.vehicleId],
      );

      await manager.query(
        `UPDATE transport_missions
            SET state = $2,
                distance_km = COALESCE($3::numeric, distance_km),
                revision = revision + 1,
                updated_at = now()
          WHERE id = $1`,
        [missionId, rule.to, dto.distanceKm ?? null],
      );

      const seq = await this.nextSeq(manager, missionId);
      await this.appendEvent(manager, {
        missionId,
        seq,
        fromState: mission.state,
        toState: rule.to,
        eventType: action,
        actorId,
        actorRole: 'staff',
        reason: dto.reason?.trim() || null,
        metadata: dto.distanceKm !== undefined ? { distanceKm: dto.distanceKm } : {},
      });

      // Registre physique : seul l'achèvement déplace la position du
      // véhicule (vers la destination prévue de la mission). Un échec
      // ne déplace rien — la position réelle reste inconnue, jamais
      // supposée.
      if (action === 'complete') {
        await recordVehicleLocation(manager, {
          vehicleId: mission.vehicleId,
          eventKind:
            mission.type === 'REPOSITIONING' ? 'mission_reposition' : 'mission_parked_confirmed',
          fromLocationId: vehicles[0]?.currentLocationId ?? null,
          toLocationId:
            mission.destinationKind === 'LOCATION' ? mission.destinationLocationId : null,
          toAddress: mission.destinationKind === 'ADDRESS' ? mission.destinationAddress : undefined,
          missionId,
          reservationId: mission.reservationId,
          actorId,
          source: 'driver',
          note: `Mission ${mission.missionNumber} completed`,
        });
      }

      return this.loadRow(manager, missionId);
    });
  }
}
