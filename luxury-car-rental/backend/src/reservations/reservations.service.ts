import { PremiumService } from '../premium/premium.service.js';
import { AvailabilityService } from '../availability/availability.service.js';
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
    EntityManager,
    QueryFailedError,
    Repository,
} from 'typeorm';

// Devis de livraison persistés (additionnel) : revalidation et
// réclamation atomique à la réservation.
import {
    assertQuoteMatchesFreshTotal,
    buildSideFingerprint,
    markQuoteAccepted,
    validateQuoteForBooking,
} from '../delivery/delivery.queries.js';

// Fuseaux contractuels des points de service (additionnel).
import {
    zoneTimezoneFor,
    zonedParts,
} from '../zones/zones.queries.js';

// Entité du profil client.
import {
    CustomerProfile,
} from '../customer-profiles/entities/customer-profile.entity.js';

// Entité et statuts des réservations.
import {
    Reservation,
    ReservationStatus,
} from './entities/reservation.entity.js';

// DTO de création d'une réservation.
import {
    CreateReservationDto,
} from './dto/create-reservation.dto.js';

// Informations renvoyées par PostgreSQL
// lors de la recherche d'une voiture disponible.
interface AvailableVehicleRow {
    id: string;
    daily_price: string;
    security_deposit: string;
}

@Injectable()
export class ReservationsService {
    constructor(
        // Repository de la table customer_profiles.
        @InjectRepository(CustomerProfile)
        private readonly profilesRepository:
            Repository<CustomerProfile>,

        // Repository de la table reservations.
        @InjectRepository(Reservation)
        private readonly reservationsRepository:
            Repository<Reservation>,

        // Connexion utilisée pour les transactions.
        private readonly dataSource: DataSource,
        private readonly premiumService: PremiumService,
        private readonly availability: AvailabilityService,
    ) { }

    // ==========================================
    // 1. CONVERTIR ET VÉRIFIER UNE DATE
    // ==========================================

    private parseDate(
        value: string,
        fieldName: string,
    ): Date {
        // Convertir la date en minuit UTC.
        const date = new Date(
            `${value}T00:00:00.000Z`,
        );

        // Refuser les dates qui n'existent pas.
        if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== value
        ) {
            throw new BadRequestException(
                `${fieldName} must be a valid date`,
            );
        }

        return date;
    }

    // ==========================================
    // 2. CRÉER UNE RÉSERVATION
    // ==========================================

    async createReservation(
        userId: string,
        dto: CreateReservationDto,
    ): Promise<Reservation> {

        // ------------------------------------------
        // A. VÉRIFIER LE PROFIL CLIENT
        // ------------------------------------------

        const profile =
            await this.profilesRepository.findOne({
                where: {
                    userId,
                },
            });

        if (!profile) {
            throw new BadRequestException(
                'Complete your customer profile before booking',
            );
        }

        // ------------------------------------------
        // B. RÉSOUDRE LES DATES ET HEURES
        // ------------------------------------------

        // Le nouveau parcours envoie des instants précis (date + heure).
        // L'ancien contrat n'envoyait que des dates (à minuit UTC).
        const pickupAt = dto.pickupAt
            ? new Date(dto.pickupAt)
            : dto.pickupDate
              ? this.parseDate(dto.pickupDate, 'pickupDate')
              : null;

        const returnAt = dto.returnAt
            ? new Date(dto.returnAt)
            : dto.returnDate
              ? this.parseDate(dto.returnDate, 'returnDate')
              : null;

        // Precise timestamps are mandatory: a date-only request must
        // never silently become midnight UTC and bypass operational checks.
        if (!dto.pickupAt || !pickupAt || Number.isNaN(pickupAt.getTime())) {
            throw new BadRequestException(
                'A precise pickupAt timestamp is required',
            );
        }

        if (!dto.returnAt || !returnAt || Number.isNaN(returnAt.getTime())) {
            throw new BadRequestException(
                'A precise returnAt timestamp is required',
            );
        }

        // Le départ doit être dans le futur.
        if (pickupAt.getTime() <= Date.now()) {
            throw new BadRequestException(
                'Pickup date must be in the future',
            );
        }

        // Le retour doit être après le départ.
        if (returnAt.getTime() <= pickupAt.getTime()) {
            throw new BadRequestException(
                'Return date must be after pickup date',
            );
        }

        // Le permis doit être valide jusqu'à la date de retour.
        const returnDate = returnAt.toISOString().slice(0, 10);
        if (profile.licenseExpiresOn < returnDate) {
            throw new BadRequestException(
                'Driving license expires before the return date',
            );
        }

        // ---- Modes de service (livraison / collecte, additionnel) ----
        // Sans ces champs, le contrat historique est conservé : un
        // point de service obligatoire, restitution au même point.
        const pickupServiceMode =
            dto.pickupServiceMode ?? 'APPROVED_POINT';
        const dropoffServiceMode =
            dto.dropoffServiceMode ?? 'APPROVED_POINT';
        if (pickupServiceMode === 'DOOR_TO_DOOR' && !dto.pickupDoor?.address) {
            throw new BadRequestException(
                'A pickup address is required for door-to-door collection',
            );
        }
        if (dropoffServiceMode === 'DOOR_TO_DOOR' && !dto.dropoffDoor?.address) {
            throw new BadRequestException(
                'A return address is required for door-to-door return',
            );
        }

        // Une restitution au même point est le comportement par défaut :
        // aucun trajet simple n'est proposé. Un côté livré n'a pas de
        // point de service (c'est sa zone de service qui le valide).
        const dropoffLocationId =
            dropoffServiceMode === 'DOOR_TO_DOOR'
                ? null
                : (dto.dropoffLocationId ?? dto.pickupLocationId ?? null);

        // A pickup location is mandatory: every reservation must pass
        // the same authoritative server-side availability validation,
        // whatever route or API client created it.
        const pickupLocationId = dto.pickupLocationId ?? null;
        if (pickupServiceMode === 'APPROVED_POINT' && !pickupLocationId) {
            throw new BadRequestException(
                'A pickup location is required to create a reservation',
            );
        }

        // Revalider l'intervalle COMPLET avant toute écriture
        // (véhicule, lieu, horaires, durée et conflits réels).
        {
            const availability = await this.availability.check({
                vehicleId: dto.vehicleId,
                pickupLocationId: pickupLocationId ?? undefined,
                dropoffLocationId: dropoffLocationId ?? undefined,
                pickupAt: pickupAt.toISOString(),
                returnAt: returnAt.toISOString(),
                pickupServiceMode,
                dropoffServiceMode,
                pickupDoor: dto.pickupDoor?.address
                    ? {
                          city: dto.pickupDoor.address.city,
                          countryCode: dto.pickupDoor.address.countryCode,
                      }
                    : undefined,
                dropoffDoor: dto.dropoffDoor?.address
                    ? {
                          city: dto.dropoffDoor.address.city,
                          countryCode: dto.dropoffDoor.address.countryCode,
                      }
                    : undefined,
            });

            if (!availability.available) {
                throw new ConflictException(
                    availability.message ??
                        'Selected period is unavailable for this vehicle',
                );
            }
        }

        // Un devis persisté (optionnel) doit appartenir au client,
        // être encore valide et correspondre exactement à cette
        // réservation — revalidation complète avant toute écriture.
        if (dto.quoteId) {
            await validateQuoteForBooking(this.dataSource, {
                quoteId: dto.quoteId,
                userId,
                expected: {
                    vehicleId: dto.vehicleId,
                    pickupAt,
                    returnAt,
                    pickupPoint: buildSideFingerprint({
                        mode: pickupServiceMode,
                        locationId: pickupLocationId,
                        address: dto.pickupDoor?.address ?? null,
                    }),
                    dropoffPoint: buildSideFingerprint({
                        mode: dropoffServiceMode,
                        locationId: dropoffLocationId,
                        address: dto.dropoffDoor?.address ?? null,
                    }),
                },
            });
        }

        // ------------------------------------------
        // C. DÉMARRER UNE TRANSACTION
        // ------------------------------------------

        try {
            return await this.dataSource.transaction(
                async (manager) => {

                    // ------------------------------------
                    // D. CHERCHER UNE VOITURE DISPONIBLE
                    // ------------------------------------

                    // La fonction PostgreSQL vérifie
                    // les réservations, les maintenances
                    // et le statut du véhicule.
                    //
                    // Le verrou FOR UPDATE protège
                    // la voiture sélectionnée.
                    //
                    // SKIP LOCKED évite de sélectionner
                    // une voiture déjà verrouillée.

                    // Sélectionner exclusivement la voiture choisie.
                    // Le verrou et la fonction PostgreSQL conservent
                    // les protections contre les conflits simultanés.
                    const vehicles = await manager.query(
                        `
                        SELECT v.id, v.daily_price, v.security_deposit
                        FROM vehicles v
                        WHERE v.id = $1::uuid
                          AND v.status = 'active'
                          AND v.id IN (
                            SELECT available.id
                            FROM find_available_vehicles(
                              $2::timestamptz,
                              $3::timestamptz
                            ) AS available
                          )
                        LIMIT 1
                        FOR UPDATE OF v SKIP LOCKED
                        `,
                        [dto.vehicleId, pickupAt.toISOString(), returnAt.toISOString()],
                    ) as AvailableVehicleRow[];

                    // Refuser la demande si aucune
                    // voiture n'est disponible.
                    if (vehicles.length === 0) {
                        throw new ConflictException(
                            'Selected vehicle is unavailable for this period',
                        );
                    }

                    const vehicle = vehicles[0];

                    // ------------------------------------
                    // E. CALCULER LE PRIX TOTAL AUTORITAIRE
                    // ------------------------------------

                    // Le devis NestJS inclut les extras, la livraison
                    // et les éventuelles remises. Tous les montants sont EUR.
                    // Il fixe aussi la durée facturée (jour entamé = jour dû).
                    const quote = await this.premiumService.quote({
                        vehicleId: dto.vehicleId,
                        pickupAt: pickupAt.toISOString(),
                        returnAt: returnAt.toISOString(),
                        extraIds: dto.extraIds,
                        promotionCode: dto.promotionCode,
                        pickupMethod: dto.pickupMethod,
                        deliveryAddress: dto.deliveryAddress,
                        pickupLocationId:pickupLocationId??undefined,
                        dropoffLocationId:dropoffLocationId??undefined,
                        pickupAddress:dto.pickupAddress,dropoffAddress:dto.dropoffAddress,
                        pickupServiceMode,dropoffServiceMode,
                        pickupDoor:dto.pickupDoor,dropoffDoor:dto.dropoffDoor,
                    }, manager, true);
                    const totalAmount = quote.totalAmount;

                    // Revalider le devis persisté DANS la transaction :
                    // le prix recalculé par le serveur doit coïncider
                    // avec le total du devis accepté (sinon : nouveau
                    // devis, jamais une surprise tarifaire).
                    if (dto.quoteId) {
                        const persisted = await validateQuoteForBooking(
                            manager,
                            {
                                quoteId: dto.quoteId,
                                userId,
                                expected: {
                                    vehicleId: dto.vehicleId,
                                    pickupAt,
                                    returnAt,
                                    pickupPoint: buildSideFingerprint({
                                        mode: pickupServiceMode,
                                        locationId: pickupLocationId,
                                        address:
                                            dto.pickupDoor?.address ?? null,
                                    }),
                                    dropoffPoint: buildSideFingerprint({
                                        mode: dropoffServiceMode,
                                        locationId: dropoffLocationId,
                                        address:
                                            dto.dropoffDoor?.address ?? null,
                                    }),
                                },
                            },
                        );
                        assertQuoteMatchesFreshTotal(
                            persisted.breakdown,
                            quote.totalAmount,
                        );
                    }

                    // La durée stockée doit correspondre exactement au devis
                    // (contrainte PostgreSQL total = jours × prix + extras …).
                    const rentalDays = quote.rentalDays;

                    // ------------------------------------
                    // F. PRÉPARER LA RÉSERVATION
                    // ------------------------------------

                    const reservationRepository =
                        manager.getRepository(Reservation);

                    const reservation =
                        reservationRepository.create({
                            // Identifiant du client connecté.
                            customerId: userId,

                            // Voiture sélectionnée.
                            vehicleId: vehicle.id,

                            // Dates de location.
                            pickupAt,
                            returnAt,

                            // Durée calculée.
                            rentalDays,

                            // Prix conservés au moment
                            // de la réservation.
                            dailyPrice:
                                vehicle.daily_price,

                            depositAmount:
                                vehicle.security_deposit,

                            totalAmount,
                            extrasAmount: quote.extrasAmount,
                            deliveryAmount: quote.deliveryAmount,
                            discountAmount: quote.discountAmount,
                            promotionCode: quote.promotionCode,

                            // Nouvelle réservation en attente.
                            status:
                                ReservationStatus.PENDING,

                            customerNotes:
                                dto.customerNotes?.trim() ?? null,

                            // Aucune décision administrative
                            // n'a encore été prise.
                            decidedBy: null,
                            decidedAt: null,
                            decisionReason: null,
                        });

                    // ------------------------------------
                    // G. ENREGISTRER LA RÉSERVATION
                    // ------------------------------------

                    const savedReservation =
                        await reservationRepository.save(
                            reservation,
                        );

                    // Relire la réservation pour obtenir
                    // son numéro généré par PostgreSQL.
                    const completeReservation =
                        await reservationRepository.findOne({
                            where: {
                                id: savedReservation.id,
                            },
                        });

                    if (!completeReservation) {
                        throw new NotFoundException(
                            'Created reservation not found',
                        );
                    }

                    // Sauvegarder les prestations et préférences de la réservation.
                    for (const extra of quote.extras) {
                        await manager.query(`INSERT INTO reservation_extras
                          (reservation_id,extra_id,name_snapshot,amount_snapshot,pricing_snapshot,unit_price_snapshot)
                          VALUES($1,$2,$3,$4,$5,$6)`,
                          [savedReservation.id,extra.id,extra.name,extra.total,extra.pricing,extra.unitPrice]);
                    }
                    await manager.query(`INSERT INTO reservation_preferences
                      (reservation_id,pickup_method,delivery_address,pickup_location_id,dropoff_location_id,
                      pickup_location_snapshot,dropoff_location_snapshot,pickup_address,dropoff_address)
                      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                      [savedReservation.id,quote.pickupMethod,dto.deliveryAddress?.trim() ||
                       (quote.pickupMethod==='hotel'?quote.pickupLocationName:null),
                       quote.pickupLocationId,quote.dropoffLocationId,quote.pickupLocationName,
                       quote.dropoffLocationName,dto.pickupAddress?.trim()||null,dto.dropoffAddress?.trim()||null]);
                    // Points de service : instantanés contractuels des
                    // deux extrémités (point approuvé ou adresse privée),
                    // avec fuseau et heure locale réels.
                    await this.insertServicePoints(
                        manager,
                        savedReservation.id,
                        {
                            pickupServiceMode,
                            dropoffServiceMode,
                            pickupLocationId,
                            dropoffLocationId,
                            pickupDoor: dto.pickupDoor,
                            dropoffDoor: dto.dropoffDoor,
                            pickupPointAddress: dto.pickupAddress,
                            dropoffPointAddress: dto.dropoffAddress,
                            pickupAt,
                            returnAt,
                        },
                    );

                    // Réclamer atomiquement le devis persisté (toujours
                    // dans la transaction : deux réservations ne peuvent
                    // pas accepter le même devis).
                    if (dto.quoteId) {
                        await markQuoteAccepted(
                            manager,
                            dto.quoteId,
                            savedReservation.id,
                        );
                    }

                    if (quote.promotionCode) {
                        await manager.query(`UPDATE premium_promotions SET uses=uses+1 WHERE code=$1`,
                          [quote.promotionCode]);
                    }
                    // Mettre en file un email, sans prétendre l'avoir envoyé.
                    await manager.query(`INSERT INTO customer_email_outbox(customer_id,subject,message)
                      VALUES($1,$2,$3)`,[userId,'Reservation request received',
                        `Reservation ${completeReservation.reservationNumber} received. Amount EUR ${quote.totalAmount}. Awaiting confirmation.`]);
                    return completeReservation;
                },
            );

        } catch (error) {

            // ----------------------------------------
            // H. GÉRER LES CONFLITS POSTGRESQL
            // ----------------------------------------

            // Le code 23P01 indique notamment
            // une violation de la contrainte
            // empêchant les doubles réservations.
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string })
                    .code === '23P01'
            ) {
                throw new ConflictException(
                    'Vehicle is no longer available for these dates',
                );
            }

            throw error;
        }
    }

    // ==========================================
    // 2bis. POINTS DE SERVICE (instantanés)
    // ==========================================
    //
    // Chaque nouvelle réservation grave ses deux extrémités :
    // point approuvé (nom + ville + fuseau) ou adresse porte-à-porte
    // (structure + fuseau de la zone). La date et l'heure locales
    // contractuelles sont calculées DANS le fuseau du lieu ou de la
    // zone — jamais un décalage simulé côté client. Les éditions
    // ultérieures (avant gel) créeront des révisions séparées.
    private async insertServicePoints(
        manager: EntityManager,
        reservationId: string,
        params: {
            pickupServiceMode: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
            dropoffServiceMode: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
            pickupLocationId: string | null;
            dropoffLocationId: string | null;
            pickupDoor?: CreateReservationDto['pickupDoor'];
            dropoffDoor?: CreateReservationDto['dropoffDoor'];
            pickupPointAddress?: string;
            dropoffPointAddress?: string;
            pickupAt: Date;
            returnAt: Date;
        },
    ) {
        for (const direction of ['pickup', 'dropoff'] as const) {
            const isPickup = direction === 'pickup';
            const mode = isPickup
                ? params.pickupServiceMode
                : params.dropoffServiceMode;
            const locationId = isPickup
                ? params.pickupLocationId
                : params.dropoffLocationId;
            const door = isPickup ? params.pickupDoor : params.dropoffDoor;
            const pointAddress = isPickup
                ? params.pickupPointAddress
                : params.dropoffPointAddress;
            const scheduledAt = isPickup ? params.pickupAt : params.returnAt;

            let timezone = 'Europe/Budapest';
            let canonical = '';
            if (mode === 'APPROVED_POINT' && locationId) {
                const rows: {
                    name: string;
                    city: string;
                    timezone: string;
                }[] = await manager.query(
                    `SELECT name, city, timezone FROM rental_locations WHERE id=$1`,
                    [locationId],
                );
                timezone = rows[0]?.timezone ?? timezone;
                // Un point « custom » porte l'adresse fournie par le
                // client ; sinon le nom public du lieu.
                canonical =
                    pointAddress?.trim() ||
                    (rows[0] ? `${rows[0].name} — ${rows[0].city}` : '');
                if (!canonical) canonical = String(locationId);
            } else if (door?.address) {
                const addr = door.address;
                timezone = await zoneTimezoneFor(manager, {
                    countryCode: addr.countryCode,
                    city: addr.city,
                });
                canonical = `${addr.line1}${
                    addr.postalCode ? `, ${addr.postalCode}` : ''
                }, ${addr.city}`;
            }

            // Date et heure locales contractuelles (fuseau réel).
            let localDate = scheduledAt.toISOString().slice(0, 10);
            let minutes = 0;
            try {
                const parts = zonedParts(scheduledAt, timezone);
                localDate = parts.date;
                minutes = parts.minutes;
            } catch {
                // Fuseau invalide : conserver la date UTC (validée).
            }
            const localTime = `${String(Math.floor(minutes / 60)).padStart(
                2,
                '0',
            )}:${String(minutes % 60).padStart(2, '0')}`;

            await manager.query(
                `INSERT INTO reservation_service_points
                   (reservation_id, direction, method, location_id, address,
                    scheduled_at, local_date, local_time, timezone,
                    meeting_instructions, entry_notes, canonical)
                 VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)`,
                [
                    reservationId,
                    direction,
                    mode,
                    mode === 'APPROVED_POINT' ? locationId : null,
                    mode === 'DOOR_TO_DOOR' && door?.address
                        ? JSON.stringify({
                              line1: door.address.line1,
                              line2: door.address.line2 ?? null,
                              city: door.address.city,
                              postalCode: door.address.postalCode ?? null,
                              countryCode: door.address.countryCode,
                              latitude: door.address.latitude ?? null,
                              longitude: door.address.longitude ?? null,
                          })
                        : null,
                    scheduledAt.toISOString(),
                    localDate,
                    localTime,
                    timezone,
                    door?.meetingInstructions ?? null,
                    door?.entryNotes ?? null,
                    canonical,
                ],
            );
        }
    }

    // ==========================================
    // 3. CONSULTER MES RÉSERVATIONS
    // ==========================================

    async findMyReservations(
        userId: string,
    ): Promise<Reservation[]> {

        // Le client ne voit que ses réservations.
        // L'identifiant provient du JWT.
        const rows=await this.reservationsRepository.find({
            where: {customerId:userId},
            order: {createdAt:'DESC'},
        });
        if(!rows.length)return rows;
        // Le pré-enregistrement (check-in) et la logistique sont stockés
        // dans reservation_preferences. On les expose au client pour que
        // l'interface masque immédiatement les actions devenues obsolètes
        // (ex. bouton check-in après un check-in déjà effectué).
        const details:{reservationId:string;pickupLocation:string|null;dropoffLocation:string|null;checkinAt:string|null}[]=
          await this.reservationsRepository.manager.query(`SELECT reservation_id AS "reservationId",
            pickup_location_snapshot AS "pickupLocation",dropoff_location_snapshot AS "dropoffLocation",
            checkin_at AS "checkinAt"
            FROM reservation_preferences WHERE reservation_id=ANY($1::uuid[])`,[rows.map(r=>r.id)]);
        const map=new Map(details.map(x=>[x.reservationId,x]));
        for(const r of rows)Object.assign(r,{
            pickupLocation:map.get(r.id)?.pickupLocation??null,
            dropoffLocation:map.get(r.id)?.dropoffLocation??null,
            checkinAt:map.get(r.id)?.checkinAt??null,
        });
        return rows;
    }

    // ==========================================
    // 4. ANNULER MA RÉSERVATION
    // ==========================================

    async cancelMyReservation(
        userId: string,
        reservationNumber: string,
    ): Promise<Reservation> {

        // Nettoyer le numéro commercial.
        const number =
            reservationNumber.trim().toUpperCase();

        // Utiliser une transaction pour empêcher
        // une annulation simultanée à une autre
        // modification de cette réservation.
        return this.dataSource.transaction(
            async (manager) => {

                const reservationRepository =
                    manager.getRepository(Reservation);

                // --------------------------------------
                // A. RETROUVER LA RÉSERVATION
                // --------------------------------------

                // Chercher une réservation ayant :
                // - le numéro demandé ;
                // - l'identifiant du client connecté.
                //
                // Le verrou empêche qu'une autre
                // transaction la modifie en même temps.
                const reservation =
                    await reservationRepository.findOne({
                        where: {
                            reservationNumber: number,
                            customerId: userId,
                        },

                        lock: {
                            mode: 'pessimistic_write',
                        },
                    });

                // Ne pas révéler les réservations
                // appartenant à d'autres clients.
                if (!reservation) {
                    throw new NotFoundException(
                        'Reservation not found',
                    );
                }

                // --------------------------------------
                // B. VÉRIFIER LE STATUT
                // --------------------------------------

                // Le client peut annuler lui-même une réservation
                // encore en attente ou déjà confirmée, tant que la
                // prise en charge n'a pas commencé.
                if (
                    reservation.status !==
                        ReservationStatus.PENDING &&
                    reservation.status !==
                        ReservationStatus.CONFIRMED
                ) {
                    throw new ConflictException(
                        'Only pending or confirmed reservations can be cancelled',
                    );
                }

                // --------------------------------------
                // C. VÉRIFIER LA DATE DE DÉPART
                // --------------------------------------

                // Refuser une annulation si la date
                // de départ est déjà passée.
                if (
                    reservation.pickupAt <= new Date()
                ) {
                    throw new ConflictException(
                        'Cannot cancel after the pickup date',
                    );
                }

                // --------------------------------------
                // C.b VÉRIFIER L'HISTORIQUE FINANCIER
                // --------------------------------------

                // Les paiements, cautions et factures sont rattachés
                // à un contrat de location (rentals.reservation_id),
                // créé uniquement au démarrage réel de la location.
                // Une réservation annulable ici (pending/confirmée)
                // ne peut donc pas porter de mouvement financier.
                // Par prudence, si un contrat existe malgré tout,
                // l'annulation est refusée : les charges et paiements
                // existants ne doivent jamais être effacés, et aucun
                // remboursement n'est inventé automatiquement.
                const engagedRental: { id: string }[] =
                    await manager.query(
                        `SELECT id FROM rentals
                         WHERE reservation_id = $1::uuid
                         LIMIT 1`,
                        [reservation.id],
                    );

                if (engagedRental[0]) {
                    throw new ConflictException(
                        'This reservation has a rental contract with financial records. Contact the showroom so staff can settle it.',
                    );
                }

                // --------------------------------------
                // D. ANNULER LA RÉSERVATION
                // --------------------------------------

                // Nous ne supprimons pas la ligne.
                // Nous conservons son historique.
                reservation.status =
                    ReservationStatus.CANCELLED;

                // PostgreSQL actualise automatiquement
                // updated_at grâce au trigger existant.
                return reservationRepository.save(
                    reservation,
                );
            },
        );
    }
}
