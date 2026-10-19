import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { VehicleMovementsService } from './vehicle-movements.service.js';
import { VehicleMovementsAdminController } from './vehicle-movements.controller.js';

// Registre de localisation physique des véhicules (admin).
@Module({
  imports: [AuthModule, UsersModule],
  providers: [VehicleMovementsService],
  controllers: [VehicleMovementsAdminController],
  exports: [VehicleMovementsService],
})
export class VehicleMovementsModule {}
