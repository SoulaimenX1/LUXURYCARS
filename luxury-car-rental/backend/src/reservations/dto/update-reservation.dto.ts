import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

// Modification administrative d'une réservation encore planifiable.
// Tous les champs sont optionnels ; seuls ceux fournis sont modifiés.
// Aucun montant n'est accepté : les prix sont toujours recalculés
// côté serveur par le devis canonique.
export class UpdateReservationDto {
    @IsOptional()
    @IsUUID('4')
    vehicleId?: string;

    @IsOptional()
    @IsISO8601()
    pickupAt?: string;

    @IsOptional()
    @IsISO8601()
    returnAt?: string;

    @IsOptional()
    @IsUUID('4')
    pickupLocationId?: string;

    @IsOptional()
    @IsUUID('4')
    dropoffLocationId?: string;
}
