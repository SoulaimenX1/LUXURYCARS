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
import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
// Rôles des utilisateurs.
import { UserRole } from '../users/entities/user.entity.js';
// Guards de sécurité.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
// Décorateur des permissions.
import { Roles } from '../auth/decorators/roles.decorator.js';
// DTO utilisé pour le refus.
import { RejectReservationDto } from './dto/reject-reservation.dto.js';
// Service administratif.
import { ReservationsAdminService } from './reservations-admin.service.js';
export class ReservationsAdminController {
    // ==========================================
    // 1. CONSULTER LES RÉSERVATIONS EN ATTENTE
    // ==========================================
    // Réservé aux administrateurs.
    getPendingReservations() {
        return this.adminService.findPendingReservations();
    }
    // ==========================================
    // 2. REFUSER UNE RÉSERVATION
    // ==========================================
    // Réservé aux administrateurs.
    rejectReservation(reservationNumber, request, dto) {
        // Identifier l'administrateur connecté.
        const adminId = request.user.id;
        // Enregistrer le refus et son motif.
        return this.adminService.rejectReservation(reservationNumber, adminId, dto.reason);
    }
    // ==========================================
    // 3. CONFIRMER UNE RÉSERVATION
    // ==========================================
    // Réservé aux administrateurs.
    confirmReservation(reservationNumber, request) {
        // Récupérer l'identifiant administrateur.
        const adminId = request.user.id;
        // Vérifier le permis et la voiture,
        // puis confirmer la réservation.
        return this.adminService.confirmReservation(reservationNumber, adminId);
    }
    constructor(adminService){
        this.adminService = adminService;
    }
}
_ts_decorate([
    Get('pending'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], ReservationsAdminController.prototype, "getPendingReservations", null);
_ts_decorate([
    Patch('by-number/:reservationNumber/reject'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Param('reservationNumber')),
    _ts_param(1, Req()),
    _ts_param(2, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        typeof AuthenticatedRequest === "undefined" ? Object : AuthenticatedRequest,
        typeof RejectReservationDto === "undefined" ? Object : RejectReservationDto
    ]),
    _ts_metadata("design:returntype", void 0)
], ReservationsAdminController.prototype, "rejectReservation", null);
_ts_decorate([
    Patch('by-number/:reservationNumber/confirm'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Param('reservationNumber')),
    _ts_param(1, Req()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        typeof AuthenticatedRequest === "undefined" ? Object : AuthenticatedRequest
    ]),
    _ts_metadata("design:returntype", void 0)
], ReservationsAdminController.prototype, "confirmReservation", null);
ReservationsAdminController = _ts_decorate([
    Controller('reservations/admin'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof ReservationsAdminService === "undefined" ? Object : ReservationsAdminService
    ])
], ReservationsAdminController);

//# sourceMappingURL=reservations-admin.controller.js.map