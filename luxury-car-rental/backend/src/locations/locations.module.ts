import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { LocationsService } from './locations.service.js';
import {
  LocationsAdminController,
  LocationsController,
} from './locations.controller.js';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [LocationsService],
  controllers: [LocationsController, LocationsAdminController],
  exports: [LocationsService],
})
export class LocationsModule {}
