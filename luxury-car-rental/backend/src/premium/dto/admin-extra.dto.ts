import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
export class AdminExtraDto {
  @Matches(/^[A-Z_]{3,40}$/) code!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsIn(['equipment','driver','protection']) category!: 'equipment'|'driver'|'protection';
  @IsIn(['daily','once']) pricing!: 'daily'|'once';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000) amount!: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
