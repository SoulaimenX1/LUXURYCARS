
import {
    IsString,
    Length,
} from 'class-validator';

import {
    Transform,
} from 'class-transformer';

// Ce DTO définit le motif du refus
// d'une réservation par l'administrateur.
export class RejectReservationDto {
    // Le motif est obligatoire.
    // Il doit contenir entre 5 et 500 caractères.
    @IsString()
    @Length(5, 500)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    reason!: string;
}
