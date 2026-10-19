import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
export class AddChargeDto {
 @IsIn(['damage','cleaning','other']) type!: 'damage'|'cleaning'|'other';
 @IsString() @MinLength(5) @MaxLength(255) description!:string;
 @IsNumber({maxDecimalPlaces:2}) @Min(0.01) @Max(1000000) amount!:number;
 @IsOptional() @IsUUID('4') inspectionDamageId?:string;
}
