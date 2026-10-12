
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
    VehicleStatus,
} from '../entities/vehicle.entity.js';

// Ce DTO contient les informations
// qu'un administrateur peut modifier.
//
// Tous les champs sont facultatifs :
// il suffit d'envoyer ceux que l'on veut modifier.
export class UpdateVehicleDto {
    // Nouveau prix journalier en euros.
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    dailyPrice?: number;

    // Nouveau montant de la caution.
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    securityDeposit?: number;

    // Nouveau kilométrage.
    @IsOptional()
    @IsInt()
    @Min(0)
    mileageKm?: number;

    // Nouveau statut administratif.
    // Valeurs : active, maintenance ou retired.
    @IsOptional()
    @IsEnum(VehicleStatus)
    status?: VehicleStatus;

    // Nouvelle couleur.
    // La valeur null permet de supprimer la couleur.
    @IsOptional()
    @IsString()
    @MaxLength(40)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    color?: string | null;

    // Nouvelle description.
    // La valeur null permet de la supprimer.
    @IsOptional()
    @IsString()
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    description?: string | null;

    // Caractéristiques éditoriales.
    @IsOptional()
    @IsString()
    @MaxLength(120)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    engine?: string | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    torqueNm?: number | null;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0.1)
    acceleration0To100?: number | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    topSpeedKmh?: number | null;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0.1)
    consumptionL100km?: number | null;

    // Éditions.
    @IsOptional()
    @IsBoolean()
    isSpecial?: boolean;

    @IsOptional()
    @IsBoolean()
    isLimited?: boolean;

    @IsOptional()
    @IsInt()
    @Min(1)
    editionSize?: number | null;
}
