
import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

// Statuts possibles d'une réservation.
// Les valeurs correspondent à l'ENUM
// reservation_status de PostgreSQL.
export enum ReservationStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled',
    EXPIRED = 'expired',
    CONVERTED = 'converted',
}

// Cette entité représente une réservation.
@Entity('reservations')
export class Reservation {
    // Identifiant unique de la réservation.
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    // Numéro commercial de la réservation.
    // PostgreSQL le génère automatiquement.
    @Column({
        name: 'reservation_number',
        type: 'varchar',
        length: 20,
        insert: false,
        update: false,
    })
    reservationNumber!: string;

    // Identifiant du profil client.
    @Column({
        name: 'customer_id',
        type: 'uuid',
    })
    customerId!: string;

    // Identifiant de la voiture réservée.
    @Column({
        name: 'vehicle_id',
        type: 'uuid',
    })
    vehicleId!: string;

    // Date et heure de départ.
    @Column({
        name: 'pickup_at',
        type: 'timestamptz',
    })
    pickupAt!: Date;

    // Date et heure de retour.
    @Column({
        name: 'return_at',
        type: 'timestamptz',
    })
    returnAt!: Date;

    // Nombre de jours de location.
    @Column({
        name: 'rental_days',
        type: 'integer',
    })
    rentalDays!: number;

    // Prix journalier au moment
    // de la réservation.
    @Column({
        name: 'daily_price',
        type: 'numeric',
        precision: 10,
        scale: 2,
    })
    dailyPrice!: string;

    // Montant de la caution.
    @Column({
        name: 'deposit_amount',
        type: 'numeric',
        precision: 10,
        scale: 2,
    })
    depositAmount!: string;

    // Prix total de la location.
    // La caution n'est pas incluse.
    @Column({
        name: 'total_amount',
        type: 'numeric',
        precision: 12,
        scale: 2,
    })
    totalAmount!: string;

    // Statut de la réservation.
    @Column({
        name: 'status',
        type: 'enum',
        enum: ReservationStatus,
        enumName: 'reservation_status',
        default: ReservationStatus.PENDING,
    })
    status!: ReservationStatus;

    // Remarques facultatives du client.
    @Column({
        name: 'customer_notes',
        type: 'text',
        nullable: true,
    })
    customerNotes!: string | null;

    // Identifiant de l'employé ayant
    // accepté ou refusé la réservation.
    @Column({
        name: 'decided_by',
        type: 'uuid',
        nullable: true,
    })
    decidedBy!: string | null;

    // Date de la décision.
    @Column({
        name: 'decided_at',
        type: 'timestamptz',
        nullable: true,
    })
    decidedAt!: Date | null;

    // Motif éventuel de la décision.
    @Column({
        name: 'decision_reason',
        type: 'text',
        nullable: true,
    })
    decisionReason!: string | null;

    // Date de création.
    @Column({
        name: 'created_at',
        type: 'timestamptz',
        default: () => 'now()',
    })
    createdAt!: Date;

    // Date de dernière modification.
    @Column({
        name: 'updated_at',
        type: 'timestamptz',
        default: () => 'now()',
    })
    updatedAt!: Date;
}
