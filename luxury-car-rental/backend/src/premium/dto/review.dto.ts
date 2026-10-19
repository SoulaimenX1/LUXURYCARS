import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CreateReviewDto {
  @IsString() @Matches(/^RES-[A-Z0-9-]{5,30}$/i) reservationNumber!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MinLength(3) @MaxLength(100) title!: string;
  @IsString() @MinLength(10) @MaxLength(1500) comment!: string;
  // Volet « service » : facultatif, réservé aux réservations ayant
  // inclus des options. La note et le commentaire vont ensemble.
  @IsOptional() @IsInt() @Min(1) @Max(5) serviceRating?: number;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(1500) serviceComment?: string;
}
