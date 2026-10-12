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
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
export class AuthModule {
}
AuthModule = _ts_decorate([
    Module({
        imports: [
            UsersModule,
            JwtModule.registerAsync({
                imports: [
                    ConfigModule
                ],
                inject: [
                    ConfigService
                ],
                useFactory: (config)=>({
                        secret: config.getOrThrow('JWT_SECRET'),
                        signOptions: {
                            // The session stays valid until the user
                            // explicitly signs out. 30 days is the
                            // practical equivalent of a persistent
                            // session (the cookie is cleared on logout).
                            expiresIn: '30d'
                        }
                    })
            })
        ],
        controllers: [
            AuthController
        ],
        providers: [
            AuthService,
            JwtAuthGuard,
            RolesGuard
        ],
        exports: [
            JwtModule,
            JwtAuthGuard,
            RolesGuard
        ]
    })
], AuthModule);

//# sourceMappingURL=auth.module.js.map