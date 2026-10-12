
import {
    IsString,
    Length,
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

    @ValidateIf(
        (_, value) =>
            value !== undefined && value !== null,
    )
    @IsString()
    @MaxLength(30)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    phone?: string | null;
}
