
import {
    IsNotEmpty,
    IsString,
    Length,
    Matches,
    MaxLength,
    ValidateIf,
} from 'class-validator';

import { Transform } from 'class-transformer';

export class UpdateProfileDto {
    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @Length(2, 100)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    firstName?: string;

    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @Length(2, 100)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    lastName?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    @Matches(/^\+?[0-9 ().-]{6,30}$/, {
        message:
            'phone must be a valid phone number (digits, spaces, +, -, parentheses).',
    })
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    phone!: string;
}
