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
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
// Entité et statuts des réservations.
import { Reservation, ReservationStatus } from './entities/reservation.entity.js';
// Profil et permis de conduire du client.
import { CustomerProfile } from '../customer-profiles/entities/customer-profile.entity.js';
// Entité et statut des voitures.
import { Vehicle, VehicleStatus } from '../vehicles/entities/vehicle.entity.js';
export class ReservationsAdminService {
    // ==========================================
    // 1. CONSULTER LES RÉSERVATIONS EN ATTENTE
    // ==========================================
    async findPendingReservations() {
        // Récupérer uniquement les réservations
        // dont le statut est pending.
        return this.reservationsRepository.find({
            where: {
                status: ReservationStatus.PENDING
            },
            // Afficher les plus anciennes en premier.
            order: {
                createdAt: 'ASC'
            }
        });
    }
    // ==========================================
    // 2. REFUSER UNE RÉSERVATION
    // ==========================================
    async rejectReservation(reservationNumber, adminId, reason) {
        // Nettoyer le numéro commercial.
        const number = reservationNumber.trim().toUpperCase();
        // Exécuter l'opération dans une transaction.
        return this.dataSource.transaction(async (manager)=>{
            const repository = manager.getRepository(Reservation);
            // Chercher et verrouiller la réservation
            // pendant la décision administrative.
            const reservation = await repository.findOne({
                where: {
                    reservationNumber: number
                },
                lock: {
                    mode: 'pessimistic_write'
                }
            });
            // La réservation doit exister.
            if (!reservation) {
                throw new NotFoundException('Reservation not found');
            }
            // Seule une réservation en attente
            // peut être refusée.
            if (reservation.status !== ReservationStatus.PENDING) {
                throw new ConflictException('Only pending reservations can be rejected');
            }
            // Enregistrer la décision.
            reservation.status = ReservationStatus.REJECTED;
            reservation.decidedBy = adminId;
            reservation.decidedAt = new Date();
            reservation.decisionReason = reason.trim();
            // Conserver la réservation et son historique.
            return repository.save(reservation);
        });
    }
    // ==========================================
    // 3. CONFIRMER UNE RÉSERVATION
    // ==========================================
    async confirmReservation(reservationNumber, adminId) {
        // Nettoyer le numéro de réservation.
        const number = reservationNumber.trim().toUpperCase();
        // Utiliser une transaction afin d'éviter
        // deux décisions simultanées.
        return this.dataSource.transaction(async (manager)=>{
            const reservationRepository = manager.getRepository(Reservation);
            // --------------------------------------
            // A. CHERCHER LA RÉSERVATION
            // --------------------------------------
            // Le verrou empêche une annulation
            // ou un refus simultané.
            const reservation = await reservationRepository.findOne({
                where: {
                    reservationNumber: number
                },
                lock: {
                    mode: 'pessimistic_write'
                }
            });
            if (!reservation) {
                throw new NotFoundException('Reservation not found');
            }
            // --------------------------------------
            // B. VÉRIFIER LE STATUT
            // --------------------------------------
            // Nous ne confirmons que les
            // réservations encore en attente.
            if (reservation.status !== ReservationStatus.PENDING) {
                throw new ConflictException('Only pending reservations can be confirmed');
            }
            // --------------------------------------
            // C. VÉRIFIER LA DATE DE DÉPART
            // --------------------------------------
            // Une réservation dont le départ
            // est déjà passé ne peut pas
            // être confirmée.
            if (reservation.pickupAt <= new Date()) {
                throw new ConflictException('Pickup date has already passed');
            }
            // --------------------------------------
            // D. VÉRIFIER LE PROFIL CLIENT
            // --------------------------------------
            const profileRepository = manager.getRepository(CustomerProfile);
            const profile = await profileRepository.findOne({
                where: {
                    userId: reservation.customerId
                }
            });
            if (!profile) {
                throw new ConflictException('Customer profile is missing');
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
            if (!profile.licenseNumber?.trim() || !profile.licenseCountry?.trim() || !profile.licenseIssuedOn || !profile.licenseExpiresOn) {
                throw new ConflictException('Customer driving license information is incomplete');
            }
            // Récupérer la date de retour
            // au format AAAA-MM-JJ.
            const returnDate = reservation.returnAt.toISOString().slice(0, 10);
            // Le permis doit rester valide pendant
            // toute la période de location.
            if (profile.licenseExpiresOn < returnDate) {
                throw new ConflictException('Driving license expires before the return date');
            }
            // --------------------------------------
            // F. VÉRIFIER LE STATUT DE LA VOITURE
            // --------------------------------------
            const vehicleRepository = manager.getRepository(Vehicle);
            const vehicle = await vehicleRepository.findOne({
                where: {
                    id: reservation.vehicleId
                }
            });
            if (!vehicle) {
                throw new NotFoundException('Reserved vehicle not found');
            }
            // Une voiture en maintenance ou retirée
            // ne peut pas être confirmée.
            if (vehicle.status !== VehicleStatus.ACTIVE) {
                throw new ConflictException('Vehicle is not active');
            }
            // --------------------------------------
            // G. CONFIRMER LA RÉSERVATION
            // --------------------------------------
            reservation.status = ReservationStatus.CONFIRMED;
            // Conserver l'administrateur
            // responsable de la confirmation.
            reservation.decidedBy = adminId;
            // Enregistrer la date de confirmation.
            reservation.decidedAt = new Date();
            // Aucun motif de refus.
            reservation.decisionReason = null;
            // --------------------------------------
            // H. ENREGISTRER DANS POSTGRESQL
            // --------------------------------------
            // Le trigger PostgreSQL actualisera
            // automatiquement updated_at.
            return reservationRepository.save(reservation);
        });
    }
    constructor(// Accès à la table reservations.
    reservationsRepository, // Connexion PostgreSQL pour les transactions.
    dataSource){
        this.reservationsRepository = reservationsRepository;
        this.dataSource = dataSource;
    }
}
ReservationsAdminService = _ts_decorate([
    Injectable(),
    _ts_param(0, InjectRepository(Reservation)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof Repository === "undefined" ? Object : Repository,
        typeof DataSource === "undefined" ? Object : DataSource
    ])
], ReservationsAdminService);

//# sourceMappingURL=reservations-admin.service.js.map