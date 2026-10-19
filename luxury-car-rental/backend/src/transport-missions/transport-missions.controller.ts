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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { TransportMissionsService, type DriverTransition } from './transport-missions.service.js';
import {
  AssignDriverDto,
  CreateMissionDto,
  MissionActionDto,
  MissionListQueryDto,
} from './dto/mission.dto.js';

type AuthedRequest = { user: { id: string; role: string } };

// ============================================================
// ADMINISTRATION — EXPÉDITION MANUELLE DES MISSIONS
// ============================================================
@Controller('transport-missions/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TransportMissionsAdminController {
  constructor(private readonly missions: TransportMissionsService) {}

  @Get()
  list(@Query() query: MissionListQueryDto) {
    return this.missions.list(query);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateMissionDto) {
    return this.missions.create(req.user.id, body);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.missions.detail(id);
  }

  @Patch(':id/assign')
  assign(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AssignDriverDto,
  ) {
    return this.missions.assign(req.user.id, id, body);
  }

  @Post(':id/cancel')
  cancel(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MissionActionDto,
  ) {
    return this.missions.cancel(req.user.id, id, body);
  }
}

// ============================================================
// CHAUFFEUR — PORTAIL (rôle staff : un profil chauffeur actif
// doit être affecté ; aucune transition sur les missions d'autrui)
// ============================================================
@Controller('transport-missions/driver')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.ADMIN)
export class TransportMissionsDriverController {
  constructor(private readonly missions: TransportMissionsService) {}

  @Get('missions')
  mine(@Req() req: AuthedRequest, @Query('limit') limit?: string) {
    const parsed = Number(limit);
    const bounded = Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 50;
    return this.missions.driverMissions(req.user.id, bounded);
  }

  private act(
    req: AuthedRequest,
    id: string,
    action: DriverTransition,
    body: MissionActionDto,
  ) {
    return this.missions.transition(req.user.id, id, action, body);
  }

  @Post('missions/:id/accept')
  accept(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MissionActionDto,
  ) {
    return this.act(req, id, 'accept', body);
  }

  @Post('missions/:id/start')
  start(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MissionActionDto,
  ) {
    return this.act(req, id, 'start', body);
  }

  @Post('missions/:id/pause')
  pause(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MissionActionDto,
  ) {
    return this.act(req, id, 'pause', body);
  }

  @Post('missions/:id/resume')
  resume(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MissionActionDto,
  ) {
    return this.act(req, id, 'resume', body);
  }

  @Post('missions/:id/complete')
  complete(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MissionActionDto,
  ) {
    return this.act(req, id, 'complete', body);
  }

  @Post('missions/:id/fail')
  fail(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: MissionActionDto,
  ) {
    return this.act(req, id, 'fail', body);
  }
}
