import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Configuration contrôlée par un administrateur, jamais par un client.
export class LocationDto {
  @IsString() @Matches(/^[A-Z0-9_-]{3,50}$/) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsIn(['showroom', 'airport', 'hotel', 'city_center', 'custom']) category!: string;
  @IsString() @MaxLength(100) city!: string;
  @IsString() @MaxLength(100) country!: string;
  @IsString() @MaxLength(250) address!: string;
  @IsNumberString() pickupFee!: string;
  @IsNumberString() dropoffFee!: string;
  @IsNumberString() oneWayFee!: string;
  @IsBoolean() canPickup!: boolean;
  @IsBoolean() canDropoff!: boolean;
  @IsBoolean() enabled!: boolean;

  // Horaires et fuseau du point de service (facultatifs).
  @IsOptional() @IsString() @Matches(/^[A-Za-z]+\/[A-Za-z_]+$/) timezone?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) opensAt?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) closesAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(720) turnaroundMinutes?: number;
}
