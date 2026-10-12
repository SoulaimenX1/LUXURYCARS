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
// Authentification : le flux de notifications est
// réservé aux visiteurs connectés.
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { Notification } from './entities/notification.entity.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
export class NotificationsModule {
}
NotificationsModule = _ts_decorate([
    Module({
        imports: [
            TypeOrmModule.forFeature([
                Notification
            ]),
            AuthModule,
            UsersModule
        ],
        controllers: [
            NotificationsController
        ],
        providers: [
            NotificationsService
        ],
        // Exporter le service pour que VehiclesModule puisse
        // créer une notification lors de l'ajout d'une voiture.
        exports: [
            NotificationsService
        ]
    })
], NotificationsModule);

//# sourceMappingURL=notifications.module.js.map