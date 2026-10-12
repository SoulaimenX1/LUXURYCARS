
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';

import {
    FileInterceptor,
} from '@nestjs/platform-express';

// Type du fichier reçu pour une photo de véhicule.
import type {
    UploadedImageFile,
} from './vehicle-images.storage.js';

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
    CreateBrandDto,
} from './dto/create-brand.dto.js';

import {
    CreateCategoryDto,
} from './dto/create-category.dto.js';

import {
    CreateVehicleModelDto,
} from './dto/create-vehicle-model.dto.js';

import {
    CreateVehicleDto,
} from './dto/create-vehicle.dto.js';

// DTO de modification.
import {
    UpdateVehicleDto,
} from './dto/update-vehicle.dto.js';

// DTO de recherche par dates.
import {
    CheckAvailabilityDto,
} from './dto/check-availability.dto.js';

// Service contenant la logique métier.
import {
    VehiclesService,
} from './vehicles.service.js';

@Controller('vehicles')
export class VehiclesController {
    constructor(
        private readonly vehiclesService:
            VehiclesService,
    ) { }

    // ==========================================
    // 1. CONSULTER LES MARQUES
    // ==========================================

    // Route publique.
    @Get('brands')
    getBrands() {
        return this.vehiclesService.findAllBrands();
    }

    // ==========================================
    // 2. CONSULTER LES CATÉGORIES
    // ==========================================

    // Route publique.
    @Get('categories')
    getCategories() {
        return this.vehiclesService.findAllCategories();
    }

    // ==========================================
    // 3. CONSULTER LES MODÈLES
    // ==========================================

    // Route publique.
    @Get('models')
    getModels() {
        return this.vehiclesService.findAllModels();
    }

    // ==========================================
    // 4. CRÉER UNE MARQUE
    // ==========================================

    // Réservé aux administrateurs.
    @Post('brands')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    createBrand(
        @Body() dto: CreateBrandDto,
    ) {
        return this.vehiclesService.createBrand(
            dto,
        );
    }

    // ==========================================
    // 5. CRÉER UNE CATÉGORIE
    // ==========================================

    // Réservé aux administrateurs.
    @Post('categories')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    createCategory(
        @Body() dto: CreateCategoryDto,
    ) {
        return this.vehiclesService.createCategory(
            dto,
        );
    }

    // ==========================================
    // 6. CRÉER UN MODÈLE
    // ==========================================

    // Réservé aux administrateurs.
    @Post('models')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    createModel(
        @Body() dto: CreateVehicleModelDto,
    ) {
        return this.vehiclesService.createModel(
            dto,
        );
    }

    // ==========================================
    // 7. CONSULTER LE CATALOGUE PUBLIC
    // ==========================================

    // Aucun JWT n'est nécessaire.
    @Get('catalog')
    getPublicCatalog() {
        return this.vehiclesService.findPublicCatalog();
    }

    // ==========================================
    // 8. RECHERCHER LES VOITURES DISPONIBLES
    // ==========================================

    // Les visiteurs indiquent leurs dates
    // directement dans l'URL.
    //
    // Exemple :
    // GET /vehicles/available
    //     ?from=2026-10-15&to=2026-10-18

    @Get('available')
    getAvailableVehicles(
        @Query() dto: CheckAvailabilityDto,
    ) {
        return this.vehiclesService
            .findAvailableVehicles(dto);
    }

    // ==========================================
    // 9. CONSULTER LES VOITURES (ADMIN)
    // ==========================================

    // Cette route retourne les données internes.
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    getVehicles() {
        return this.vehiclesService.findAllVehicles();
    }

    // ==========================================
    // 10. ENREGISTRER UNE VOITURE
    // ==========================================

    // Réservé aux administrateurs.
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    createVehicle(
        @Body() dto: CreateVehicleDto,
    ) {
        return this.vehiclesService.createVehicle(
            dto,
        );
    }

    // ==========================================
    // 11. MODIFIER UNE VOITURE
    // ==========================================

    // Identifier la voiture par son immatriculation.
    @Patch('by-plate/:licensePlate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    updateVehicle(
        @Param('licensePlate')
        licensePlate: string,

        @Body()
        dto: UpdateVehicleDto,
    ) {
        return this.vehiclesService.updateVehicle(
            licensePlate,
            dto,
        );
    }

    // ==========================================
    // 12. AJOUTER / REMPLACER LA PHOTO D'UNE VOITURE
    // ==========================================
    //
    // Le formulaire envoie un fichier multipart/form-data
    // dans le champ « image ».
    //
    // Exemple :
    // POST /vehicles/by-plate/TUN-488-FR/image

    @Post('by-plate/:licensePlate/image')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(
        FileInterceptor('image', {
            limits: {
                // Taille maximale : 8 Mo.
                fileSize: 8 * 1024 * 1024,
            },
        }),
    )
    uploadVehicleImage(
        @Param('licensePlate')
        licensePlate: string,

        @UploadedFile()
        file: UploadedImageFile | undefined,
    ) {
        return this.vehiclesService.saveVehicleImage(
            licensePlate,
            file,
        );
    }

    // ==========================================
    // 13. AJOUTER / REMPLACER LA VIDÉO D'UNE VOITURE
    // ==========================================
    //
    // Le formulaire envoie un fichier multipart/form-data
    // dans le champ « video ».
    //
    // Exemple :
    // POST /vehicles/by-plate/TUN-488-FR/video

    @Post('by-plate/:licensePlate/video')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(
        FileInterceptor('video', {
            limits: {
                // Taille maximale : 80 Mo.
                fileSize: 80 * 1024 * 1024,
            },
        }),
    )
    uploadVehicleVideo(
        @Param('licensePlate')
        licensePlate: string,

        @UploadedFile()
        file: UploadedImageFile | undefined,
    ) {
        return this.vehiclesService.saveVehicleVideo(
            licensePlate,
            file,
        );
    }

    // ==========================================
    // 14. SUPPRIMER LA PHOTO D'UNE VOITURE
    // ==========================================
    //
    // Exemple :
    // DELETE /vehicles/by-plate/TUN-488-FR/image

    @Delete('by-plate/:licensePlate/image')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    deleteVehicleImage(
        @Param('licensePlate')
        licensePlate: string,
    ) {
        return this.vehiclesService.deleteVehicleImage(
            licensePlate,
        );
    }

    // ==========================================
    // 15. SUPPRIMER LA VIDÉO D'UNE VOITURE
    // ==========================================
    //
    // Exemple :
    // DELETE /vehicles/by-plate/TUN-488-FR/video

    @Delete('by-plate/:licensePlate/video')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    deleteVehicleVideo(
        @Param('licensePlate')
        licensePlate: string,
    ) {
        return this.vehiclesService.deleteVehicleVideo(
            licensePlate,
        );
    }
}
