
import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

// ==========================================================
// TYPE DE MÉDIA
// ==========================================================
//
// Une ligne de `vehicle_images` décrit soit une photo, soit
// une vidéo. La valeur correspond à l'ENUM PostgreSQL
// `media_type`.
export enum MediaType {
    IMAGE = 'image',
    VIDEO = 'video',
}

// ==========================================================
// TABLE vehicle_images
// ==========================================================
//
// Chaque voiture peut posséder plusieurs photos. Une seule
// est marquée comme principale (`is_primary = true`) : c'est
// celle affichée sur les cartes du catalogue public.
//
// La contrainte PostgreSQL uq_vehicle_primary_image garantit
// qu'il n'existe qu'une photo principale par véhicule.
//
// Remarque : aucune relation @ManyToOne vers Vehicle n'est
// déclarée ici afin d'éviter une importation circulaire entre
// les deux fichiers d'entités. La clé étrangère est gérée par
// la colonne `vehicle_id` et par la base de données.

@Entity('vehicle_images')
export class VehicleImage {
    // Identifiant unique de la photo.
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    // Identifiant de la voiture concernée.
    @Column({
        name: 'vehicle_id',
        type: 'uuid',
    })
    vehicleId!: string;

    // Chemin ou URL de la photo.
    // Exemple : /vehicles/ab-123-cd-1700000000.png
    @Column({
        name: 'storage_path',
        type: 'text',
    })
    storagePath!: string;

    // S'agit-il d'une photo ou d'une vidéo ?
    @Column({
        name: 'media_type',
        type: 'enum',
        enum: MediaType,
        enumName: 'media_type',
        default: MediaType.IMAGE,
    })
    mediaType!: MediaType;

    // Image d'attente d'une vidéo (facultative).
    @Column({
        name: 'poster_path',
        type: 'text',
        nullable: true,
    })
    posterPath!: string | null;

    // Texte alternatif (accessibilité).
    @Column({
        name: 'alt_text',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    altText!: string | null;

    // Photo principale du véhicule ?
    @Column({
        name: 'is_primary',
        type: 'boolean',
        default: false,
    })
    isPrimary!: boolean;

    // Ordre d'affichage dans une galerie.
    @Column({
        name: 'sort_order',
        type: 'smallint',
        default: 0,
    })
    sortOrder!: number;

    // Date d'ajout de la photo.
    @Column({
        name: 'created_at',
        type: 'timestamptz',
        default: () => 'now()',
    })
    createdAt!: Date;
}
