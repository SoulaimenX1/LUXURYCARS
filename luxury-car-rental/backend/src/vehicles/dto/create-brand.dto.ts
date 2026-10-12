
import {
    IsString,
    Length,
} from 'class-validator';

import { Transform } from 'class-transformer';

// Définit les données nécessaires pour créer une marque.
export class CreateBrandDto {
    @IsString()
    @Length(2, 100)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    name!: string;
}
