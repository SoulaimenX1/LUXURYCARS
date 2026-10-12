
import {
    IsOptional,
    IsString,
    Length,
    Matches,
    MaxLength,
} from 'class-validator';

import {
    Transform,
} from 'class-transformer';

// Ce DTO définit les informations
// envoyées par le client pour réserver
// une voiture de luxe.
export class CreateReservationDto {
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

    // Date de début de la location.
    // Format : AAAA-MM-JJ.
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message:
            'pickupDate must use YYYY-MM-DD format',
    })
    pickupDate!: string;

    // Date de retour.
    // Format : AAAA-MM-JJ.
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message:
            'returnDate must use YYYY-MM-DD format',
    })
    returnDate!: string;

    // Remarques facultatives du client.
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    customerNotes?: string;
}
