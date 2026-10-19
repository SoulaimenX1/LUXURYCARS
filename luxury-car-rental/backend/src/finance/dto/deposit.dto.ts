import {IsIn,IsNumber,IsOptional,IsString,Max,MaxLength,Min} from 'class-validator';
export class DepositHoldDto {
 @IsIn(['cash','card','bank_transfer']) method!:'cash'|'card'|'bank_transfer';
 @IsString() @MaxLength(100) reference!:string;
}
export class DepositSettleDto {
 @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(1000000) retainedAmount!:number;
 @IsOptional() @IsString() @MaxLength(500) reason?:string;
 @IsIn(['cash','card','bank_transfer']) method!:'cash'|'card'|'bank_transfer';
 @IsString() @MaxLength(100) reference!:string;
}
