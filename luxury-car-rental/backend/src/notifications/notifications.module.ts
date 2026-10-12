
import { Module } from '@nestjs/common';

import {
  TypeOrmModule,
} from '@nestjs/typeorm';

// Authentification : le flux de notifications est
// réservé aux visiteurs connectés.
import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  UsersModule,
} from '../users/users.module.js';

import {
  Notification,
} from './entities/notification.entity.js';

import {
  NotificationsController,
} from './notifications.controller.js';

import {
  NotificationsService,
} from './notifications.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    AuthModule,
    UsersModule,
  ],

  controllers: [
    NotificationsController,
  ],

  providers: [
    NotificationsService,
  ],

  // Exporter le service pour que VehiclesModule puisse
  // créer une notification lors de l'ajout d'une voiture.
  exports: [
    NotificationsService,
  ],
})
export class NotificationsModule {}
