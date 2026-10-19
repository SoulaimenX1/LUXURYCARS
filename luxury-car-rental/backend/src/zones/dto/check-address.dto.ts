import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

// Vérification d'éligibilité d'une adresse à la livraison/collecte.
// Le verdict est calculé côté serveur (zone active + ville couverte) :
// aucun calcul de tarif n'est jamais fait côté navigateur.
export class CheckAddressDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  city!: string;
}
