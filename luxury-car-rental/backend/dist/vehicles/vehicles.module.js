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
import { TypeOrmModule } from '@nestjs/typeorm';
// Modules nécessaires pour l'authentification.
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
// Notifications : créer un avis lors de l'ajout
// d'une nouvelle voiture.
import { NotificationsModule } from '../notifications/notifications.module.js';
// Entités utilisées dans ce module.
import { Brand } from './entities/brand.entity.js';
import { Category } from './entities/category.entity.js';
import { VehicleModel } from './entities/vehicle-model.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { VehicleImage } from './entities/vehicle-image.entity.js';
// Contrôleur et service.
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';
export class VehiclesModule {
}
VehiclesModule = _ts_decorate([
    Module({
        imports: [
            // Donner accès aux tables du module.
            TypeOrmModule.forFeature([
                Brand,
                Category,
                VehicleModel,
                Vehicle,
                VehicleImage
            ]),
            // Permettre la vérification des JWT.
            AuthModule,
            // Permettre aux Guards de retrouver
            // l'utilisateur connecté.
            UsersModule,
            // Accès au service de notifications.
            NotificationsModule
        ],
        controllers: [
            VehiclesController
        ],
        providers: [
            VehiclesService
        ]
    })
], VehiclesModule);

//# sourceMappingURL=vehicles.module.js.map