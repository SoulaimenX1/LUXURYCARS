import { Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { AdminCustomersService } from './admin-customers.service.js';

// Administrateur authentifié, renseigné par le JwtAuthGuard.
interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCustomersController {
  constructor(private readonly service: AdminCustomersService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findById(id);
  }

  // Suspendre un compte client (identifiant administrateur depuis le JWT).
  @Patch(':id/suspend')
  suspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.suspendCustomer(id, request.user.id);
  }

  // Réactiver un compte client précédemment suspendu.
  @Patch(':id/reactivate')
  reactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reactivateCustomer(id, request.user.id);
  }
}