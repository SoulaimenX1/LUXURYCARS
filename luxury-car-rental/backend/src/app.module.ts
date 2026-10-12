
import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  TypeOrmModule,
} from '@nestjs/typeorm';

// ==========================================
// FICHIERS PRINCIPAUX DE L'APPLICATION
// ==========================================

import {
  AppController,
} from './app.controller.js';

import {
  AppService,
} from './app.service.js';

// ==========================================
// CONFIGURATION DE L'ENVIRONNEMENT
// ==========================================

import {
  envSchema,
} from './config/env.schema.js';

// ==========================================
// CONFIGURATION POSTGRESQL
// ==========================================

import {
  createDatabaseConfig,
} from './database/database.config.js';

// ==========================================
// MODULES DE L'APPLICATION
// ==========================================

// Gestion des utilisateurs.
import {
  UsersModule,
} from './users/users.module.js';

// Notifications du site (nouveautés, éditions limitées).
import {
  NotificationsModule,
} from './notifications/notifications.module.js';

// Inscription, connexion et sécurité JWT.
import {
  AuthModule,
} from './auth/auth.module.js';

// Profil général de l'utilisateur.
import {
  ProfileModule,
} from './profile/profile.module.js';

// Marques, modèles, véhicules et disponibilité.
import {
  VehiclesModule,
} from './vehicles/vehicles.module.js';

// Profil client et permis de conduire.
import {
  CustomerProfilesModule,
} from './customer-profiles/customer-profiles.module.js';

// Gestion des réservations.
import {
  ReservationsModule,
} from './reservations/reservations.module.js';

// Nouveau module du tableau de bord.
import {
  DashboardModule,
} from './dashboard/dashboard.module.js';

@Module({
  imports: [
    // ======================================
    // 1. VARIABLES D'ENVIRONNEMENT
    // ======================================

    ConfigModule.forRoot({
      // Rendre la configuration accessible
      // depuis tous les modules.
      isGlobal: true,

      // Mettre en cache les valeurs lues.
      cache: true,

      // Vérifier les variables du fichier .env.
      validate: (
        config: Record<string, unknown>,
      ) => envSchema.parse(config),
    }),

    // ======================================
    // 2. CONNEXION À POSTGRESQL
    // ======================================

    TypeOrmModule.forRootAsync({
      imports: [
        ConfigModule,
      ],

      inject: [
        ConfigService,
      ],

      // Réutiliser la configuration existante.
      useFactory: createDatabaseConfig,
    }),

    // ======================================
    // 3. MODULES MÉTIER
    // ======================================

    UsersModule,

    AuthModule,

    ProfileModule,

    VehiclesModule,

    CustomerProfilesModule,

    ReservationsModule,

    // Activer les routes du tableau de bord.
    DashboardModule,

    // Flux public de notifications.
    NotificationsModule,
  ],

  // ========================================
  // CONTRÔLEURS PRINCIPAUX
  // ========================================

  controllers: [
    AppController,
  ],

  // ========================================
  // SERVICES PRINCIPAUX
  // ========================================

  providers: [
    AppService,
  ],
})
export class AppModule { }
