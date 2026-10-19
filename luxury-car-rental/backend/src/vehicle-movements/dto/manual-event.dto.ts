import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ServiceAddressDto } from '../../delivery/dto/service-address.dto.js';

// Événement de localisation saisi MANUELLEMENT par un admin
// (correction, maintenance, constat). Les événements de cycle de
// vie (prise en charge, livraison…) ne peuvent pas être forgés
// ici : ils sont créés par leurs parcours métier respectifs.
export class CreateManualEventDto {
  @IsUUID('4')
  vehicleId!: string;

  @IsIn(['admin_manual', 'correction', 'maintenance'])
  eventKind!: 'admin_manual' | 'correction' | 'maintenance';

  @IsOptional()
  @IsUUID('4')
  fromLocationId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceAddressDto)
  fromAddress?: ServiceAddressDto;

  @IsOptional()
  @IsUUID('4')
  toLocationId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceAddressDto)
  toAddress?: ServiceAddressDto;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

// Affectation du lieu de base d'un véhicule (home ≠ position).
export class SetHomeLocationDto {
  // null = retire le domicile (jamais de position fabriquée).
  @IsOptional()
  @IsUUID('4')
  homeLocationId?: string | null;
}
