
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Length,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
    FuelType,
    TransmissionType,
} from '../entities/vehicle.entity.js';

// Ce DTO vérifie les données envoyées
// lors de la création d'une voiture.
export class CreateVehicleDto {
    // Nom de la marque.
    // Exemple : Porsche.
    @IsString()
    @Length(2, 80)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    brandName!: string;

    // Nom du modèle.
    // Exemple : Cayenne.
    @IsString()
    @Length(2, 100)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    modelName!: string;

    // Année de fabrication.
    @IsInt()
    @Min(1990)
    @Max(2100)
    manufactureYear!: number;

    // Immatriculation unique.
    @IsString()
    @Length(1, 20)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toUpperCase()
            : value,
    )
    licensePlate!: string;

    // Numéro VIN de 17 caractères.
    // Les lettres I, O et Q ne sont pas
    // utilisées dans les VIN standards.
    @IsString()
    @Matches(/^[A-HJ-NPR-Z0-9]{17}$/)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toUpperCase()
            : value,
    )
    vin!: string;

    // Couleur facultative.
    @IsOptional()
    @IsString()
    @MaxLength(40)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    color?: string;

    // Type de transmission autorisé.
    @IsEnum(TransmissionType)
    transmission!: TransmissionType;

    // Type de carburant autorisé.
    @IsEnum(FuelType)
    fuelType!: FuelType;

    // Nombre de places : entre 1 et 9.
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(9)
    seats?: number;

    // Puissance en chevaux.
    @IsOptional()
    @IsInt()
    @Min(1)
    powerHp?: number;

    // Prix journalier en euros.
    @IsNumber({
        maxDecimalPlaces: 2,
    })
    @Min(0.01)
    dailyPrice!: number;

    // Caution en euros.
    @IsNumber({
        maxDecimalPlaces: 2,
    })
    @Min(0)
    securityDeposit!: number;

    // Valeur du véhicule : toujours un nombre réel strictement positif.
    @IsNumber({
        maxDecimalPlaces: 2,
    })
    @Min(0.01)
    vehicleValue!: number;

    // Kilométrage actuel.
    @IsOptional()
    @IsInt()
    @Min(0)
    mileageKm?: number;

    // Description facultative.
    @IsOptional()
    @IsString()
    description?: string;

    // ==========================================================
    // CARACTÉRISTIQUES ÉDITORIALES (facultatives)
    // ==========================================================

    // Motorisation, par exemple « 4.0L V8 twin-turbo ».
    @IsOptional()
    @IsString()
    @MaxLength(120)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    engine?: string;

    // Couple en Nm.
    @IsOptional()
    @IsInt()
    @Min(1)
    torqueNm?: number;

    // 0 à 100 km/h en secondes.
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0.1)
    acceleration0To100?: number;

    // Vitesse maximale en km/h.
    @IsOptional()
    @IsInt()
    @Min(1)
    topSpeedKmh?: number;

    // Consommation en litres / 100 km.
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 1 })
    @Min(0.1)
    consumptionL100km?: number;

    // Édition spéciale.
    @IsOptional()
    @IsBoolean()
    isSpecial?: boolean;

    // Édition limitée.
    @IsOptional()
    @IsBoolean()
    isLimited?: boolean;

    // Nombre d'exemplaires (édition limitée).
    @IsOptional()
    @IsInt()
    @Min(1)
    editionSize?: number;
}
