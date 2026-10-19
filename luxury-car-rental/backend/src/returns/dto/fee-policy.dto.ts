import {IsInt,IsNumber,Max,Min} from 'class-validator';
export class FeePolicyDto {
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(10000) lateFeePerDay!:number;
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(1000) fuelFeePerPercent!:number;
 @IsInt() @Min(0) @Max(10000) mileageAllowancePerDay!:number;
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(1000) excessMileageFee!:number;
}
