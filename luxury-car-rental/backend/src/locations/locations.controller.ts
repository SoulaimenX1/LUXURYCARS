import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { LocationsService, type LocationScope } from './locations.service.js';
import { AssignVehiclesDto } from './dto/assign-vehicles.dto.js';

// Route publique : lieux réels où récupérer un véhicule précis.
@Controller('vehicles')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get(':vehicleId/locations')
  forVehicle(
    @Param('vehicleId', new ParseUUIDPipe({ version: '4' })) vehicleId: string,
    @Query('scope') scope?: string,
  ) {
    // Compatibilité ascendante : sans `scope`, on conserve la liste des
    // points de prise en charge.
    const resolved: LocationScope =
      scope === 'dropoff' || scope === 'all' || scope === 'pickup'
        ? scope
        : scope === undefined
          ? 'pickup'
          : (() => {
              throw new BadRequestException('scope must be pickup, dropoff or all');
            })();
    return this.locations.listForVehicle(vehicleId, resolved);
  }
}

// Routes administratives : gestion des affectations véhicule <-> lieu.
@Controller('locations/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LocationsAdminController {
  constructor(private readonly locations: LocationsService) {}

  @Get('vehicles')
  vehicles() {
    return this.locations.listVehiclesForAssignment();
  }

  @Get(':locationId/vehicles')
  async assigned(@Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string) {
    return { vehicleIds: await this.locations.assignedVehicleIds(locationId) };
  }

  @Post(':locationId/vehicles')
  assign(
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() body: AssignVehiclesDto,
  ) {
    return this.locations.setAssignedVehicles(locationId, body.vehicleIds);
  }
}
