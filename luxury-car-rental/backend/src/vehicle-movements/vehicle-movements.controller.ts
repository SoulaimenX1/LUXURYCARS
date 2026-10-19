import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { VehicleMovementsService } from './vehicle-movements.service.js';
import {
  CreateManualEventDto,
  SetHomeLocationDto,
} from './dto/manual-event.dto.js';

interface AdminRequest { user: { id: string } }

// Registre physique des véhicules (administration uniquement) :
// positions dérivées du dernier événement vérifié + historique
// append-only. Aucune donnée d'adresse ici n'est publique.
@Controller('vehicle-movements/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class VehicleMovementsAdminController {
  constructor(private readonly movements: VehicleMovementsService) {}

  @Get('current')
  current(@Query('vehicleId') vehicleId?: string) {
    return this.movements.current(vehicleId);
  }

  @Get()
  list(
    @Query('vehicleId') vehicleId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : undefined;
    return this.movements.list(vehicleId, Number.isFinite(parsed) ? parsed : undefined);
  }

  @Post()
  create(@Req() req: AdminRequest, @Body() dto: CreateManualEventDto) {
    return this.movements.createManualEvent(dto, req.user.id);
  }

  // Affectation du domicile (≠ position physique courante).
  @Patch('vehicles/:id/home')
  setHome(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetHomeLocationDto,
  ) {
    return this.movements.setHome(id, dto.homeLocationId ?? null);
  }
}
