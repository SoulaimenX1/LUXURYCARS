import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Exception d'horaires (jour férié / fermeture spéciale / horaires
// particuliers) attachée à une zone de service.
export class HolidayExceptionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsBoolean()
  closed!: boolean;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  opensAt?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  closesAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;
}

// Restrictions de flotte optionnelles : liste blanche de catégories
// de véhicules acceptées dans la zone. Vide = toutes les catégories.
export class FleetRestrictionsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  categories?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;

// Additionneur de tarif explicite (majorations). Une absence de
// configuration = effet nul : aucun montant n'est jamais inventé.
class FeeAdderDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee?: number;
}

class WeekendModifierDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @Min(0, { each: true })
  @Max(6, { each: true })
  days?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FeeAdderDto)
  fee?: FeeAdderDto;
}

// Surcharges optionnelles lues par le calcul de livraison.
export class PricingModifiersDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FeeAdderDto)
  afterHours?: FeeAdderDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeeAdderDto)
  holiday?: FeeAdderDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WeekendModifierDto)
  weekend?: WeekendModifierDto;
}

// Création d'une zone de service. Valeurs par défaut = comportement
// « désactivé » : une zone créée sans action explicite ne rend jamais
// un service indisponible ou un tarif actif par accident.
export class CreateZoneDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_-]{3,30}$/)
  code!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  addressServiceEnabled?: boolean;

  // Liste de villes couvertes ; vide = tout le pays.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  cities?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @Matches(timePattern)
  opensAt?: string;

  @IsOptional()
  @Matches(timePattern)
  closesAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  leadTimeMinutes?: number;

  @IsOptional()
  @Matches(timePattern)
  cutoffTime?: string;

  @IsOptional()
  @IsBoolean()
  afterHoursAllowed?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => HolidayExceptionDto)
  holidayExceptions?: HolidayExceptionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FleetRestrictionsDto)
  fleetRestrictions?: FleetRestrictionsDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// Mise à jour partielle : seuls les champs fournis sont modifiés.
export class UpdateZoneDto {
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() addressServiceEnabled?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsString({ each: true }) @MaxLength(100, { each: true }) cities?: string[];
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @Matches(timePattern) opensAt?: string;
  @IsOptional() @Matches(timePattern) closesAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10080) leadTimeMinutes?: number;
  @IsOptional() @Matches(timePattern) cutoffTime?: string;
  @IsOptional() @IsBoolean() afterHoursAllowed?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => HolidayExceptionDto) holidayExceptions?: HolidayExceptionDto[];
  @IsOptional() @ValidateNested() @Type(() => FleetRestrictionsDto) fleetRestrictions?: FleetRestrictionsDto;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
