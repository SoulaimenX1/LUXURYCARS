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
import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
// Importer les rôles.
import { UserRole } from '../users/entities/user.entity.js';
// Importer les Guards de sécurité.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
// Importer le décorateur des rôles.
import { Roles } from '../auth/decorators/roles.decorator.js';
// Importer le DTO de création.
import { CreateCustomerProfileDto } from './dto/create-customer-profile.dto.js';
// Importer le service.
import { CustomerProfilesService } from './customer-profiles.service.js';
export class CustomerProfilesController {
    // ==========================================
    // 1. COMPLÉTER SON PROFIL CLIENT
    // ==========================================
    // Le client doit être connecté.
    // Seul le rôle customer est autorisé.
    createMyProfile(request, dto) {
        // Récupérer automatiquement
        // l'identifiant du client connecté.
        const userId = request.user.id;
        // Enregistrer son profil.
        return this.customerProfilesService.createProfile(userId, dto);
    }
    // ==========================================
    // 1.b METTRE À JOUR SON PROFIL CLIENT
    // ==========================================
    // Le client doit être connecté.
    // Seul le rôle customer est autorisé.
    updateMyProfile(request, dto) {
        // Récupérer automatiquement
        // l'identifiant du client connecté.
        const userId = request.user.id;
        // Mettre à jour son profil.
        return this.customerProfilesService.updateProfile(userId, dto);
    }
    // ==========================================
    // 2. CONSULTER SON PROFIL CLIENT
    // ==========================================
    // Le client ne peut consulter
    // que son propre profil.
    getMyProfile(request) {
        // Récupérer l'identifiant depuis le JWT.
        const userId = request.user.id;
        // Retourner le profil correspondant.
        return this.customerProfilesService.findMyProfile(userId);
    }
    constructor(customerProfilesService){
        this.customerProfilesService = customerProfilesService;
    }
}
_ts_decorate([
    Post('me'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.CUSTOMER),
    _ts_param(0, Req()),
    _ts_param(1, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof AuthenticatedRequest === "undefined" ? Object : AuthenticatedRequest,
        typeof CreateCustomerProfileDto === "undefined" ? Object : CreateCustomerProfileDto
    ]),
    _ts_metadata("design:returntype", void 0)
], CustomerProfilesController.prototype, "createMyProfile", null);
_ts_decorate([
    Patch('me'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.CUSTOMER),
    _ts_param(0, Req()),
    _ts_param(1, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof AuthenticatedRequest === "undefined" ? Object : AuthenticatedRequest,
        typeof CreateCustomerProfileDto === "undefined" ? Object : CreateCustomerProfileDto
    ]),
    _ts_metadata("design:returntype", void 0)
], CustomerProfilesController.prototype, "updateMyProfile", null);
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
], CustomerProfilesController.prototype, "getMyProfile", null);
CustomerProfilesController = _ts_decorate([
    Controller('customer-profiles'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof CustomerProfilesService === "undefined" ? Object : CustomerProfilesService
    ])
], CustomerProfilesController);

//# sourceMappingURL=customer-profiles.controller.js.map