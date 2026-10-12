
import { Module } from '@nestjs/common';

import {
  TypeOrmModule,
} from '@nestjs/typeorm';

// Modules nécessaires pour l'authentification.
import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  UsersModule,
} from '../users/users.module.js';

// Notifications : créer un avis lors de l'ajout
// d'une nouvelle voiture.
import {
  NotificationsModule,
} from '../notifications/notifications.module.js';

// Entités utilisées dans ce module.
import {
  Brand,
} from './entities/brand.entity.js';

import {
  Category,
} from './entities/category.entity.js';

import {
  VehicleModel,
} from './entities/vehicle-model.entity.js';

import {
  Vehicle,
} from './entities/vehicle.entity.js';

import {
  VehicleImage,
} from './entities/vehicle-image.entity.js';

// Contrôleur et service.
import {
  VehiclesController,
} from './vehicles.controller.js';

import {
  VehiclesService,
} from './vehicles.service.js';

@Module({
  imports: [
    // Donner accès aux tables du module.
    TypeOrmModule.forFeature([
      Brand,
      Category,
      VehicleModel,
      Vehicle,
      VehicleImage,
    ]),

    // Permettre la vérification des JWT.
    AuthModule,

    // Permettre aux Guards de retrouver
    // l'utilisateur connecté.
    UsersModule,

    // Accès au service de notifications.
    NotificationsModule,
  ],

  controllers: [
    VehiclesController,
  ],

  providers: [
    VehiclesService,
  ],
})
export class VehiclesModule { }
