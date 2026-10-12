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
import { Module } from '@nestjs/common';
// ==========================================
// MODULES DE SÉCURITÉ EXISTANTS
// ==========================================
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
// ==========================================
// CONTRÔLEUR ET SERVICE
// ==========================================
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
export class DashboardModule {
}
DashboardModule = _ts_decorate([
    Module({
        imports: [
            // Réutiliser le système JWT existant.
            AuthModule,
            // Réutiliser la gestion des utilisateurs.
            UsersModule
        ],
        controllers: [
            // Exposer les routes du dashboard.
            DashboardController
        ],
        providers: [
            // Calculer les statistiques PostgreSQL.
            DashboardService
        ]
    })
], DashboardModule);

//# sourceMappingURL=dashboard.module.js.map