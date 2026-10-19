import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { QuoteDto } from '../premium/dto/quote.dto.js';
import { DeliveryService } from './delivery.service.js';

interface CustomerRequest { user: { id: string } }

// Devis de livraison persisté (validité 15 minutes, revalidé à la
// réservation). Réservé au client connecté : le devis est rattaché à
// son compte, sans jamais accepter un montant de sa part.
@Controller('delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('quotes')
  quote(@Req() req: CustomerRequest, @Body() dto: QuoteDto) {
    return this.delivery.createQuote(dto, req.user.id);
  }
}
