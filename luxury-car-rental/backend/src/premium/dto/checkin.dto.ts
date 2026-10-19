import { IsOptional, IsString, MaxLength } from 'class-validator';
export class CheckinDto { @IsOptional() @IsString() @MaxLength(500) notes?: string; }
