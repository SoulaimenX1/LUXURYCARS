
import {
  IsString,
  Length,
} from 'class-validator';

import { Transform } from 'class-transformer';

// Données nécessaires pour créer un modèle automobile.
// L'administrateur utilise les noms au lieu des UUID.
export class CreateVehicleModelDto {
  // Exemple : Porsche.
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  brandName!: string;

  // Exemple : Sportive.
  @IsString()
  @Length(2, 50)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  categoryName!: string;

  // Exemple : 911.
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  name!: string;
}
