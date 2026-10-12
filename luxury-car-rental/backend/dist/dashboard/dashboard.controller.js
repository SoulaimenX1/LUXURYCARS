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
import { Controller, Get, UseGuards } from '@nestjs/common';
// ==========================================
// RÔLES DES UTILISATEURS
// ==========================================
import { UserRole } from '../users/entities/user.entity.js';
// ==========================================
// GUARDS DE SÉCURITÉ
// ==========================================
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
// ==========================================
// DÉCORATEUR DES PERMISSIONS
// ==========================================
import { Roles } from '../auth/decorators/roles.decorator.js';
// ==========================================
// SERVICE DU DASHBOARD
// ==========================================
import { DashboardService } from './dashboard.service.js';
export class DashboardController {
    // ==========================================
    // 1. CONSULTER LE DASHBOARD ADMINISTRATEUR
    // ==========================================
    // Vérifier que l'utilisateur possède
    // un JWT valide et le rôle administrateur.
    getAdminDashboard() {
        // Récupérer les statistiques générales :
        // - véhicules par statut ;
        // - réservations par statut ;
        // - nombre de profils clients.
        return this.dashboardService.getSummary();
    }
    constructor(dashboardService){
        this.dashboardService = dashboardService;
    }
}
_ts_decorate([
    Get('admin'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], DashboardController.prototype, "getAdminDashboard", null);
DashboardController = _ts_decorate([
    Controller('dashboard'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof DashboardService === "undefined" ? Object : DashboardService
    ])
], DashboardController);

//# sourceMappingURL=dashboard.controller.js.map