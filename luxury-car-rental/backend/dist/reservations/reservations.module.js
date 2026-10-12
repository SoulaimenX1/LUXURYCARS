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
// Modules utilisés pour la sécurité.
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
// Entités PostgreSQL.
import { CustomerProfile } from '../customer-profiles/entities/customer-profile.entity.js';
import { Reservation } from './entities/reservation.entity.js';
// Contrôleur et service des clients.
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';
// Contrôleur et service administratifs.
import { ReservationsAdminController } from './reservations-admin.controller.js';
import { ReservationsAdminService } from './reservations-admin.service.js';
export class ReservationsModule {
}
ReservationsModule = _ts_decorate([
    Module({
        imports: [
            // Donner accès aux tables utilisées
            // par les services de réservation.
            TypeOrmModule.forFeature([
                CustomerProfile,
                Reservation
            ]),
            // Permettre la vérification des JWT.
            AuthModule,
            // Permettre aux Guards de retrouver
            // l'utilisateur connecté.
            UsersModule
        ],
        controllers: [
            // Routes destinées aux clients.
            ReservationsController,
            // Routes destinées à l'administrateur.
            ReservationsAdminController
        ],
        providers: [
            // Logique métier des clients.
            ReservationsService,
            // Logique métier administrative.
            ReservationsAdminService
        ]
    })
], ReservationsModule);

//# sourceMappingURL=reservations.module.js.map