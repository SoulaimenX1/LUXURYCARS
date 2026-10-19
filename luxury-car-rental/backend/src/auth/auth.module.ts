
import { Module, forwardRef } from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import { JwtModule } from '@nestjs/jwt';

import {
  UsersModule,
} from '../users/users.module.js';

import {
  NotificationsModule,
} from '../notifications/notifications.module.js';

import {
  AuthController,
} from './auth.controller.js';

import {
  AuthService,
} from './auth.service.js';

import {
  JwtAuthGuard,
} from './guards/jwt-auth.guard.js';

import {
  RolesGuard,
} from './guards/roles.guard.js';

import {
  AuthRateLimiter,
} from './rate-limit/auth-rate-limiter.service.js';

import {
  AuthRateLimitGuard,
} from './rate-limit/auth-rate-limit.guard.js';

import {
  AUTH_RATE_LIMIT_OPTIONS,
  authRateLimitOptionsFromEnv,
} from './rate-limit/auth-rate-limit.options.js';

@Module({
  imports: [
    UsersModule,

    // Rappel de permis à la connexion : dépendance
    // bidirectionnelle avec les notifications (les contrôleurs
    // de notifications utilisent les guards d'authentification).
    forwardRef(() => NotificationsModule),

    JwtModule.registerAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>(
          'JWT_SECRET',
        ),

        signOptions: {
          // The session stays valid until the user
          // explicitly signs out. 30 days is the
          // practical equivalent of a persistent
          // session (the cookie is cleared on logout).
          expiresIn: '30d',
        },
      }),
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,

    // Limitation de débit de l'authentification (login/inscription).
    AuthRateLimiter,
    AuthRateLimitGuard,
    {
      provide: AUTH_RATE_LIMIT_OPTIONS,
      useFactory: () => authRateLimitOptionsFromEnv(),
    },
  ],

  exports: [
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule { }
