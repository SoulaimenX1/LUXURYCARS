
import {
    Controller,
    Get,
    UseGuards,
} from '@nestjs/common';

import {
    JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
    NotificationsService,
} from './notifications.service.js';

import type {
    PublicNotificationDto,
} from './dto/public-notification.dto.js';

// ==========================================================
// ROUTES DES NOTIFICATIONS
// ==========================================================
//
// GET /notifications
//
// Réservé aux utilisateurs connectés : le flux n'est
// visible que depuis un compte (aucune donnée personnelle
// n'est exposée, mais l'accès nécessite une session).
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(
        private readonly notificationsService:
            NotificationsService,
    ) {}

    @Get()
    findPublished(): Promise<PublicNotificationDto[]> {
        return this.notificationsService.findPublished();
    }
}
