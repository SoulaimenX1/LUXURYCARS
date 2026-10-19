import { InboxService } from '../notifications/inbox.service.js';

// DTO de modification administrative d'une réservation.
import {
    UpdateReservationDto,
} from './dto/update-reservation.dto.js';

import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
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

// DTOs de gestion des blocs de maintenance.
import {
    CreateVehicleBlockDto,
    ReleaseBlockDto,
    UpdateVehicleBlockDto,
} from './dto/vehicle-block.dto.js';

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
        private readonly inbox: InboxService,
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

    // Liste de toutes les réservations (pas seulement pending).
    @Get('all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    getAllReservations() {
        return this.adminService.findAllReservations();
    }

    // Créneaux bloqués par maintenance ou réparation.
    @Get('unavailability')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    getUnavailability(@Query('month') month: string) {
        return this.adminService.getUnavailability(month);
    }

    // Historique des blocs de maintenance libérés (journal d'audit).
    // Réservé aux administrateurs.
    @Get('unavailability/history')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    getUnavailabilityHistory(@Query('month') month?: string) {
        return this.adminService.getUnavailabilityHistory(month);
    }

    // Bloquer un véhicule (maintenance/réparation).
    @Post('unavailability')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    createUnavailability(
        @Req()
        request: AuthenticatedRequest,

        @Body()
        dto: CreateVehicleBlockDto,
    ) {
        return this.adminService.createUnavailability(
            request.user.id,
            dto,
        );
    }

    // Modifier un bloc de maintenance existant.
    @Patch('unavailability/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    updateUnavailability(
        @Param('id', new ParseUUIDPipe()) id: string,

        @Body()
        dto: UpdateVehicleBlockDto,
    ) {
        return this.adminService.updateUnavailability(id, dto);
    }

    // Libérer un bloc de maintenance (le véhicule redevient
    // planifiable). Aucune réservation n'est affectée.
    @Delete('unavailability/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    releaseUnavailability(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Req() request: AuthenticatedRequest,
        @Body() dto: ReleaseBlockDto,
    ) {
        return this.adminService.releaseUnavailability(
            id,
            request.user.id,
            dto?.reason,
        );
    }

    // ==========================================
    // 2. REFUSER UNE RÉSERVATION
    // ==========================================

    // Réservé aux administrateurs.
    @Patch('by-number/:reservationNumber/reject')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async rejectReservation(
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
        const reservation = await this.adminService.rejectReservation(reservationNumber, adminId, dto.reason);
        await this.inbox.safelyNotify('rejected', reservation);
        return reservation;
    }

    // ==========================================
    // 3. CONFIRMER UNE RÉSERVATION
    // ==========================================

    // Réservé aux administrateurs.
    @Patch('by-number/:reservationNumber/confirm')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async confirmReservation(
        @Param('reservationNumber')
        reservationNumber: string,

        @Req()
        request: AuthenticatedRequest,
    ) {
        // Récupérer l'identifiant administrateur.
        const adminId = request.user.id;

        // Vérifier le permis et la voiture,
        // puis confirmer la réservation.
        const reservation = await this.adminService.confirmReservation(reservationNumber, adminId);
        await this.inbox.safelyNotify('confirmed', reservation);
        return reservation;
    }

    // ==========================================
    // 3.b MODIFIER UNE RÉSERVATION
    // ==========================================

    // Corrige une réservation en attente ou confirmée (dates, lieux,
    // véhicule). Toutes les règles métier sont réappliquées côté
    // serveur et les prix sont recalculés par le devis canonique.
    @Patch('by-number/:reservationNumber/edit')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    updateReservation(
        @Param('reservationNumber')
        reservationNumber: string,

        @Body()
        dto: UpdateReservationDto,
    ) {
        return this.adminService.updateReservation(
            reservationNumber,
            dto,
        );
    }

    // Prévisualisation : disponibilité et écart de prix, sans écriture.
    @Post('by-number/:reservationNumber/edit/preview')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    previewReservationEdit(
        @Param('reservationNumber')
        reservationNumber: string,

        @Body()
        dto: UpdateReservationDto,
    ) {
        return this.adminService.previewReservationEdit(
            reservationNumber,
            dto,
        );
    }

    // ==========================================
    // 4. ARCHIVER UNE RÉSERVATION
    // ==========================================

    // Retire la réservation de la liste de travail sans la
    // supprimer ni changer son statut. Réversible.
    @Patch('by-number/:reservationNumber/archive')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    archiveReservation(
        @Param('reservationNumber')
        reservationNumber: string,

        @Req()
        request: AuthenticatedRequest,
    ) {
        return this.adminService.archiveReservation(
            reservationNumber,
            request.user.id,
        );
    }

    // ==========================================
    // 5. RESTAURER UNE RÉSERVATION ARCHIVÉE
    // ==========================================

    @Patch('by-number/:reservationNumber/restore')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    restoreReservation(
        @Param('reservationNumber')
        reservationNumber: string,
    ) {
        return this.adminService.restoreReservation(
            reservationNumber,
        );
    }

    // ==========================================
    // 6. SUPPRIMER UNE RÉSERVATION ANNULÉE
    // ==========================================

    // Efface définitivement une réservation annulée. Le service
    // vérifie le statut et refuse toute réservation encore liée
    // à un contrat de location.
    @Delete('by-number/:reservationNumber')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    deleteReservation(
        @Param('reservationNumber')
        reservationNumber: string,
    ) {
        return this.adminService.deleteReservation(
            reservationNumber,
        );
    }
}
