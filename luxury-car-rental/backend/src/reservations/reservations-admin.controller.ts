
import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Req,
    UseGuards,
} from '@nestjs/common';

// Rôles des utilisateurs.
import {
    UserRole,
} from '../users/entities/user.entity.js';

// Guards de sécurité.
import {
    JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
    RolesGuard,
} from '../auth/guards/roles.guard.js';

// Décorateur des permissions.
import {
    Roles,
} from '../auth/decorators/roles.decorator.js';

// DTO utilisé pour le refus.
import {
    RejectReservationDto,
} from './dto/reject-reservation.dto.js';

// Service administratif.
import {
    ReservationsAdminService,
} from './reservations-admin.service.js';

// Informations ajoutées à la requête
// après la vérification du JWT.
interface AuthenticatedRequest {
    user: {
        id: string;
    };
}

@Controller('reservations/admin')
export class ReservationsAdminController {
    constructor(
        private readonly adminService:
            ReservationsAdminService,
    ) { }

    // ==========================================
    // 1. CONSULTER LES RÉSERVATIONS EN ATTENTE
    // ==========================================

    // Réservé aux administrateurs.
    @Get('pending')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    getPendingReservations() {
        return this.adminService
            .findPendingReservations();
    }

    // ==========================================
    // 2. REFUSER UNE RÉSERVATION
    // ==========================================

    // Réservé aux administrateurs.
    @Patch('by-number/:reservationNumber/reject')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    rejectReservation(
        @Param('reservationNumber')
        reservationNumber: string,

        @Req()
        request: AuthenticatedRequest,

        @Body()
        dto: RejectReservationDto,
    ) {
        // Identifier l'administrateur connecté.
        const adminId = request.user.id;

        // Enregistrer le refus et son motif.
        return this.adminService
            .rejectReservation(
                reservationNumber,
                adminId,
                dto.reason,
            );
    }

    // ==========================================
    // 3. CONFIRMER UNE RÉSERVATION
    // ==========================================

    // Réservé aux administrateurs.
    @Patch('by-number/:reservationNumber/confirm')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    confirmReservation(
        @Param('reservationNumber')
        reservationNumber: string,

        @Req()
        request: AuthenticatedRequest,
    ) {
        // Récupérer l'identifiant administrateur.
        const adminId = request.user.id;

        // Vérifier le permis et la voiture,
        // puis confirmer la réservation.
        return this.adminService
            .confirmReservation(
                reservationNumber,
                adminId,
            );
    }
}
