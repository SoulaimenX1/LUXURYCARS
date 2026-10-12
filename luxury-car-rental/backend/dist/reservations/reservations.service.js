function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for(var i = decorators.length - 1; i >= 0; i--){
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(metadataKey, metadataValue);
    }
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
// Entité du profil client.
import { CustomerProfile } from '../customer-profiles/entities/customer-profile.entity.js';
// Entité et statuts des réservations.
import { Reservation, ReservationStatus } from './entities/reservation.entity.js';
export class ReservationsService {
    // ==========================================
    // 1. CONVERTIR ET VÉRIFIER UNE DATE
    // ==========================================
    parseDate(value, fieldName) {
        // Convertir la date en minuit UTC.
        const date = new Date(`${value}T00:00:00.000Z`);
        // Refuser les dates qui n'existent pas.
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            throw new BadRequestException(`${fieldName} must be a valid date`);
        }
        return date;
    }
    // ==========================================
    // 2. CRÉER UNE RÉSERVATION
    // ==========================================
    async createReservation(userId, dto) {
        // ------------------------------------------
        // A. VÉRIFIER LE PROFIL CLIENT
        // ------------------------------------------
        const profile = await this.profilesRepository.findOne({
            where: {
                userId
            }
        });
        if (!profile) {
            throw new BadRequestException('Complete your customer profile before booking');
        }
        // ------------------------------------------
        // B. VÉRIFIER LES DATES
        // ------------------------------------------
        const pickupAt = this.parseDate(dto.pickupDate, 'pickupDate');
        const returnAt = this.parseDate(dto.returnDate, 'returnDate');
        // Le départ doit être dans le futur.
        if (pickupAt <= new Date()) {
            throw new BadRequestException('Pickup date must be in the future');
        }
        // Le retour doit être après le départ.
        if (returnAt <= pickupAt) {
            throw new BadRequestException('Return date must be after pickup date');
        }
        // Le permis doit être valide
        // jusqu'à la date de retour.
        if (profile.licenseExpiresOn < dto.returnDate) {
            throw new BadRequestException('Driving license expires before the return date');
        }
        // Calculer la durée de location en jours.
        const rentalDays = (returnAt.getTime() - pickupAt.getTime()) / 86_400_000;
        // Nettoyer les noms.
        const brandName = dto.brandName.trim();
        const modelName = dto.modelName.trim();
        // ------------------------------------------
        // C. DÉMARRER UNE TRANSACTION
        // ------------------------------------------
        try {
            return await this.dataSource.transaction(async (manager)=>{
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
                const vehicles = await manager.query(`
              SELECT
                v.id,
                v.daily_price,
                v.security_deposit

              FROM vehicles v

              INNER JOIN vehicle_models m
                ON m.id = v.model_id

              INNER JOIN brands b
                ON b.id = m.brand_id

              WHERE
                LOWER(b.name) = LOWER($1)

                AND LOWER(m.name) = LOWER($2)

                AND v.status = 'active'

                AND v.id IN (
                  SELECT available.id
                  FROM find_available_vehicles(
                    $3::timestamptz,
                    $4::timestamptz
                  ) AS available
                )

              ORDER BY v.id

              LIMIT 1

              FOR UPDATE OF v SKIP LOCKED
              `, [
                    brandName,
                    modelName,
                    pickupAt.toISOString(),
                    returnAt.toISOString()
                ]);
                // Refuser la demande si aucune
                // voiture n'est disponible.
                if (vehicles.length === 0) {
                    throw new ConflictException('No vehicle is available for this model and period');
                }
                const vehicle = vehicles[0];
                // ------------------------------------
                // E. CALCULER LE PRIX TOTAL
                // ------------------------------------
                // Convertir le prix en centimes
                // afin de limiter les erreurs
                // d'arrondi des nombres décimaux.
                const dailyPriceCents = Math.round(Number(vehicle.daily_price) * 100);
                const totalCents = dailyPriceCents * rentalDays;
                if (!Number.isSafeInteger(totalCents)) {
                    throw new BadRequestException('Reservation amount is too large');
                }
                // Convertir le total en euros.
                const totalAmount = (totalCents / 100).toFixed(2);
                // ------------------------------------
                // F. PRÉPARER LA RÉSERVATION
                // ------------------------------------
                const reservationRepository = manager.getRepository(Reservation);
                const reservation = reservationRepository.create({
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
                    dailyPrice: vehicle.daily_price,
                    depositAmount: vehicle.security_deposit,
                    totalAmount,
                    // Nouvelle réservation en attente.
                    status: ReservationStatus.PENDING,
                    customerNotes: dto.customerNotes?.trim() ?? null,
                    // Aucune décision administrative
                    // n'a encore été prise.
                    decidedBy: null,
                    decidedAt: null,
                    decisionReason: null
                });
                // ------------------------------------
                // G. ENREGISTRER LA RÉSERVATION
                // ------------------------------------
                const savedReservation = await reservationRepository.save(reservation);
                // Relire la réservation pour obtenir
                // son numéro généré par PostgreSQL.
                const completeReservation = await reservationRepository.findOne({
                    where: {
                        id: savedReservation.id
                    }
                });
                if (!completeReservation) {
                    throw new NotFoundException('Created reservation not found');
                }
                return completeReservation;
            });
        } catch (error) {
            // ----------------------------------------
            // H. GÉRER LES CONFLITS POSTGRESQL
            // ----------------------------------------
            // Le code 23P01 indique notamment
            // une violation de la contrainte
            // empêchant les doubles réservations.
            if (error instanceof QueryFailedError && error.driverError.code === '23P01') {
                throw new ConflictException('Vehicle is no longer available for these dates');
            }
            throw error;
        }
    }
    // ==========================================
    // 3. CONSULTER MES RÉSERVATIONS
    // ==========================================
    async findMyReservations(userId) {
        // Le client ne voit que ses réservations.
        // L'identifiant provient du JWT.
        return this.reservationsRepository.find({
            where: {
                customerId: userId
            },
            // Les réservations les plus récentes
            // apparaissent en premier.
            order: {
                createdAt: 'DESC'
            }
        });
    }
    // ==========================================
    // 4. ANNULER MA RÉSERVATION
    // ==========================================
    async cancelMyReservation(userId, reservationNumber) {
        // Nettoyer le numéro commercial.
        const number = reservationNumber.trim().toUpperCase();
        // Utiliser une transaction pour empêcher
        // une annulation simultanée à une autre
        // modification de cette réservation.
        return this.dataSource.transaction(async (manager)=>{
            const reservationRepository = manager.getRepository(Reservation);
            // --------------------------------------
            // A. RETROUVER LA RÉSERVATION
            // --------------------------------------
            // Chercher une réservation ayant :
            // - le numéro demandé ;
            // - l'identifiant du client connecté.
            //
            // Le verrou empêche qu'une autre
            // transaction la modifie en même temps.
            const reservation = await reservationRepository.findOne({
                where: {
                    reservationNumber: number,
                    customerId: userId
                },
                lock: {
                    mode: 'pessimistic_write'
                }
            });
            // Ne pas révéler les réservations
            // appartenant à d'autres clients.
            if (!reservation) {
                throw new NotFoundException('Reservation not found');
            }
            // --------------------------------------
            // B. VÉRIFIER LE STATUT
            // --------------------------------------
            // Dans cette première version,
            // le client peut annuler uniquement
            // une réservation encore en attente.
            if (reservation.status !== ReservationStatus.PENDING) {
                throw new ConflictException('Only pending reservations can be cancelled');
            }
            // --------------------------------------
            // C. VÉRIFIER LA DATE DE DÉPART
            // --------------------------------------
            // Refuser une annulation si la date
            // de départ est déjà passée.
            if (reservation.pickupAt <= new Date()) {
                throw new ConflictException('Cannot cancel after the pickup date');
            }
            // --------------------------------------
            // D. ANNULER LA RÉSERVATION
            // --------------------------------------
            // Nous ne supprimons pas la ligne.
            // Nous conservons son historique.
            reservation.status = ReservationStatus.CANCELLED;
            // PostgreSQL actualise automatiquement
            // updated_at grâce au trigger existant.
            return reservationRepository.save(reservation);
        });
    }
    constructor(// Repository de la table customer_profiles.
    profilesRepository, // Repository de la table reservations.
    reservationsRepository, // Connexion utilisée pour les transactions.
    dataSource){
        this.profilesRepository = profilesRepository;
        this.reservationsRepository = reservationsRepository;
        this.dataSource = dataSource;
    }
}
ReservationsService = _ts_decorate([
    Injectable(),
    _ts_param(0, InjectRepository(CustomerProfile)),
    _ts_param(1, InjectRepository(Reservation)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof Repository === "undefined" ? Object : Repository,
        typeof Repository === "undefined" ? Object : Repository,
        typeof DataSource === "undefined" ? Object : DataSource
    ])
], ReservationsService);

//# sourceMappingURL=reservations.service.js.map