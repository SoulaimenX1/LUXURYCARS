import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module.js';
import { AvailabilityService } from './availability.service.js';
import {
  AvailabilityCheckController,
  AvailabilityController,
} from './availability.controller.js';

@Module({
  imports: [LocationsModule],
  providers: [AvailabilityService],
  controllers: [AvailabilityController, AvailabilityCheckController],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
