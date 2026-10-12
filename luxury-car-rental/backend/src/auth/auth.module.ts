
import { Module } from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import { JwtModule } from '@nestjs/jwt';

import {
  UsersModule,
} from '../users/users.module.js';

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

@Module({
  imports: [
    UsersModule,

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
  ],

  exports: [
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule { }
