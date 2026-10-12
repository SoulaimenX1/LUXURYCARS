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
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
// Rôles des utilisateurs.
import { UserRole } from '../users/entities/user.entity.js';
// Guards de sécurité.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
// Décorateur des permissions.
import { Roles } from '../auth/decorators/roles.decorator.js';
// DTO de création.
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { CreateVehicleModelDto } from './dto/create-vehicle-model.dto.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
// DTO de modification.
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
// DTO de recherche par dates.
import { CheckAvailabilityDto } from './dto/check-availability.dto.js';
// Service contenant la logique métier.
import { VehiclesService } from './vehicles.service.js';
export class VehiclesController {
    // ==========================================
    // 1. CONSULTER LES MARQUES
    // ==========================================
    // Route publique.
    getBrands() {
        return this.vehiclesService.findAllBrands();
    }
    // ==========================================
    // 2. CONSULTER LES CATÉGORIES
    // ==========================================
    // Route publique.
    getCategories() {
        return this.vehiclesService.findAllCategories();
    }
    // ==========================================
    // 3. CONSULTER LES MODÈLES
    // ==========================================
    // Route publique.
    getModels() {
        return this.vehiclesService.findAllModels();
    }
    // ==========================================
    // 4. CRÉER UNE MARQUE
    // ==========================================
    // Réservé aux administrateurs.
    createBrand(dto) {
        return this.vehiclesService.createBrand(dto);
    }
    // ==========================================
    // 5. CRÉER UNE CATÉGORIE
    // ==========================================
    // Réservé aux administrateurs.
    createCategory(dto) {
        return this.vehiclesService.createCategory(dto);
    }
    // ==========================================
    // 6. CRÉER UN MODÈLE
    // ==========================================
    // Réservé aux administrateurs.
    createModel(dto) {
        return this.vehiclesService.createModel(dto);
    }
    // ==========================================
    // 7. CONSULTER LE CATALOGUE PUBLIC
    // ==========================================
    // Aucun JWT n'est nécessaire.
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
    getAvailableVehicles(dto) {
        return this.vehiclesService.findAvailableVehicles(dto);
    }
    // ==========================================
    // 9. CONSULTER LES VOITURES (ADMIN)
    // ==========================================
    // Cette route retourne les données internes.
    getVehicles() {
        return this.vehiclesService.findAllVehicles();
    }
    // ==========================================
    // 10. ENREGISTRER UNE VOITURE
    // ==========================================
    // Réservé aux administrateurs.
    createVehicle(dto) {
        return this.vehiclesService.createVehicle(dto);
    }
    // ==========================================
    // 11. MODIFIER UNE VOITURE
    // ==========================================
    // Identifier la voiture par son immatriculation.
    updateVehicle(licensePlate, dto) {
        return this.vehiclesService.updateVehicle(licensePlate, dto);
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
    uploadVehicleImage(licensePlate, file) {
        return this.vehiclesService.saveVehicleImage(licensePlate, file);
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
    uploadVehicleVideo(licensePlate, file) {
        return this.vehiclesService.saveVehicleVideo(licensePlate, file);
    }
    // ==========================================
    // 14. SUPPRIMER LA PHOTO D'UNE VOITURE
    // ==========================================
    //
    // Exemple :
    // DELETE /vehicles/by-plate/TUN-488-FR/image
    deleteVehicleImage(licensePlate) {
        return this.vehiclesService.deleteVehicleImage(licensePlate);
    }
    // ==========================================
    // 15. SUPPRIMER LA VIDÉO D'UNE VOITURE
    // ==========================================
    //
    // Exemple :
    // DELETE /vehicles/by-plate/TUN-488-FR/video
    deleteVehicleVideo(licensePlate) {
        return this.vehiclesService.deleteVehicleVideo(licensePlate);
    }
    constructor(vehiclesService){
        this.vehiclesService = vehiclesService;
    }
}
_ts_decorate([
    Get('brands'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "getBrands", null);
_ts_decorate([
    Get('categories'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "getCategories", null);
_ts_decorate([
    Get('models'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "getModels", null);
_ts_decorate([
    Post('brands'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof CreateBrandDto === "undefined" ? Object : CreateBrandDto
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "createBrand", null);
_ts_decorate([
    Post('categories'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof CreateCategoryDto === "undefined" ? Object : CreateCategoryDto
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "createCategory", null);
_ts_decorate([
    Post('models'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof CreateVehicleModelDto === "undefined" ? Object : CreateVehicleModelDto
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "createModel", null);
_ts_decorate([
    Get('catalog'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "getPublicCatalog", null);
_ts_decorate([
    Get('available'),
    _ts_param(0, Query()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof CheckAvailabilityDto === "undefined" ? Object : CheckAvailabilityDto
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "getAvailableVehicles", null);
_ts_decorate([
    Get(),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "getVehicles", null);
_ts_decorate([
    Post(),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof CreateVehicleDto === "undefined" ? Object : CreateVehicleDto
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "createVehicle", null);
_ts_decorate([
    Patch('by-plate/:licensePlate'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Param('licensePlate')),
    _ts_param(1, Body()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        typeof UpdateVehicleDto === "undefined" ? Object : UpdateVehicleDto
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "updateVehicle", null);
_ts_decorate([
    Post('by-plate/:licensePlate/image'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    UseInterceptors(FileInterceptor('image', {
        limits: {
            // Taille maximale : 8 Mo.
            fileSize: 8 * 1024 * 1024
        }
    })),
    _ts_param(0, Param('licensePlate')),
    _ts_param(1, UploadedFile()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "uploadVehicleImage", null);
_ts_decorate([
    Post('by-plate/:licensePlate/video'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    UseInterceptors(FileInterceptor('video', {
        limits: {
            // Taille maximale : 80 Mo.
            fileSize: 80 * 1024 * 1024
        }
    })),
    _ts_param(0, Param('licensePlate')),
    _ts_param(1, UploadedFile()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "uploadVehicleVideo", null);
_ts_decorate([
    Delete('by-plate/:licensePlate/image'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Param('licensePlate')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "deleteVehicleImage", null);
_ts_decorate([
    Delete('by-plate/:licensePlate/video'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    _ts_param(0, Param('licensePlate')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", void 0)
], VehiclesController.prototype, "deleteVehicleVideo", null);
VehiclesController = _ts_decorate([
    Controller('vehicles'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof VehiclesService === "undefined" ? Object : VehiclesService
    ])
], VehiclesController);

//# sourceMappingURL=vehicles.controller.js.map