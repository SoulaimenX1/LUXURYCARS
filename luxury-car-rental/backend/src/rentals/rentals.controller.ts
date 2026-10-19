import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { StartRentalDto } from './dto/start-rental.dto.js';
import { ExtendRentalDto } from './dto/extend-rental.dto.js';
import { RentalsService } from './rentals.service.js';

interface AdminRequest { user: { id: string } }

@Controller('rentals/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  // Consultation des locations réservée à l'administrateur.
  @Get()
  findAll() {
    return this.rentalsService.findAll();
  }

  // Prolongation administrateur uniquement : le service contrôle les collisions.
  @Post(':rentalId/extend')
  extendRental(
    @Param('rentalId', new ParseUUIDPipe({ version: '4' })) rentalId: string,
    @Body() dto: ExtendRentalDto,
    @Req() request: AdminRequest,
  ) {
    return this.rentalsService.extendRental(request.user.id, rentalId, dto);
  }

  // Conversion d'une réservation confirmée en location active.
  @Post('start')
  startRental(@Body() dto: StartRentalDto, @Req() request: AdminRequest) {
    return this.rentalsService.startRental(request.user.id, dto);
  }
}
