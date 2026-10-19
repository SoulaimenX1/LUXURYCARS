import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { RentalsService } from './rentals.service.js';

interface CustomerRequest {
  user: { id: string };
}

// Chaque client consulte exclusivement ses propres locations.
@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class RentalsCustomerController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get('me')
  findMine(@Req() request: CustomerRequest) {
    return this.rentalsService.findMyRentals(request.user.id);
  }
}
