import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PricingModifiersDto } from './zone-admin.dto.js';

// Création d'une règle de tarification de livraison/collecte.
// Seul le mode « fixed » est implémenté : les modes zone / distance /
// prestataire exigeraient une intégration payante (géocodage,
// transporteur) qui n'est pas autorisée sans approbation explicite.
export class CreatePricingRuleDto {
  @IsIn(['door_pickup', 'door_dropoff', 'reposition'])
  serviceType!: 'door_pickup' | 'door_dropoff' | 'reposition';

  @IsOptional()
  @IsIn(['fixed', 'formula'])
  feeMode?: 'fixed' | 'formula';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999)
  fixedFee?: number;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999)
  minimumFee?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricingModifiersDto)
  modifiers?: PricingModifiersDto;

  @IsOptional()
  @IsIn(['draft', 'active'])
  status?: 'draft' | 'active';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/)
  effectiveFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/)
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

// Mise à jour d'une règle existante : le montant, le statut et les
// fenêtres d'effet sont les seuls leviers opérationnels.
export class UpdatePricingRuleDto {
  @IsOptional() @IsIn(['fixed', 'formula']) feeMode?: 'fixed' | 'formula';
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999) fixedFee?: number;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999) minimumFee?: number;
  @IsOptional() @ValidateNested() @Type(() => PricingModifiersDto) modifiers?: PricingModifiersDto;
  @IsOptional() @IsIn(['draft', 'active', 'retired']) status?: 'draft' | 'active' | 'retired';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/) effectiveFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/) effectiveTo?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
