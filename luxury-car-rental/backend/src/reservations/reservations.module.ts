import { NotificationsModule } from '../notifications/notifications.module.js';
import { PremiumModule } from '../premium/premium.module.js';
import { AvailabilityModule } from '../availability/availability.module.js';

import {
    Module,
} from '@nestjs/common';

import {
    TypeOrmModule,
} from '@nestjs/typeorm';

// Modules utilisés pour la sécurité.
import {
    AuthModule,
} from '../auth/auth.module.js';

import {
    UsersModule,
} from '../users/users.module.js';

// Entités PostgreSQL.
import {
    CustomerProfile,
} from '../customer-profiles/entities/customer-profile.entity.js';

import {
    Reservation,
} from './entities/reservation.entity.js';

// Contrôleur et service des clients.
import {
    ReservationsController,
} from './reservations.controller.js';

import {
    ReservationsService,
} from './reservations.service.js';

// Contrôleur et service administratifs.
import {
    ReservationsAdminController,
} from './reservations-admin.controller.js';

import {
    ReservationsAdminService,
} from './reservations-admin.service.js';

@Module({
    imports: [
        // Donner accès aux tables utilisées
        // par les services de réservation.
        TypeOrmModule.forFeature([
            CustomerProfile,
            Reservation,
        ]),

        // Permettre la vérification des JWT.
        AuthModule,

        // Permettre aux Guards de retrouver
        // l'utilisateur connecté.
        UsersModule,
        PremiumModule,
        AvailabilityModule,
        NotificationsModule,
    ],

    controllers: [
        // Routes destinées aux clients.
        ReservationsController,

        // Routes destinées à l'administrateur.
        ReservationsAdminController,
    ],

    providers: [
        // Logique métier des clients.
        ReservationsService,

        // Logique métier administrative.
        ReservationsAdminService,
    ],
})
export class ReservationsModule { }
