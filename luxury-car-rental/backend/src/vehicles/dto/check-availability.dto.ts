
import {
    IsString,
    Matches,
} from 'class-validator';

// Ce DTO vérifie les deux dates
// envoyées dans les paramètres de l'URL.
export class CheckAvailabilityDto {
    // Date de début de la location.
    // Format obligatoire : AAAA-MM-JJ.
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'from must use YYYY-MM-DD format',
    })
    from!: string;

    // Date de fin de la location.
    // Format obligatoire : AAAA-MM-JJ.
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'to must use YYYY-MM-DD format',
    })
    to!: string;
}
