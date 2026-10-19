import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// L'état du véhicule au moment de sa remise au client.
export enum VehicleCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  DAMAGED = 'damaged',
}

// Informations nécessaires pour transformer une réservation en location.
export class StartRentalDto {
  @IsString()
  @Matches(/^RES-\d{4}-\d{6}$/)
  reservationNumber!: string;

  @IsInt()
  @Min(0)
  @Max(999999999)
  mileageKm!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  fuelLevelPct!: number;

  @IsEnum(VehicleCondition)
  overallCondition!: VehicleCondition;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
