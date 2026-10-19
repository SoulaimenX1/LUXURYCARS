import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// L'administrateur saisit une nouvelle date et, optionnellement, une heure
// pour la prolongation de la location.
export class ExtendRentalDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'newReturnDate must use YYYY-MM-DD format' })
  newReturnDate!: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'newReturnTime must use HH:mm format' })
  newReturnTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
