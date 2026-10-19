import {
    IsIn,
    IsISO8601,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';

import {
    Transform,
} from 'class-transformer';

// Motifs autorisés par le type PostgreSQL unavailability_reason.
export const UNAVAILABILITY_REASONS = [
    'maintenance',
    'repair',
    'inspection',
    'other',
] as const;

export type UnavailabilityReason =
    (typeof UNAVAILABILITY_REASONS)[number];

// Création d'un bloc d'indisponibilité (maintenance/réparation).
export class CreateVehicleBlockDto {
    @IsUUID('4')
    vehicleId!: string;

    @IsISO8601()
    startsAt!: string;

    @IsISO8601()
    endsAt!: string;

    @IsIn(UNAVAILABILITY_REASONS)
    reason!: UnavailabilityReason;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    notes?: string;
}

// Modification d'un bloc existant.
export class UpdateVehicleBlockDto {
    @IsOptional()
    @IsISO8601()
    startsAt?: string;

    @IsOptional()
    @IsISO8601()
    endsAt?: string;

    @IsOptional()
    @IsIn(UNAVAILABILITY_REASONS)
    reason?: UnavailabilityReason;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    notes?: string;
}

// Libération d'un bloc de maintenance. Le motif de libération est
// FACULTATIF : il est enregistré dans l'historique d'audit sans
// jamais modifier la réservation ni l'historique financier.
export class ReleaseBlockDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    reason?: string;
}
