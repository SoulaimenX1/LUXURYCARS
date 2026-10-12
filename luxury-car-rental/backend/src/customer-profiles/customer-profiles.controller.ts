
import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

// Importer les rôles.
import {
    UserRole,
} from '../users/entities/user.entity.js';

// Importer les Guards de sécurité.
import {
    JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
    RolesGuard,
} from '../auth/guards/roles.guard.js';

// Importer le décorateur des rôles.
import {
    Roles,
} from '../auth/decorators/roles.decorator.js';

// Importer le DTO de création.
import {
    CreateCustomerProfileDto,
} from './dto/create-customer-profile.dto.js';

// Importer le service.
import {
    CustomerProfilesService,
} from './customer-profiles.service.js';

// Cette interface décrit la partie
// de la requête contenant le client connecté.
interface AuthenticatedRequest {
    user: {
        id: string;
    };
}

@Controller('customer-profiles')
export class CustomerProfilesController {
    constructor(
        private readonly customerProfilesService:
            CustomerProfilesService,
    ) { }

    // ==========================================
    // 1. COMPLÉTER SON PROFIL CLIENT
    // ==========================================

    // Le client doit être connecté.
    // Seul le rôle customer est autorisé.
    @Post('me')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CUSTOMER)
    createMyProfile(
        @Req() request: AuthenticatedRequest,

        @Body()
        dto: CreateCustomerProfileDto,
    ) {
        // Récupérer automatiquement
        // l'identifiant du client connecté.
        const userId = request.user.id;

        // Enregistrer son profil.
        return this.customerProfilesService
            .createProfile(userId, dto);
    }

    // ==========================================
    // 1.b METTRE À JOUR SON PROFIL CLIENT
    // ==========================================

    // Le client doit être connecté.
    // Seul le rôle customer est autorisé.
    @Patch('me')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CUSTOMER)
    updateMyProfile(
        @Req() request: AuthenticatedRequest,

        @Body()
        dto: CreateCustomerProfileDto,
    ) {
        // Récupérer automatiquement
        // l'identifiant du client connecté.
        const userId = request.user.id;

        // Mettre à jour son profil.
        return this.customerProfilesService
            .updateProfile(userId, dto);
    }

    // ==========================================
    // 2. CONSULTER SON PROFIL CLIENT
    // ==========================================

    // Le client ne peut consulter
    // que son propre profil.
    @Get('me')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CUSTOMER)
    getMyProfile(
        @Req() request: AuthenticatedRequest,
    ) {
        // Récupérer l'identifiant depuis le JWT.
        const userId = request.user.id;

        // Retourner le profil correspondant.
        return this.customerProfilesService
            .findMyProfile(userId);
    }
}
