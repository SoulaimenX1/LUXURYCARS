import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service.js';
import {
  AlternativesQueryDto,
  CalendarQueryDto,
  CheckIntervalDto,
} from './dto/availability.dto.js';

// Calendrier public d'un véhicule précis dans un lieu précis.
@Controller('vehicles')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get(':vehicleId/availability-calendar')
  calendar(
    @Param('vehicleId', new ParseUUIDPipe({ version: '4' })) vehicleId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.availability.calendar(vehicleId, query.locationId, query.month, query.dropoffLocationId);
  }
}

// Validation d'un intervalle complet avant confirmation.
@Controller('availability')
export class AvailabilityCheckController {
  constructor(private readonly availability: AvailabilityService) {}

  @Post('check')
  check(@Body() body: CheckIntervalDto) {
    // Décomposition explicite (jamais le spread d'une instance de
    // classe) : le DTO accepte la forme complète porte-à-porte
    // (même contrat que la réservation) ; le service n'a besoin
    // que de la ville et du pays pour la validation de zone.
    const {
      vehicleId,
      pickupLocationId,
      dropoffLocationId,
      pickupAt,
      returnAt,
      pickupServiceMode,
      dropoffServiceMode,
      pickupDoor,
      dropoffDoor,
    } = body;
    return this.availability.check({
      vehicleId,
      pickupLocationId,
      dropoffLocationId,
      pickupAt,
      returnAt,
      pickupServiceMode,
      dropoffServiceMode,
      pickupDoor: pickupDoor?.address
        ? {
            city: pickupDoor.address.city,
            countryCode: pickupDoor.address.countryCode,
          }
        : undefined,
      dropoffDoor: dropoffDoor?.address
        ? {
            city: dropoffDoor.address.city,
            countryCode: dropoffDoor.address.countryCode,
          }
        : undefined,
    });
  }

  // Prochaine période disponible pour le même véhicule +
  // véhicules alternatifs réellement disponibles.
  @Post('alternatives')
  alternatives(@Body() body: AlternativesQueryDto) {
    return this.availability.getAlternatives(body);
  }
}
