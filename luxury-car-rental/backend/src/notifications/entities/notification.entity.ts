
import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

// Types de notifications affichées sur le site.
// Ils correspondent à l'ENUM PostgreSQL
// notification_type.
export enum NotificationType {
    NEW_VEHICLE = 'new_vehicle',
    SPECIAL_EDITION = 'special_edition',
    LIMITED_EDITION = 'limited_edition',
    GENERAL = 'general',
}

// Cette entité correspond à la table notifications.
@Entity('notifications')
export class Notification {
    // Identifiant unique.
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    // Catégorie de la notification.
    @Column({
        name: 'type',
        type: 'enum',
        enum: NotificationType,
        enumName: 'notification_type',
        default: NotificationType.GENERAL,
    })
    type!: NotificationType;

    // Titre affiché.
    @Column({
        name: 'title',
        type: 'varchar',
        length: 160,
    })
    title!: string;

    // Message facultatif.
    @Column({
        name: 'message',
        type: 'text',
        nullable: true,
    })
    message!: string | null;

    // Voiture concernée (facultative).
    @Column({
        name: 'vehicle_id',
        type: 'uuid',
        nullable: true,
    })
    vehicleId!: string | null;

    // Une notification non publiée reste interne.
    @Column({
        name: 'is_published',
        type: 'boolean',
        default: true,
    })
    isPublished!: boolean;

    // Date de création.
    @Column({
        name: 'created_at',
        type: 'timestamptz',
        default: () => 'now()',
    })
    createdAt!: Date;
}
