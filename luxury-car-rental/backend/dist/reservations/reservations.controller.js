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
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
// Rôles des utilisateurs.
import { UserRole } from '../users/entities/user.entity.js';
// Guards de sécurité.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
// Décorateur des permissions.
import { Roles } from '../auth/decorators/roles.decorator.js';
// DTO de création.
import { CreateReservationDto } from './dto/create-reservation.dto.js';
// Service de réservation.
import { ReservationsService } from './reservations.service.js';
export class ReservationsController {
    // ==========================================
    // 1. CRÉER UNE RÉSERVATION
    // ==========================================
    createReservation(request, dto) {
        // Identifier le client grâce au JWT.
        const userId = request.user.id;
        // Créer sa réservation.
        return this.reservationsService.createReservation(userId, dto);
    }
    // ==========================================
    // 2. CONSULTER MES RÉSERVATIONS
    // ==========================================
    getMyReservations(request) {
        // Récupérer l'identifiant du client.
        const userId = request.user.id;
        // Retourner ses réservations.
        return this.reservationsService.findMyReservations(userId);
    }
    // ==========================================
    // 3. ANNULER MA RÉSERVATION
    // ==========================================
    cancelMyReservation(request, reservationNumber) {
        // Identifier le client connecté.
        const userId = request.user.id;
        // Annuler uniquement une réservation
        // qui appartient à ce client.
        return this.reservationsService.cancelMyReservation(userId, reservationNumber);
    }
    constructor(reservationsService){
        this.reservationsService = reservationsService;
    }
}
_ts_decorate([
    Post(),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.CUSTOMER),
    _ts_param(0, Req()),
    _ts_param(1, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof AuthenticatedRequest === "undefined" ? Object : AuthenticatedRequest,
        typeof CreateReservationDto === "undefined" ? Object : CreateReservationDto
    ]),
    _ts_metadata("design:returntype", void 0)
], ReservationsController.prototype, "createReservation", null);
_ts_decorate([
    Get('me'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.CUSTOMER),
    _ts_param(0, Req()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof AuthenticatedRequest === "undefined" ? Object : AuthenticatedRequest
    ]),
    _ts_metadata("design:returntype", void 0)
], ReservationsController.prototype, "getMyReservations", null);
_ts_decorate([
    Patch('by-number/:reservationNumber/cancel'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.CUSTOMER),
    _ts_param(0, Req()),
    _ts_param(1, Param('reservationNumber')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof AuthenticatedRequest === "undefined" ? Object : AuthenticatedRequest,
        String
    ]),
    _ts_metadata("design:returntype", void 0)
], ReservationsController.prototype, "cancelMyReservation", null);
ReservationsController = _ts_decorate([
    Controller('reservations'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof ReservationsService === "undefined" ? Object : ReservationsService
    ])
], ReservationsController);

//# sourceMappingURL=reservations.controller.js.map