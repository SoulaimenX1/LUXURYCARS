import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { ZonesService } from './zones.service.js';
import { CheckAddressDto } from './dto/check-address.dto.js';
import { CreateZoneDto, UpdateZoneDto } from './dto/zone-admin.dto.js';
import { CreatePricingRuleDto, UpdatePricingRuleDto } from './dto/pricing-rule.dto.js';

// Lecture publique des zones activées (aucune donnée interne).
@Controller('service-zones')
export class ZonesPublicController {
  constructor(private readonly zones: ZonesService) {}

  @Get()
  list() {
    return this.zones.listPublic();
  }

  // Verdict d'éligibilité d'une adresse : calculé par le serveur,
  // jamais par le navigateur.
  @Post('check-address')
  check(@Body() dto: CheckAddressDto) {
    return this.zones.checkAddress(dto);
  }
}

// Administration des zones et de leurs règles de tarification.
@Controller('service-zones/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ZonesAdminController {
  constructor(private readonly zones: ZonesService) {}

  @Get()
  list() {
    return this.zones.listAdmin();
  }

  @Get('pricing-rules')
  listRules(@Query('zoneId') zoneId?: string) {
    return this.zones.listRules(zoneId);
  }

  @Post()
  create(@Body() dto: CreateZoneDto) {
    return this.zones.createZone(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.zones.updateZone(id, dto);
  }

  @Post(':zoneId/pricing-rules')
  createRule(
    @Param('zoneId', new ParseUUIDPipe({ version: '4' })) zoneId: string,
    @Body() dto: CreatePricingRuleDto,
  ) {
    return this.zones.createRule(zoneId, dto);
  }

  @Patch('pricing-rules/:ruleId')
  updateRule(
    @Param('ruleId', new ParseUUIDPipe({ version: '4' })) ruleId: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    return this.zones.updateRule(ruleId, dto);
  }
}
