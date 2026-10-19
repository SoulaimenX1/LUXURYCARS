import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { ZonesService } from './zones.service.js';
import { ZonesAdminController, ZonesPublicController } from './zones.controller.js';

// Zones de service + règles de tarification de livraison.
@Module({
  imports: [AuthModule, UsersModule],
  providers: [ZonesService],
  controllers: [ZonesPublicController, ZonesAdminController],
  exports: [ZonesService],
})
export class ZonesModule {}
