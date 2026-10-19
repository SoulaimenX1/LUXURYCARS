import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { TransportMissionsService } from './transport-missions.service.js';
import {
  TransportMissionsAdminController,
  TransportMissionsDriverController,
} from './transport-missions.controller.js';

// Missions de transport : expédition manuelle (admin) + exécution
// (chauffeur, rôle staff). Aucun calcul tarifaire ici.
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TransportMissionsAdminController, TransportMissionsDriverController],
  providers: [TransportMissionsService],
  exports: [TransportMissionsService],
})
export class TransportMissionsModule {}
