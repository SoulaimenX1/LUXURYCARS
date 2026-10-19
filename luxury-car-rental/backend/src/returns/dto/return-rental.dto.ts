import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import {Type} from 'class-transformer';
import {VehicleCondition} from '../../rentals/dto/start-rental.dto.js';
export class DamageDto {
 @IsString() @MaxLength(60) zone!:string;
 @IsString() @MaxLength(500) description!:string;
 @IsIn(['minor','moderate','major']) severity!: 'minor'|'moderate'|'major';
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(100000) estimatedCost!:number;
}
export class ReturnRentalDto {
 @IsInt() @Min(0) @Max(999999999) mileageKm!:number;
 @IsInt() @Min(0) @Max(100) fuelLevelPct!:number;
 @IsEnum(VehicleCondition) condition!:VehicleCondition;
 @IsOptional() @IsString() @MaxLength(1000) notes?:string;
 @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>DamageDto) damages?:DamageDto[];
}
