
import {
    Module,
} from '@nestjs/common';

// ==========================================
// MODULES DE SÉCURITÉ EXISTANTS
// ==========================================

import {
    AuthModule,
} from '../auth/auth.module.js';

import {
    UsersModule,
} from '../users/users.module.js';

// ==========================================
// CONTRÔLEUR ET SERVICE
// ==========================================

import {
    DashboardController,
} from './dashboard.controller.js';

import {
    DashboardService,
} from './dashboard.service.js';

@Module({
    imports: [
        // Réutiliser le système JWT existant.
        AuthModule,

        // Réutiliser la gestion des utilisateurs.
        UsersModule,
    ],

    controllers: [
        // Exposer les routes du dashboard.
        DashboardController,
    ],

    providers: [
        // Calculer les statistiques PostgreSQL.
        DashboardService,
    ],
})
export class DashboardModule { }
