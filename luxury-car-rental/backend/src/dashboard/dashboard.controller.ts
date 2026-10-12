
import {
    Controller,
    Get,
    UseGuards,
} from '@nestjs/common';

// ==========================================
// RÔLES DES UTILISATEURS
// ==========================================

import {
    UserRole,
} from '../users/entities/user.entity.js';

// ==========================================
// GUARDS DE SÉCURITÉ
// ==========================================

import {
    JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
    RolesGuard,
} from '../auth/guards/roles.guard.js';

// ==========================================
// DÉCORATEUR DES PERMISSIONS
// ==========================================

import {
    Roles,
} from '../auth/decorators/roles.decorator.js';

// ==========================================
// SERVICE DU DASHBOARD
// ==========================================

import {
    DashboardService,
} from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
    constructor(
        private readonly dashboardService:
            DashboardService,
    ) { }

    // ==========================================
    // 1. CONSULTER LE DASHBOARD ADMINISTRATEUR
    // ==========================================

    // Vérifier que l'utilisateur possède
    // un JWT valide et le rôle administrateur.
    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    getAdminDashboard() {
        // Récupérer les statistiques générales :
        // - véhicules par statut ;
        // - réservations par statut ;
        // - nombre de profils clients.
        return this.dashboardService.getSummary();
    }
}
