import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ServiceAddressDto } from './service-address.dto.js';

// Côté « porte-à-porte » d'une réservation : adresse + instructions
// de rendez-vous. Les instructions d'accès (entryNotes) sont
// confidentielles : visibles uniquement par le client propriétaire,
// les admins et le chauffeur assigné — jamais dans les réponses
// publiques ni chez les autres clients.
export class ServicePointInputDto {
  @ValidateNested()
  @Type(() => ServiceAddressDto)
  address!: ServiceAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  entryNotes?: string;
}
