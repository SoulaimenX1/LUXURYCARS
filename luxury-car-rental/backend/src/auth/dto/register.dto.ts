
import {
    IsEmail,
    IsOptional,
    IsString,
    Length,
    MaxLength,
    MinLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

export class RegisterDto {
    @IsString()
    @Length(2, 100)
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value
    )
    firstName!: string;

    @IsString()
    @Length(2, 100)
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value
    )
    lastName!: string;

    @IsEmail()
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim().toLowerCase()
            : value
    )
    email!: string;

    @IsString()
    @MinLength(12)
    @MaxLength(128)
    password!: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string;
}
