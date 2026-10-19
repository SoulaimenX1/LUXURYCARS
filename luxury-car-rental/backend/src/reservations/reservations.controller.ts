import { InboxService } from '../notifications/inbox.service.js';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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

// DTO de création.
import {
  CreateReservationDto,
} from './dto/create-reservation.dto.js';

// Service de réservation.
import {
  ReservationsService,
} from './reservations.service.js';

// Structure de la requête après
// l'authentification par JWT.
interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService:
      ReservationsService,
    private readonly inbox: InboxService,
  ) {}

  // ==========================================
  // 1. CRÉER UNE RÉSERVATION
  // ==========================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async createReservation(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: CreateReservationDto,
  ) {
    // Identifier le client grâce au JWT.
    const userId = request.user.id;

    // Créer sa réservation.
    const reservation = await this.reservationsService.createReservation(userId, dto);
    await this.inbox.safelyNotify('created', reservation);
    return reservation;
  }

  // ==========================================
  // 2. CONSULTER MES RÉSERVATIONS
  // ==========================================

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  getMyReservations(
    @Req()
    request: AuthenticatedRequest,
  ) {
    // Récupérer l'identifiant du client.
    const userId = request.user.id;

    // Retourner ses réservations.
    return this.reservationsService
      .findMyReservations(userId);
  }

  // ==========================================
  // 3. ANNULER MA RÉSERVATION
  // ==========================================

  @Patch('by-number/:reservationNumber/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async cancelMyReservation(
    @Req()
    request: AuthenticatedRequest,

    @Param('reservationNumber')
    reservationNumber: string,
  ) {
    // Identifier le client connecté.
    const userId = request.user.id;

    // Annuler uniquement une réservation
    // qui appartient à ce client.
    const reservation = await this.reservationsService.cancelMyReservation(userId, reservationNumber);
    await this.inbox.safelyNotify('cancelled', reservation);
    return reservation;
  }
}
