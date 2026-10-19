import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class ManualPaymentDto {
 @IsIn(['rental_payment','charge_payment','refund']) type!:'rental_payment'|'charge_payment'|'refund';
 @IsIn(['cash','card','bank_transfer']) method!:'cash'|'card'|'bank_transfer';
 @IsNumber({maxDecimalPlaces:2}) @Min(0.01) @Max(1000000) amount!:number;
 @IsString() @MaxLength(100) reference!:string;
 @IsOptional() @IsString() @MaxLength(500) notes?:string;
}
