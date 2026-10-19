
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import {
    InjectRepository,
} from '@nestjs/typeorm';

import {
    DataSource,
    IsNull,
    QueryFailedError,
    Repository,
} from 'typeorm';

// Entité et statuts des réservations.
import {
    Reservation,
    ReservationStatus,
} from './entities/reservation.entity.js';

// Profil et permis de conduire du client.
import {
    CustomerProfile,
} from '../customer-profiles/entities/customer-profile.entity.js';

// Entité et statut des voitures.
import {
    Vehicle,
    VehicleStatus,
} from '../vehicles/entities/vehicle.entity.js';

// DTOs de gestion des blocs de maintenance.
import {
    CreateVehicleBlockDto,
    UpdateVehicleBlockDto,
} from './dto/vehicle-block.dto.js';

// DTO de modification d'une réservation.
import type {
    UpdateReservationDto,
} from './dto/update-reservation.dto.js';

// Devis autoritaire (prix recalculés côté serveur).
import {
    PremiumService,
} from '../premium/premium.service.js';

// Service canonique de disponibilité (lieux, horaires, conflits).
import {
    AvailabilityService,
} from '../availability/availability.service.js';

@Injectable()
export class ReservationsAdminService {
    constructor(
        // Accès à la table reservations.
        @InjectRepository(Reservation)
        private readonly reservationsRepository:
            Repository<Reservation>,

        // Connexion PostgreSQL pour les transactions.
        private readonly dataSource: DataSource,

        // Devis canonique : jamais de montant fourni par le navigateur.
        private readonly premium: PremiumService,

        // Évaluation canonique de la disponibilité.
        private readonly availability: AvailabilityService,
    ) { }

    // ==========================================
    // 1. CONSULTER LES RÉSERVATIONS EN ATTENTE
    // ==========================================

    async findPendingReservations():
        Promise<Reservation[]> {

        // Récupérer uniquement les réservations
        // dont le statut est pending, en excluant
        // celles déjà archivées par l'administration.
        const rows=await this.reservationsRepository.find({
            where: {
                status: ReservationStatus.PENDING,
                archivedAt: IsNull(),
            },

            // Afficher les plus anciennes en premier.
            order: {
                createdAt: 'ASC',
            },
        });
        return this.withLocationDetails(rows);
    }

    // Afficher tous les statuts pour une administration complète.
    async findAllReservations(): Promise<Reservation[]> {
        const rows=await this.reservationsRepository.find({
            order: { createdAt: 'DESC' },
        });
        return this.withLocationDetails(rows);
    }

    // Enrichissement de lecture : libellés figés, sans altérer le schéma Reservation.
    private async withLocationDetails(rows:Reservation[]):Promise<Reservation[]> {
        if(!rows.length)return rows;
        const details:{reservationId:string;pickupLocation:string|null;dropoffLocation:string|null}[]=
          await this.dataSource.query(`SELECT reservation_id AS "reservationId",
            pickup_location_snapshot AS "pickupLocation",dropoff_location_snapshot AS "dropoffLocation"
            FROM reservation_preferences WHERE reservation_id=ANY($1::uuid[])`,[rows.map(r=>r.id)]);
        const map=new Map(details.map(x=>[x.reservationId,x]));
        for(const r of rows)Object.assign(r,{
            pickupLocation:map.get(r.id)?.pickupLocation??null,
            dropoffLocation:map.get(r.id)?.dropoffLocation??null,
        });
        return rows;
    }

    // Récupérer les périodes d'indisponibilité pour le calendrier.
    async getUnavailability(month: string): Promise<unknown[]> {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw new BadRequestException('Invalid month. Expected YYYY-MM.');
        }
        const [year, index] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, index - 1, 1));
        const end = new Date(Date.UTC(year, index, 1));
        return this.dataSource.query(
            `SELECT u.id AS "id", u.vehicle_id AS "vehicleId", u.starts_at AS "startsAt",
                    u.ends_at AS "endsAt", u.reason, u.notes,
                    u.created_at AS "createdAt"
             FROM vehicle_unavailability u
             WHERE u.starts_at < $2::timestamptz
               AND u.ends_at > $1::timestamptz
             ORDER BY u.starts_at ASC`,
            [start.toISOString(), end.toISOString()],
        );
    }

    // ==========================================
    // 1.b BLOQUER UN VÉHICULE (MAINTENANCE/RÉPARATION)
    // ==========================================

    async createUnavailability(
        adminId: string,
        dto: CreateVehicleBlockDto,
    ): Promise<unknown> {
        const startsAt = new Date(dto.startsAt);
        const endsAt = new Date(dto.endsAt);
        if (
            Number.isNaN(startsAt.getTime()) ||
            Number.isNaN(endsAt.getTime())
        ) {
            throw new BadRequestException('Invalid maintenance period');
        }
        if (endsAt <= startsAt) {
            throw new BadRequestException('The end must be after the start');
        }

        const vehicles: { id: string }[] = await this.dataSource.query(
            `SELECT id FROM vehicles WHERE id = $1::uuid`,
            [dto.vehicleId],
        );
        if (!vehicles[0]) {
            throw new NotFoundException('Vehicle not found');
        }

        try {
            const rows = await this.dataSource.query(
                `INSERT INTO vehicle_unavailability
                   (vehicle_id, starts_at, ends_at, reason, notes, created_by)
                 VALUES ($1::uuid, $2::timestamptz, $3::timestamptz, $4::unavailability_reason, $5, $6::uuid)
                 RETURNING id, vehicle_id AS "vehicleId", starts_at AS "startsAt",
                           ends_at AS "endsAt", reason, notes`,
                [
                    dto.vehicleId,
                    startsAt.toISOString(),
                    endsAt.toISOString(),
                    dto.reason,
                    dto.notes?.trim() || null,
                    adminId,
                ],
            );
            return rows[0];
        } catch (error) {
            this.rethrowBlockConflict(error);
        }
    }

    // ==========================================
    // 1.c MODIFIER UN BLOC DE MAINTENANCE
    // ==========================================

    async updateUnavailability(
        id: string,
        dto: UpdateVehicleBlockDto,
    ): Promise<unknown> {
        const existing: {
            id: string;
            startsAt: Date;
            endsAt: Date;
        }[] = await this.dataSource.query(
            `SELECT id, starts_at AS "startsAt", ends_at AS "endsAt"
             FROM vehicle_unavailability WHERE id = $1::uuid`,
            [id],
        );
        if (!existing[0]) {
            throw new NotFoundException('Maintenance block not found');
        }

        const startsAt = dto.startsAt
            ? new Date(dto.startsAt)
            : new Date(existing[0].startsAt);
        const endsAt = dto.endsAt
            ? new Date(dto.endsAt)
            : new Date(existing[0].endsAt);
        if (
            Number.isNaN(startsAt.getTime()) ||
            Number.isNaN(endsAt.getTime())
        ) {
            throw new BadRequestException('Invalid maintenance period');
        }
        if (endsAt <= startsAt) {
            throw new BadRequestException('The end must be after the start');
        }

        try {
            // Sémantique PATCH : un champ absent est conservé ; un champ
            // fourni (texte, chaîne vide ou null) est appliqué. Le drapeau
            // booléen distingue « absent » de « volontairement vidé ».
            const notesProvided = dto.notes !== undefined;
            const notesValue =
                typeof dto.notes === 'string'
                    ? dto.notes.trim() || null
                    : null;
            const result = await this.dataSource.query(
                `UPDATE vehicle_unavailability
                 SET starts_at = $2::timestamptz,
                     ends_at = $3::timestamptz,
                     reason = COALESCE($4::unavailability_reason, reason),
                     notes = CASE WHEN $6::boolean THEN $5 ELSE notes END
                 WHERE id = $1::uuid
                 RETURNING id, vehicle_id AS "vehicleId", starts_at AS "startsAt",
                           ends_at AS "endsAt", reason, notes`,
                [
                    id,
                    startsAt.toISOString(),
                    endsAt.toISOString(),
                    dto.reason ?? null,
                    notesValue,
                    notesProvided,
                ],
            );
            // TypeORM 1.x : UPDATE ... RETURNING renvoie [lignes, nombre].
            const rows: {
                id: string;
                vehicleId: string;
                startsAt: Date;
                endsAt: Date;
                reason: string;
                notes: string | null;
            }[] = Array.isArray(result?.[0]) ? result[0] : result;
            if (!rows[0]) {
                throw new NotFoundException('Maintenance block not found');
            }
            return rows[0];
        } catch (error) {
            this.rethrowBlockConflict(error);
        }
    }

    // ==========================================
    // 1.d LIBÉRER UN BLOC DE MAINTENANCE
    // ==========================================

    // Retire le bloc : le véhicule redevient planifiable. Aucune
    // réservation n'est supprimée et aucun client n'est affecté.
    //
    // La libération est NON DESTRUCTIVE pour la traçabilité : le
    // contenu du bloc est d'abord copié dans le journal d'audit
    // `vehicle_unavailability_audit`, puis le bloc actif est supprimé,
    // le tout dans UNE SEULE transaction. La ligne est verrouillée
    // (FOR UPDATE) pour éviter toute incohérence concurrente. Si
    // l'insertion d'audit échoue, la suppression est annulée.
    async releaseUnavailability(
        id: string,
        adminId: string,
        reason?: string,
    ): Promise<{ released: number }> {
        return this.dataSource.transaction(async (manager) => {
            const rows: {
                id: string;
                vehicleId: string;
                startsAt: Date;
                endsAt: Date;
                reason: string;
                notes: string | null;
                createdBy: string | null;
                createdAt: Date | null;
            }[] = await manager.query(
                `SELECT id,
                        vehicle_id AS "vehicleId",
                        starts_at AS "startsAt",
                        ends_at AS "endsAt",
                        reason,
                        notes,
                        created_by AS "createdBy",
                        created_at AS "createdAt"
                 FROM vehicle_unavailability
                 WHERE id = $1::uuid
                 FOR UPDATE`,
                [id],
            );
            const block = rows[0];
            if (!block) {
                throw new NotFoundException(
                    'Maintenance block not found',
                );
            }

            // 1) Copier la trace AVANT toute suppression. ON CONFLICT
            //    neutralise tout doublon (libération répétée / rejeu)
            //    sans jamais écraser l'historique existant.
            await manager.query(
                `INSERT INTO vehicle_unavailability_audit
                   (unavailability_id, vehicle_id, starts_at, ends_at,
                    reason, notes, created_by, created_at,
                    released_by, release_reason)
                 VALUES ($1::uuid, $2::uuid, $3::timestamptz,
                         $4::timestamptz, $5::unavailability_reason,
                         $6, $7::uuid, $8::timestamptz, $9::uuid, $10)
                 ON CONFLICT (unavailability_id) DO NOTHING`,
                [
                    block.id,
                    block.vehicleId,
                    block.startsAt,
                    block.endsAt,
                    block.reason,
                    block.notes,
                    block.createdBy,
                    block.createdAt,
                    adminId,
                    reason?.trim() || null,
                ],
            );

            // 2) Retirer le bloc actif : le véhicule redevient
            //    planifiable dès la validation de la transaction.
            const deletedResult = await manager.query(
                `DELETE FROM vehicle_unavailability
                 WHERE id = $1::uuid
                 RETURNING id`,
                [id],
            );
            // TypeORM 1.x : DELETE ... RETURNING renvoie [lignes, nombre].
            const deleted: { id: string }[] =
                Array.isArray(deletedResult?.[0])
                    ? deletedResult[0]
                    : deletedResult;
            if (!deleted[0]) {
                // Course concurrente : le bloc a déjà été libéré.
                throw new NotFoundException(
                    'Maintenance block not found',
                );
            }
            return { released: 1 };
        });
    }

    // ==========================================
    // 1.e HISTORIQUE DES BLOCS LIBÉRÉS (AUDIT)
    // ==========================================

    // Liste des blocs de maintenance libérés, lue dans le journal
    // d'audit immuable. Filtrage facultatif par mois (chevauchement).
    // Réservée aux administrateurs par le contrôleur.
    async getUnavailabilityHistory(
        month?: string,
    ): Promise<unknown[]> {
        let start: string | null = null;
        let end: string | null = null;

        if (month !== undefined && month !== null && month !== '') {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
                throw new BadRequestException(
                    'Invalid month. Expected YYYY-MM.',
                );
            }
            const [year, index] = month.split('-').map(Number);
            start = new Date(Date.UTC(year, index - 1, 1)).toISOString();
            end = new Date(Date.UTC(year, index, 1)).toISOString();
        }

        const params: string[] = start && end ? [start, end] : [];
        const overlap = start && end
            ? `WHERE a.starts_at < $2::timestamptz
                 AND a.ends_at > $1::timestamptz`
            : '';

        return this.dataSource.query(
            `SELECT a.id AS "id",
                    a.unavailability_id AS "unavailabilityId",
                    a.vehicle_id AS "vehicleId",
                    a.starts_at AS "startsAt",
                    a.ends_at AS "endsAt",
                    a.reason,
                    a.notes,
                    a.created_at AS "createdAt",
                    a.released_at AS "releasedAt",
                    a.release_reason AS "releaseReason",
                    TRIM(CONCAT(u.first_name, ' ', u.last_name))
                        AS "releasedByName"
             FROM vehicle_unavailability_audit a
             LEFT JOIN users u ON u.id = a.released_by
             ${overlap}
             ORDER BY a.released_at DESC
             LIMIT 200`,
            params,
        );
    }

    // Traduire les conflits PostgreSQL (exclusion GiST et trigger
    // réservation) en erreurs HTTP explicites, jamais en 500.
    private rethrowBlockConflict(error: unknown): never {
        if (error instanceof QueryFailedError) {
            const code = (
                error.driverError as { code?: string } | undefined
            )?.code;
            if (code === '23P01') {
                throw new ConflictException(
                    'This period overlaps an existing reservation or another maintenance block.',
                );
            }
        }
        throw error;
    }

    // ==========================================
    // 2. REFUSER UNE RÉSERVATION
    // ==========================================

    async rejectReservation(
        reservationNumber: string,
        adminId: string,
        reason: string,
    ): Promise<Reservation> {

        // Nettoyer le numéro commercial.
        const number =
            reservationNumber.trim().toUpperCase();

        // Exécuter l'opération dans une transaction.
        return this.dataSource.transaction(
            async (manager) => {

                const repository =
                    manager.getRepository(Reservation);

                // Chercher et verrouiller la réservation
                // pendant la décision administrative.
                const reservation =
                    await repository.findOne({
                        where: {
                            reservationNumber: number,
                        },

                        lock: {
                            mode: 'pessimistic_write',
                        },
                    });

                // La réservation doit exister.
                if (!reservation) {
                    throw new NotFoundException(
                        'Reservation not found',
                    );
                }

                // Seule une réservation en attente
                // peut être refusée.
                if (
                    reservation.status !==
                    ReservationStatus.PENDING
                ) {
                    throw new ConflictException(
                        'Only pending reservations can be rejected',
                    );
                }

                // Enregistrer la décision.
                reservation.status =
                    ReservationStatus.REJECTED;

                reservation.decidedBy =
                    adminId;

                reservation.decidedAt =
                    new Date();

                reservation.decisionReason =
                    reason.trim();

                // Conserver la réservation et son historique.
                return repository.save(
                    reservation,
                );
            },
        );
    }

    // ==========================================
    // 3. CONFIRMER UNE RÉSERVATION
    // ==========================================

    async confirmReservation(
        reservationNumber: string,
        adminId: string,
    ): Promise<Reservation> {

        // Nettoyer le numéro de réservation.
        const number =
            reservationNumber.trim().toUpperCase();

        // Utiliser une transaction afin d'éviter
        // deux décisions simultanées.
        return this.dataSource.transaction(
            async (manager) => {

                const reservationRepository =
                    manager.getRepository(Reservation);

                // --------------------------------------
                // A. CHERCHER LA RÉSERVATION
                // --------------------------------------

                // Le verrou empêche une annulation
                // ou un refus simultané.
                const reservation =
                    await reservationRepository.findOne({
                        where: {
                            reservationNumber: number,
                        },

                        lock: {
                            mode: 'pessimistic_write',
                        },
                    });

                if (!reservation) {
                    throw new NotFoundException(
                        'Reservation not found',
                    );
                }

                // --------------------------------------
                // B. VÉRIFIER LE STATUT
                // --------------------------------------

                // Nous ne confirmons que les
                // réservations encore en attente.
                if (
                    reservation.status !==
                    ReservationStatus.PENDING
                ) {
                    throw new ConflictException(
                        'Only pending reservations can be confirmed',
                    );
                }

                // --------------------------------------
                // C. VÉRIFIER LA DATE DE DÉPART
                // --------------------------------------

                // Une réservation dont le départ
                // est déjà passé ne peut pas
                // être confirmée.
                if (
                    reservation.pickupAt <= new Date()
                ) {
                    throw new ConflictException(
                        'Pickup date has already passed',
                    );
                }

                // --------------------------------------
                // D. VÉRIFIER LE PROFIL CLIENT
                // --------------------------------------

                const profileRepository =
                    manager.getRepository(CustomerProfile);

                const profile =
                    await profileRepository.findOne({
                        where: {
                            userId: reservation.customerId,
                        },
                    });

                if (!profile) {
                    throw new ConflictException(
                        'Customer profile is missing',
                    );
                }

                // --------------------------------------
                // E. VÉRIFIER AUTOMATIQUEMENT LE PERMIS
                // --------------------------------------

                // La validation manuelle du permis par
                // l'administrateur a été supprimée.
                //
                // Le système vérifie directement que les
                // informations essentielles du permis sont
                // présentes dans le profil client.
                if (
                    !profile.licenseNumber?.trim() ||
                    !profile.licenseCountry?.trim() ||
                    !profile.licenseIssuedOn ||
                    !profile.licenseExpiresOn
                ) {
                    throw new ConflictException(
                        'Customer driving license information is incomplete',
                    );
                }

                // Récupérer la date de retour
                // au format AAAA-MM-JJ.
                const returnDate =
                    reservation.returnAt
                        .toISOString()
                        .slice(0, 10);

                // Le permis doit rester valide pendant
                // toute la période de location.
                if (
                    profile.licenseExpiresOn < returnDate
                ) {
                    throw new ConflictException(
                        'Driving license expires before the return date',
                    );
                }

                // --------------------------------------
                // F. VÉRIFIER LE STATUT DE LA VOITURE
                // --------------------------------------

                const vehicleRepository =
                    manager.getRepository(Vehicle);

                const vehicle =
                    await vehicleRepository.findOne({
                        where: {
                            id: reservation.vehicleId,
                        },
                    });

                if (!vehicle) {
                    throw new NotFoundException(
                        'Reserved vehicle not found',
                    );
                }

                // Une voiture en maintenance ou retirée
                // ne peut pas être confirmée.
                if (
                    vehicle.status !==
                    VehicleStatus.ACTIVE
                ) {
                    throw new ConflictException(
                        'Vehicle is not active',
                    );
                }

                // --------------------------------------
                // G. CONFIRMER LA RÉSERVATION
                // --------------------------------------

                reservation.status =
                    ReservationStatus.CONFIRMED;

                // Conserver l'administrateur
                // responsable de la confirmation.
                reservation.decidedBy =
                    adminId;

                // Enregistrer la date de confirmation.
                reservation.decidedAt =
                    new Date();

                // Aucun motif de refus.
                reservation.decisionReason =
                    null;

                // --------------------------------------
                // H. ENREGISTRER DANS POSTGRESQL
                // --------------------------------------

                // Le trigger PostgreSQL actualisera
                // automatiquement updated_at.
                return reservationRepository.save(
                    reservation,
                );
            },
        );
    }

    // ==========================================
    // 3.b MODIFIER UNE RÉSERVATION PLANIFIABLE
    // ==========================================

    // L'administration peut corriger une réservation en attente ou
    // confirmée tant que la location n'a pas commencé. Toutes les
    // règles de réservation restent appliquées (véhicule actif, lieu
    // autorisé, même pays, horaires d'ouverture, validité du permis,
    // chevauchements et délai de remise en service) et les prix sont
    // recalculés par le devis canonique. Aucun montant client n'est
    // accepté et aucun historique financier n'est modifié.
    async updateReservation(
        reservationNumber: string,
        dto: UpdateReservationDto,
    ): Promise<{
        reservation: Reservation;
        priceDifference: string;
    }> {
        const number = reservationNumber.trim().toUpperCase();

        // --------------------------------------
        // A. CHARGER ET QUALIFIER LA RÉSERVATION
        // --------------------------------------
        const current = await this.reservationsRepository.findOne({
            where: { reservationNumber: number },
        });
        if (!current) throw new NotFoundException('Reservation not found');

        // Seules les réservations encore planifiables sont modifiables.
        if (
            current.status !== ReservationStatus.PENDING &&
            current.status !== ReservationStatus.CONFIRMED
        ) {
            throw new ConflictException(
                'Only pending or confirmed reservations can be modified',
            );
        }
        if (current.pickupAt <= new Date()) {
            throw new ConflictException(
                'A reservation whose rental has started cannot be modified',
            );
        }

        // Une réservation déjà convertie en contrat de location relève du
        // workflow location/prolongation : jamais de modification ici, afin
        // de ne jamais altérer un historique financier engagé.
        const rentals: { id: string }[] = await this.dataSource.query(
            `SELECT id FROM rentals WHERE reservation_id = $1::uuid LIMIT 1`,
            [current.id],
        );
        if (rentals[0]) {
            throw new ConflictException(
                'This reservation already has a rental contract and must be handled from the rental workflow',
            );
        }

        // Logistique figée au moment de la réservation.
        const preferences: {
            pickupLocationId: string | null;
            dropoffLocationId: string | null;
            pickupMethod: string | null;
            deliveryAddress: string | null;
            pickupAddress: string | null;
            dropoffAddress: string | null;
        }[] = await this.dataSource.query(
            `SELECT pickup_location_id AS "pickupLocationId",
                    dropoff_location_id AS "dropoffLocationId",
                    pickup_method AS "pickupMethod",
                    delivery_address AS "deliveryAddress",
                    pickup_address AS "pickupAddress",
                    dropoff_address AS "dropoffAddress"
             FROM reservation_preferences WHERE reservation_id = $1::uuid`,
            [current.id],
        );
        const saved = preferences[0] ?? null;

        // Options déjà souscrites : conservées telles quelles.
        const extraRows: { extraId: string }[] = await this.dataSource.query(
            `SELECT extra_id AS "extraId" FROM reservation_extras WHERE reservation_id = $1::uuid`,
            [current.id],
        );

        // --------------------------------------
        // B. FUSIONNER ET VALIDER LES NOUVELLES VALEURS
        // --------------------------------------
        const vehicleId = dto.vehicleId ?? current.vehicleId;
        const pickupAt = dto.pickupAt
            ? new Date(dto.pickupAt)
            : new Date(current.pickupAt);
        const returnAt = dto.returnAt
            ? new Date(dto.returnAt)
            : new Date(current.returnAt);
        if (
            Number.isNaN(pickupAt.getTime()) ||
            Number.isNaN(returnAt.getTime())
        ) {
            throw new BadRequestException('Invalid new rental period');
        }
        if (returnAt.getTime() <= pickupAt.getTime()) {
            throw new BadRequestException(
                'The return must be after the pickup',
            );
        }
        if (pickupAt.getTime() <= Date.now()) {
            throw new BadRequestException(
                'The pickup must remain in the future',
            );
        }

        const pickupLocationId =
            dto.pickupLocationId ?? saved?.pickupLocationId ?? null;
        if (!pickupLocationId) {
            throw new BadRequestException(
                'A pickup location is required to modify a reservation',
            );
        }
        const dropoffLocationId =
            dto.dropoffLocationId ?? saved?.dropoffLocationId ?? pickupLocationId;

        // Seuls les points « custom » acceptent une adresse libre ; le
        // devis refuse toute adresse sur un point standard. On ne transmet
        // donc l'adresse figée que lorsqu'elle est légitime.
        const locationCategories: { id: string; category: string }[] =
            await this.dataSource.query(
                `SELECT id, category FROM rental_locations
                 WHERE id IN ($1::uuid, $2::uuid)`,
                [pickupLocationId, dropoffLocationId],
            );
        const pickupIsCustom =
            locationCategories.find((row) => row.id === pickupLocationId)
                ?.category === 'custom';
        const dropoffIsCustom =
            locationCategories.find((row) => row.id === dropoffLocationId)
                ?.category === 'custom';

        // Le permis doit rester valide pendant toute la nouvelle période.
        const profiles: { licenseExpiresOn: string | null }[] =
            await this.dataSource.query(
                `SELECT license_expires_on AS "licenseExpiresOn"
                 FROM customer_profiles WHERE user_id = $1::uuid`,
                [current.customerId],
            );
        const licenceExpiry = profiles[0]?.licenseExpiresOn ?? null;
        if (
            licenceExpiry &&
            licenceExpiry < returnAt.toISOString().slice(0, 10)
        ) {
            throw new ConflictException(
                'The customer driving license expires before the new return date',
            );
        }

        // --------------------------------------
        // C. RÉÉVALUER LA DISPONIBILITÉ (hors réservation courante)
        // --------------------------------------
        const availability = await this.availability.check({
            vehicleId,
            pickupLocationId,
            dropoffLocationId,
            pickupAt: pickupAt.toISOString(),
            returnAt: returnAt.toISOString(),
            excludeReservationId: current.id,
        });
        if (!availability.available) {
            throw new ConflictException(
                availability.message ??
                    'The new period is unavailable for this vehicle',
            );
        }

        // --------------------------------------
        // D. RECALCULER LE DEVIS AUTORITAIRE
        // --------------------------------------
        const quote = await this.premium.quote({
            vehicleId,
            pickupAt: pickupAt.toISOString(),
            returnAt: returnAt.toISOString(),
            extraIds: extraRows.map((row) => row.extraId),
            promotionCode: current.promotionCode ?? undefined,
            pickupLocationId,
            dropoffLocationId,
            pickupMethod:
                (saved?.pickupMethod as
                    | 'branch'
                    | 'airport'
                    | 'hotel'
                    | undefined) ?? undefined,
            deliveryAddress:
                saved?.pickupMethod === 'hotel'
                    ? saved?.deliveryAddress ?? undefined
                    : undefined,
            pickupAddress: pickupIsCustom
                ? saved?.pickupAddress ?? undefined
                : undefined,
            dropoffAddress: dropoffIsCustom
                ? saved?.dropoffAddress ?? undefined
                : undefined,
        });

        const priceDifference = (
            Number(quote.totalAmount) - Number(current.totalAmount)
        ).toFixed(2);

        // --------------------------------------
        // E. APPLIQUER DANS UNE TRANSACTION VERROUILLÉE
        // --------------------------------------
        try {
            const reservation = await this.dataSource.transaction(
                async (manager) => {
                    const repository = manager.getRepository(Reservation);

                    // Verrou : empêche deux modifications simultanées.
                    const locked = await repository.findOne({
                        where: { reservationNumber: number },
                        lock: { mode: 'pessimistic_write' },
                    });
                    if (!locked) {
                        throw new NotFoundException('Reservation not found');
                    }
                    if (
                        locked.status !== ReservationStatus.PENDING &&
                        locked.status !== ReservationStatus.CONFIRMED
                    ) {
                        throw new ConflictException(
                            'Only pending or confirmed reservations can be modified',
                        );
                    }
                    if (locked.pickupAt <= new Date()) {
                        throw new ConflictException(
                            'A reservation whose rental has started cannot be modified',
                        );
                    }

                    const vehicles: {
                        daily_price: string;
                        security_deposit: string;
                    }[] = await manager.query(
                        `SELECT daily_price, security_deposit FROM vehicles
                         WHERE id = $1::uuid AND status = 'active'`,
                        [vehicleId],
                    );
                    if (!vehicles[0]) {
                        throw new ConflictException(
                            'Selected vehicle is not active',
                        );
                    }

                    // Valeurs figées recalculées, jamais fournies client.
                    locked.vehicleId = vehicleId;
                    locked.pickupAt = pickupAt;
                    locked.returnAt = returnAt;
                    locked.rentalDays = quote.rentalDays;
                    locked.dailyPrice = quote.dailyPrice;
                    locked.depositAmount = quote.depositAmount;
                    locked.totalAmount = quote.totalAmount;
                    locked.extrasAmount = quote.extrasAmount;
                    locked.deliveryAmount = quote.deliveryAmount;
                    locked.discountAmount = quote.discountAmount;
                    locked.promotionCode = quote.promotionCode;
                    await repository.save(locked);

                    // Mettre à jour la logistique et ses libellés figés.
                    await manager.query(
                        `UPDATE reservation_preferences
                         SET pickup_location_id = $2::uuid,
                             dropoff_location_id = $3::uuid,
                             pickup_location_snapshot = $4,
                             dropoff_location_snapshot = $5
                         WHERE reservation_id = $1::uuid`,
                        [
                            locked.id,
                            quote.pickupLocationId,
                            quote.dropoffLocationId,
                            quote.pickupLocationName,
                            quote.dropoffLocationName,
                        ],
                    );

                    // Rafraîchir les montants d'options sur la nouvelle durée.
                    await manager.query(
                        `DELETE FROM reservation_extras WHERE reservation_id = $1::uuid`,
                        [locked.id],
                    );
                    for (const extra of quote.extras) {
                        await manager.query(
                            `INSERT INTO reservation_extras
                               (reservation_id,extra_id,name_snapshot,amount_snapshot,pricing_snapshot,unit_price_snapshot)
                             VALUES($1,$2,$3,$4,$5,$6)`,
                            [
                                locked.id,
                                extra.id,
                                extra.name,
                                extra.total,
                                extra.pricing,
                                extra.unitPrice,
                            ],
                        );
                    }

                    const updated = await repository.findOne({
                        where: { id: locked.id },
                    });
                    if (!updated) {
                        throw new NotFoundException('Reservation not found');
                    }
                    return updated;
                },
            );

            return { reservation, priceDifference };
        } catch (error) {
            this.rethrowBlockConflict(error);
        }
    }

    // ==========================================
    // 3.c PRÉVISUALISER UNE MODIFICATION
    // ==========================================

    // Mêmes règles serveur que la modification réelle, mais sans
    // aucune écriture : le front affiche la disponibilité et l'écart
    // de prix avant que l'administrateur confirme.
    async previewReservationEdit(
        reservationNumber: string,
        dto: UpdateReservationDto,
    ): Promise<{
        available: boolean;
        message: string | null;
        currentTotal: string;
        newTotal: string;
        priceDifference: string;
        rentalDays: number;
        dailyPrice: string;
        depositAmount: string;
        pickupLocationName: string | null;
        dropoffLocationName: string | null;
    }> {
        const number = reservationNumber.trim().toUpperCase();
        const current = await this.reservationsRepository.findOne({
            where: { reservationNumber: number },
        });
        if (!current) throw new NotFoundException('Reservation not found');
        if (
            current.status !== ReservationStatus.PENDING &&
            current.status !== ReservationStatus.CONFIRMED
        ) {
            throw new ConflictException(
                'Only pending or confirmed reservations can be modified',
            );
        }
        if (current.pickupAt <= new Date()) {
            throw new ConflictException(
                'A reservation whose rental has started cannot be modified',
            );
        }
        const rentals: { id: string }[] = await this.dataSource.query(
            `SELECT id FROM rentals WHERE reservation_id = $1::uuid LIMIT 1`,
            [current.id],
        );
        if (rentals[0]) {
            throw new ConflictException(
                'This reservation already has a rental contract and must be handled from the rental workflow',
            );
        }

        const preferences: {
            pickupLocationId: string | null;
            dropoffLocationId: string | null;
            pickupMethod: string | null;
            deliveryAddress: string | null;
            pickupAddress: string | null;
            dropoffAddress: string | null;
        }[] = await this.dataSource.query(
            `SELECT pickup_location_id AS "pickupLocationId",
                    dropoff_location_id AS "dropoffLocationId",
                    pickup_method AS "pickupMethod",
                    delivery_address AS "deliveryAddress",
                    pickup_address AS "pickupAddress",
                    dropoff_address AS "dropoffAddress"
             FROM reservation_preferences WHERE reservation_id = $1::uuid`,
            [current.id],
        );
        const saved = preferences[0] ?? null;

        const extraRows: { extraId: string }[] = await this.dataSource.query(
            `SELECT extra_id AS "extraId" FROM reservation_extras WHERE reservation_id = $1::uuid`,
            [current.id],
        );

        const vehicleId = dto.vehicleId ?? current.vehicleId;
        const pickupAt = dto.pickupAt
            ? new Date(dto.pickupAt)
            : new Date(current.pickupAt);
        const returnAt = dto.returnAt
            ? new Date(dto.returnAt)
            : new Date(current.returnAt);
        if (
            Number.isNaN(pickupAt.getTime()) ||
            Number.isNaN(returnAt.getTime())
        ) {
            throw new BadRequestException('Invalid new rental period');
        }
        if (returnAt.getTime() <= pickupAt.getTime()) {
            throw new BadRequestException('The return must be after the pickup');
        }
        if (pickupAt.getTime() <= Date.now()) {
            throw new BadRequestException('The pickup must remain in the future');
        }

        const pickupLocationId =
            dto.pickupLocationId ?? saved?.pickupLocationId ?? null;
        if (!pickupLocationId) {
            throw new BadRequestException(
                'A pickup location is required to modify a reservation',
            );
        }
        const dropoffLocationId =
            dto.dropoffLocationId ?? saved?.dropoffLocationId ?? pickupLocationId;

        // Seuls les points « custom » acceptent une adresse libre ; le
        // devis refuse toute adresse sur un point standard. On ne transmet
        // donc l'adresse figée que lorsqu'elle est légitime.
        const locationCategories: { id: string; category: string }[] =
            await this.dataSource.query(
                `SELECT id, category FROM rental_locations
                 WHERE id IN ($1::uuid, $2::uuid)`,
                [pickupLocationId, dropoffLocationId],
            );
        const pickupIsCustom =
            locationCategories.find((row) => row.id === pickupLocationId)
                ?.category === 'custom';
        const dropoffIsCustom =
            locationCategories.find((row) => row.id === dropoffLocationId)
                ?.category === 'custom';

        const availability = await this.availability.check({
            vehicleId,
            pickupLocationId,
            dropoffLocationId,
            pickupAt: pickupAt.toISOString(),
            returnAt: returnAt.toISOString(),
            excludeReservationId: current.id,
        });

        // Le devis reste calculé même si la période est indisponible,
        // afin d'afficher un écart de prix informatif.
        const quote = await this.premium.quote({
            vehicleId,
            pickupAt: pickupAt.toISOString(),
            returnAt: returnAt.toISOString(),
            extraIds: extraRows.map((row) => row.extraId),
            promotionCode: current.promotionCode ?? undefined,
            pickupLocationId,
            dropoffLocationId,
            pickupMethod:
                (saved?.pickupMethod as
                    | 'branch'
                    | 'airport'
                    | 'hotel'
                    | undefined) ?? undefined,
            deliveryAddress:
                saved?.pickupMethod === 'hotel'
                    ? saved?.deliveryAddress ?? undefined
                    : undefined,
            pickupAddress: pickupIsCustom
                ? saved?.pickupAddress ?? undefined
                : undefined,
            dropoffAddress: dropoffIsCustom
                ? saved?.dropoffAddress ?? undefined
                : undefined,
        });

        return {
            available: availability.available,
            message: availability.message,
            currentTotal: current.totalAmount,
            newTotal: quote.totalAmount,
            priceDifference: (
                Number(quote.totalAmount) - Number(current.totalAmount)
            ).toFixed(2),
            rentalDays: quote.rentalDays,
            dailyPrice: quote.dailyPrice,
            depositAmount: quote.depositAmount,
            pickupLocationName: quote.pickupLocationName,
            dropoffLocationName: quote.dropoffLocationName,
        };
    }

    // ==========================================
    // 4. ARCHIVER UNE RÉSERVATION
    // ==========================================

    // L'archive est purement organisationnelle : elle retire la
    // réservation de la liste de travail sans changer son statut
    // ni la supprimer. L'opération est réversible.
    async archiveReservation(
        reservationNumber: string,
        adminId: string,
    ): Promise<Reservation> {
        return this.setArchived(
            reservationNumber,
            new Date(),
            adminId,
        );
    }

    // ==========================================
    // 5. RESTAURER UNE RÉSERVATION ARCHIVÉE
    // ==========================================

    async restoreReservation(
        reservationNumber: string,
    ): Promise<Reservation> {
        return this.setArchived(
            reservationNumber,
            null,
            null,
        );
    }

    // Bascule commune : archive (date + administrateur) ou
    // restauration (NULL). Opération idempotente et atomique.
    private async setArchived(
        reservationNumber: string,
        archivedAt: Date | null,
        adminId: string | null,
    ): Promise<Reservation> {
        const number =
            reservationNumber.trim().toUpperCase();

        return this.dataSource.transaction(
            async (manager) => {
                const repository =
                    manager.getRepository(Reservation);

                // Verrouiller la ligne le temps de la bascule.
                const reservation =
                    await repository.findOne({
                        where: {
                            reservationNumber: number,
                        },

                        lock: {
                            mode: 'pessimistic_write',
                        },
                    });

                if (!reservation) {
                    throw new NotFoundException(
                        'Reservation not found',
                    );
                }

                // Idempotence : déjà dans l'état demandé,
                // on renvoie la réservation inchangée.
                const alreadyArchived =
                    Boolean(reservation.archivedAt);

                if (archivedAt && alreadyArchived) {
                    return reservation;
                }

                if (!archivedAt && !alreadyArchived) {
                    return reservation;
                }

                // Seules les réservations confirmées ou rejetées
                // peuvent être archivées. Les réservations encore
                // en attente, annulées, expirées ou converties
                // restent visibles dans la liste de travail.
                if (
                    archivedAt &&
                    reservation.status !==
                        ReservationStatus.CONFIRMED &&
                    reservation.status !==
                        ReservationStatus.REJECTED
                ) {
                    throw new BadRequestException(
                        'Only confirmed or rejected reservations can be archived',
                    );
                }

                // --------------------------------------
                // RÈGLE MÉTIER — PAS D'ARCHIVAGE ANTICIPÉ
                // --------------------------------------
                //
                // Une réservation confirmée continue de bloquer la
                // disponibilité du véhicule jusqu'à sa date de retour.
                // L'archiver avant l'échéance la retirerait de la liste
                // de travail alors qu'elle est encore opérationnelle :
                // l'opération est donc refusée côté serveur (jamais
                // seulement dans l'interface React).
                if (
                    archivedAt &&
                    reservation.status === ReservationStatus.CONFIRMED
                ) {
                    // 1) Le retour planifié doit être passé.
                    if (reservation.returnAt > new Date()) {
                        throw new ConflictException(
                            'A confirmed reservation cannot be archived before its scheduled return date.',
                        );
                    }

                    // 2) Aucun contrat de location ne doit être encore
                    //    actif : tant que le véhicule est réellement en
                    //    cours de location, l'archivage reste interdit.
                    const activeRentals: { id: string }[] =
                        await manager.query(
                            `SELECT id FROM rentals
                             WHERE reservation_id = $1::uuid
                               AND status = 'active'
                             LIMIT 1`,
                            [reservation.id],
                        );
                    if (activeRentals[0]) {
                        throw new ConflictException(
                            'This reservation still has an active rental and cannot be archived.',
                        );
                    }
                }

                reservation.archivedAt = archivedAt;
                reservation.archivedBy = archivedAt
                    ? adminId
                    : null;

                return repository.save(reservation);
            },
        );
    }

    // ==========================================
    // 6. SUPPRIMER DÉFINITIVEMENT UNE RÉSERVATION
    // ==========================================

    // Réservé aux réservations annulées : une annulation n'a plus
    // d'utilité opérationnelle et peut être effacée. Les lignes
    // rattachées (préférences, extras, avis) sont retirées en
    // cascade par la base. En revanche, si un contrat de location
    // (rentals) référence encore la réservation, la suppression
    // est refusée afin de préserver l'historique financier.
    async deleteReservation(
        reservationNumber: string,
    ): Promise<{ deleted: true }> {
        const number =
            reservationNumber.trim().toUpperCase();

        return this.dataSource.transaction(
            async (manager) => {
                const repository =
                    manager.getRepository(Reservation);

                // Verrouiller la ligne le temps de la suppression.
                const reservation =
                    await repository.findOne({
                        where: {
                            reservationNumber: number,
                        },

                        lock: {
                            mode: 'pessimistic_write',
                        },
                    });

                if (!reservation) {
                    throw new NotFoundException(
                        'Reservation not found',
                    );
                }

                // Seules les réservations annulées peuvent
                // être supprimées définitivement.
                if (
                    reservation.status !==
                    ReservationStatus.CANCELLED
                ) {
                    throw new ConflictException(
                        'Only cancelled reservations can be deleted',
                    );
                }

                try {
                    await repository.remove(reservation);
                } catch (error) {
                    if (this.isForeignKeyViolation(error)) {
                        throw new ConflictException(
                            'This reservation is linked to a rental contract and cannot be deleted.',
                        );
                    }

                    throw error;
                }

                return { deleted: true };
            },
        );
    }

    // Détecte une violation de clé étrangère PostgreSQL
    // (code 23503) remontée par TypeORM.
    private isForeignKeyViolation(error: unknown): boolean {
        return (
            error instanceof QueryFailedError &&
            (
                error as QueryFailedError & {
                    driverError?: { code?: string };
                }
            ).driverError?.code === '23503'
        );
    }
}

