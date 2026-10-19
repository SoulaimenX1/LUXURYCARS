import { NotificationsModule } from '../notifications/notifications.module.js';
import {
    Module,
} from '@nestjs/common';

import {
    TypeOrmModule,
} from '@nestjs/typeorm';

import {
    AuthModule,
} from '../auth/auth.module.js';

import {
    UsersModule,
} from '../users/users.module.js';

import {
    CustomerProfile,
} from './entities/customer-profile.entity.js';

import {
    CustomerProfilesController,
} from './customer-profiles.controller.js';

import {
    CustomerProfilesService,
} from './customer-profiles.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CustomerProfile,
        ]),

        AuthModule,
        UsersModule,
        NotificationsModule,
    ],

    controllers: [
        // Le profil client et le permis sont gérés
        // uniquement par le client connecté.
        CustomerProfilesController,
    ],

    providers: [
        // Aucune validation administrative manuelle
        // du permis n'est nécessaire.
        CustomerProfilesService,
    ],
})
export class CustomerProfilesModule { }

