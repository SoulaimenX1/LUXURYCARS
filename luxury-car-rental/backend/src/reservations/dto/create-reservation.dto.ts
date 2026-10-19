
import {
    IsOptional,
    IsArray, ArrayMaxSize, ArrayUnique, IsIn,
    IsISO8601,
    IsString,
    IsUUID,
    Matches,
    MaxLength,
    ValidateNested,
} from 'class-validator';

import {
    Transform,
    Type,
} from 'class-transformer';

import {
    ServicePointInputDto,
} from '../../delivery/dto/service-point-input.dto.js';

// Ce DTO définit les informations
// envoyées par le client pour réserver
// une voiture de luxe.
export class CreateReservationDto {
    // Identifiant UNIQUE de la voiture choisie par le client.
    @IsUUID('4')
    vehicleId!: string;

    // Date de début de la location (contrat historique).
    // Format : AAAA-MM-JJ.
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message:
            'pickupDate must use YYYY-MM-DD format',
    })
    pickupDate?: string;

    // Date de retour (contrat historique).
    // Format : AAAA-MM-JJ.
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message:
            'returnDate must use YYYY-MM-DD format',
    })
    returnDate?: string;

    // Nouveau parcours : début et fin précis à l'heure.
    @IsOptional() @IsISO8601()
    pickupAt?: string;

    @IsOptional() @IsISO8601()
    returnAt?: string;

    // Options et livraison choisies : aucun montant n'est accepté du navigateur.
    @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsUUID('4', {each:true})
    extraIds?: string[];
    @IsOptional() @Matches(/^[A-Z0-9_-]{3,30}$/) promotionCode?: string;
    @IsOptional() @IsIn(['branch','airport','hotel']) pickupMethod?: 'branch'|'airport'|'hotel';
    @IsOptional() @IsString() @MaxLength(250) deliveryAddress?: string;

    // Lieux de prise en charge / restitution (validés et tarifés par NestJS).
    @IsOptional() @IsUUID('4') pickupLocationId?: string;
    @IsOptional() @IsUUID('4') dropoffLocationId?: string;
    @IsOptional() @IsString() @MaxLength(250) pickupAddress?: string;
    @IsOptional() @IsString() @MaxLength(250) dropoffAddress?: string;

    // ---- Livraison / collecte porte-à-porte (additionnel) ----
    // Sans ces champs, le contrat historique est conservé : un point
    // de service obligatoire et une restitution au même point.
    @IsOptional() @IsIn(['APPROVED_POINT', 'DOOR_TO_DOOR'])
    pickupServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';

    @IsOptional() @IsIn(['APPROVED_POINT', 'DOOR_TO_DOOR'])
    dropoffServiceMode?: 'APPROVED_POINT' | 'DOOR_TO_DOOR';

    // Côtés porte-à-porte : adresse privée + instructions de
    // rendez-vous (les entryNotes restent confidentielles).
    @IsOptional() @ValidateNested() @Type(() => ServicePointInputDto)
    pickupDoor?: ServicePointInputDto;

    @IsOptional() @ValidateNested() @Type(() => ServicePointInputDto)
    dropoffDoor?: ServicePointInputDto;

    // Devis de livraison persisté (optionnel) : revalidé par le
    // serveur (validité, empreinte, total recalculé) avant booking.
    @IsOptional() @IsUUID('4')
    quoteId?: string;

    // Remarques facultatives du client.
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    @Transform(({ value }) =>
        typeof value === 'string'
            ? value.trim()
            : value,
    )
    customerNotes?: string;
}
