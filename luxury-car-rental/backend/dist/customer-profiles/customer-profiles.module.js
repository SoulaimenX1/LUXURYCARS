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
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { CustomerProfile } from './entities/customer-profile.entity.js';
import { CustomerProfilesController } from './customer-profiles.controller.js';
import { CustomerProfilesService } from './customer-profiles.service.js';
export class CustomerProfilesModule {
}
CustomerProfilesModule = _ts_decorate([
    Module({
        imports: [
            TypeOrmModule.forFeature([
                CustomerProfile
            ]),
            AuthModule,
            UsersModule
        ],
        controllers: [
            // Le profil client et le permis sont gérés
            // uniquement par le client connecté.
            CustomerProfilesController
        ],
        providers: [
            // Aucune validation administrative manuelle
            // du permis n'est nécessaire.
            CustomerProfilesService
        ]
    })
], CustomerProfilesModule);

//# sourceMappingURL=customer-profiles.module.js.map