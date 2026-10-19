import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ServicePointInputDto } from '../../delivery/dto/service-point-input.dto.js';

// Ne jamais accepter un prix envoyé par le navigateur : le serveur calcule tous les montants.
export class QuoteDto {
  @IsUUID('4') vehicleId!: string;

  // Location à la journée (ancien contrat) …
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) pickupDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) returnDate?: string;

  // … ou location à l'heure / à la minute (nouveau parcours de réservation).
  @IsOptional() @IsISO8601() pickupAt?: string;
  @IsOptional() @IsISO8601() returnAt?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsUUID('4', { each: true }) extraIds?: string[];
  @IsOptional() @IsString() @Matches(/^[A-Z0-9_-]{3,30}$/) promotionCode?: string;
  @IsOptional() @IsIn(['branch', 'airport', 'hotel']) pickupMethod?: 'branch' | 'airport' | 'hotel';
  @IsOptional() @IsString() @MaxLength(250) deliveryAddress?: string;
  // Les deux points sont requis ensemble pour éviter un montant incomplet.
  @IsOptional() @IsUUID('4') pickupLocationId?: string;
  @IsOptional() @IsUUID('4') dropoffLocationId?: string;
  @IsOptional() @IsString() @MaxLength(250) pickupAddress?: string;
  @IsOptional() @IsString() @MaxLength(250) dropoffAddress?: string;

  // ---- Modes de service (livraison / collecte porte-à-porte) ----
  // Additionnel : sans ces champs, le contrat historique (points de
  // service seuls) est conservé strictement à l'identique.
  @IsOptional() @IsIn(['APPROVED_POINT', 'DOOR_TO_DOOR'])
  pickupServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';
  @IsOptional() @IsIn(['APPROVED_POINT', 'DOOR_TO_DOOR'])
  dropoffServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';

  // Côtés « porte-à-porte » : adresse privée + instructions.
  @IsOptional() @ValidateNested() @Type(() => ServicePointInputDto)
  pickupDoor?: ServicePointInputDto;
  @IsOptional() @ValidateNested() @Type(() => ServicePointInputDto)
  dropoffDoor?: ServicePointInputDto;
}
