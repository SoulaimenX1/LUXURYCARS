import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
export class AdminPromotionDto {
  @Matches(/^[A-Z0-9_-]{3,30}$/) code!: string;
  @IsInt() @Min(1) @Max(50) percentage!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) expiryDate!: string;
  @IsOptional() @IsInt() @Min(1) maxUses?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
