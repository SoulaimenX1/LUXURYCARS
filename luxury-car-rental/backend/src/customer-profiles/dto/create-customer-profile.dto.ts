
import {
    IsOptional,
    IsString,
    Length,
    Matches,
    MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

// Ce DTO vérifie les informations
// envoyées par le client.
export class CreateCustomerProfileDto {
    // Date de naissance.
    // Format : AAAA-MM-JJ.
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    dateOfBirth!: string;

    // Adresse facultative.
    @IsOptional()
    @IsString()
    @MaxLength(255)
    addressLine?: string;

    // Ville facultative.
    @IsOptional()
    @IsString()
    @MaxLength(100)
    city?: string;

    // Code postal facultatif.
    @IsOptional()
    @IsString()
    @MaxLength(20)
    postalCode?: string;

    // Pays facultatif.
    @IsOptional()
    @IsString()
    @Matches(/^[A-Z]{2}$/)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toUpperCase()
            : value,
    )
    country?: string;

    // Numéro du permis.
    @IsString()
    @Length(1, 50)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    licenseNumber!: string;

    // Pays de délivrance du permis.
    @IsString()
    @Matches(/^[A-Z]{2}$/)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toUpperCase()
            : value,
    )
    licenseCountry!: string;

    // Date de délivrance.
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    licenseIssuedOn!: string;

    // Date d'expiration.
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    licenseExpiresOn!: string;
}
