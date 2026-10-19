import { IsISO8601, IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ServicePointInputDto } from '../../delivery/dto/service-point-input.dto.js';

// ==========================================================
// REQUÊTES DE DISPONIBILITÉ
// ==========================================================

// GET /vehicles/:vehicleId/availability-calendar?locationId=&month=
export class CalendarQueryDto {
  @IsUUID('4')
  locationId!: string;

  @IsOptional()
  @IsUUID('4')
  dropoffLocationId?: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must use YYYY-MM format',
  })
  month!: string;
}

// POST /availability/check
export class CheckIntervalDto {
  @IsUUID('4')
  vehicleId!: string;

  // Sans mode porte-à-porte, le lieu de prise en charge reste
  // obligatoire (contrat historique conservé côté service).
  @IsOptional()
  @IsUUID('4')
  pickupLocationId?: string;

  @IsOptional()
  @IsUUID('4')
  dropoffLocationId?: string;

  @IsISO8601()
  pickupAt!: string;

  @IsISO8601()
  returnAt!: string;

  // ---- Modes de service (additionnels) ----
  @IsOptional()
  @IsIn(['APPROVED_POINT', 'DOOR_TO_DOOR'])
  pickupServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';

  @IsOptional()
  @IsIn(['APPROVED_POINT', 'DOOR_TO_DOOR'])
  dropoffServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';

  @IsOptional()
  @ValidateNested()
  @Type(() => ServicePointInputDto)
  pickupDoor?: ServicePointInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServicePointInputDto)
  dropoffDoor?: ServicePointInputDto;
}

// POST /availability/alternatives
export class AlternativesQueryDto {
  @IsUUID('4')
  vehicleId!: string;

  @IsUUID('4')
  pickupLocationId!: string;

  @IsOptional()
  @IsUUID('4')
  dropoffLocationId?: string;

  @IsISO8601()
  pickupAt!: string;

  @IsISO8601()
  returnAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;
}
