
import {
    IsOptional,
    IsString,
    Length,
    MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

// Ce DTO définit les informations nécessaires
// pour créer une catégorie automobile.
export class CreateCategoryDto {
    // Le nom est obligatoire.
    // Exemple : SUV, Sportive ou Berline.
    @IsString()
    @Length(2, 50)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    name!: string;

    // La description est facultative.
    @IsOptional()
    @IsString()
    @MaxLength(500)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    description?: string;
}
