import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ServiceAddressDto } from '../../delivery/dto/service-address.dto.js';

// ============================================================
// DTO DE MISSION DE TRANSPORT (expédition manuelle)
// ============================================================
// Aucune distance, ETA ni frais n'est calculé par le client : le
// planificateur saisit la fenêtre et les points ; les chevauchements
// sont garantis par les exclusions PostgreSQL + le service.

export type MissionType = 'DELIVERY' | 'COLLECTION' | 'REPOSITIONING';
export type PointKind = 'LOCATION' | 'ADDRESS';

export class CreateMissionDto {
  @IsIn(['DELIVERY', 'COLLECTION', 'REPOSITIONING'])
  type!: MissionType;

  // Obligatoire pour DELIVERY / COLLECTION (contrôle applicatif,
  // le CHECK base impose reservation_id sauf REPOSITIONING).
  @IsOptional()
  @Matches(/^RES-\d{4}-\d{6}$/)
  reservationNumber?: string;

  @IsUUID('4')
  vehicleId!: string;

  @IsIn(['LOCATION', 'ADDRESS'])
  originKind!: PointKind;

  @IsOptional()
  @IsUUID('4')
  originLocationId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceAddressDto)
  originAddress?: ServiceAddressDto;

  @IsIn(['LOCATION', 'ADDRESS'])
  destinationKind!: PointKind;

  @IsOptional()
  @IsUUID('4')
  destinationLocationId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceAddressDto)
  destinationAddress?: ServiceAddressDto;

  @IsISO8601()
  plannedStart!: string;

  @IsISO8601()
  plannedEnd!: string;

  // Affectation immédiate (expédition manuelle : le chauffeur doit
  // être un profil actif — roster géré par l'admin).
  @IsOptional()
  @IsUUID('4')
  driverUserId?: string;
}

export class AssignDriverDto {
  @IsUUID('4')
  driverUserId!: string;
}

// Corps commun des actions (admin : annulation / chauffeur :
// acceptation, démarrage, pause, reprise, achèvement, échec).
export class MissionActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999.99)
  distanceKm?: number;
}

export class MissionListQueryDto {
  @IsOptional()
  @IsIn(['created', 'assigned', 'accepted', 'in_progress', 'paused', 'completed', 'cancelled', 'failed'])
  state?: string;

  @IsOptional()
  @IsUUID('4')
  vehicleId?: string;

  @IsOptional()
  @IsUUID('4')
  driverUserId?: string;

  // Fenêtre de recouvrement (les deux bornes sont facultatives).
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ---- Roster chauffeurs (réglages de mise en service) ----

export class UpsertDriverProfileDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^[A-Za-z]{2}$/, { each: true })
  serviceCountryCodes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50)
  vehicleGroups?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateDriverProfileDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^[A-Za-z]{2}$/, { each: true })
  serviceCountryCodes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50)
  vehicleGroups?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateShiftDto {
  @IsIn(['shift', 'absence'])
  kind!: 'shift' | 'absence';

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  notes?: string;
}

export class ListShiftsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
