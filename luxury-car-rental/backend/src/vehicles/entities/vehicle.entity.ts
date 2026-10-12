
import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm';

import {
    VehicleModel,
} from './vehicle-model.entity.js';

// Import de type uniquement : aucune dépendance d'exécution,
// ce qui évite une importation circulaire entre entités.
import type {
    VehicleImage,
} from './vehicle-image.entity.js';

// Valeurs autorisées pour la transmission.
// Elles correspondent à l'ENUM PostgreSQL
// transmission_type.
export enum TransmissionType {
    AUTOMATIC = 'automatic',
    MANUAL = 'manual',
    SEMI_AUTOMATIC = 'semi_automatic',
}

// Valeurs autorisées pour le carburant.
// Elles correspondent à l'ENUM fuel_type.
export enum FuelType {
    PETROL = 'petrol',
    DIESEL = 'diesel',
    HYBRID = 'hybrid',
    PLUG_IN_HYBRID = 'plug_in_hybrid',
    ELECTRIC = 'electric',
}

// Statut administratif de la voiture.
// Une réservation ou une location sera
// gérée séparément, à partir des dates.
export enum VehicleStatus {
    ACTIVE = 'active',
    MAINTENANCE = 'maintenance',
    RETIRED = 'retired',
}

// Cette entité correspond à la table vehicles.
@Entity('vehicles')
export class Vehicle {
    // Identifiant unique de la voiture.
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    // Identifiant du modèle automobile.
    @Column({
        name: 'model_id',
        type: 'uuid',
    })
    modelId!: string;

    // Relation avec la table vehicle_models.
    // Elle permet de récupérer les détails du modèle.
    @ManyToOne(
        () => VehicleModel,
        { nullable: false },
    )
    @JoinColumn({
        name: 'model_id',
    })
    model?: VehicleModel;

    // Année de fabrication.
    @Column({
        name: 'manufacture_year',
        type: 'smallint',
    })
    manufactureYear!: number;

    // Numéro d'immatriculation.
    @Column({
        name: 'license_plate',
        type: 'varchar',
        length: 20,
        unique: true,
    })
    licensePlate!: string;

    // Numéro VIN unique de 17 caractères.
    @Column({
        name: 'vin',
        type: 'char',
        length: 17,
        unique: true,
    })
    vin!: string;

    // Couleur facultative.
    @Column({
        name: 'color',
        type: 'varchar',
        length: 40,
        nullable: true,
    })
    color!: string | null;

    // Type de transmission.
    @Column({
        name: 'transmission',
        type: 'enum',
        enum: TransmissionType,
        enumName: 'transmission_type',
    })
    transmission!: TransmissionType;

    // Type de carburant.
    @Column({
        name: 'fuel_type',
        type: 'enum',
        enum: FuelType,
        enumName: 'fuel_type',
    })
    fuelType!: FuelType;

    // Nombre de places.
    @Column({
        name: 'seats',
        type: 'smallint',
        default: 2,
    })
    seats!: number;

    // Puissance en chevaux.
    @Column({
        name: 'power_hp',
        type: 'smallint',
        nullable: true,
    })
    powerHp!: number | null;

    // Prix de location par jour.
    // PostgreSQL retourne NUMERIC sous forme
    // de chaîne pour préserver la précision.
    @Column({
        name: 'daily_price',
        type: 'numeric',
        precision: 10,
        scale: 2,
    })
    dailyPrice!: string;

    // Montant de la caution.
    @Column({
        name: 'security_deposit',
        type: 'numeric',
        precision: 10,
        scale: 2,
    })
    securityDeposit!: string;

    // Kilométrage actuel.
    @Column({
        name: 'mileage_km',
        type: 'integer',
        default: 0,
    })
    mileageKm!: number;

    // Description facultative.
    @Column({
        name: 'description',
        type: 'text',
        nullable: true,
    })
    description!: string | null;

    // ==========================================
    // CARACTÉRISTIQUES TECHNIQUES (ÉDITORIAL)
    // ==========================================

    // Description du moteur.
    // Exemple : 4.0L V8 biturbo.
    @Column({
        name: 'engine',
        type: 'varchar',
        length: 120,
        nullable: true,
    })
    engine!: string | null;

    // Couple maximal en newton-mètres.
    @Column({
        name: 'torque_nm',
        type: 'integer',
        nullable: true,
    })
    torqueNm!: number | null;

    // Accélération de 0 à 100 km/h, en secondes.
    // PostgreSQL retourne NUMERIC sous forme de chaîne.
    @Column({
        name: 'acceleration_0_100',
        type: 'numeric',
        precision: 4,
        scale: 1,
        nullable: true,
    })
    acceleration0To100!: string | null;

    // Vitesse maximale en km/h.
    @Column({
        name: 'top_speed_kmh',
        type: 'smallint',
        nullable: true,
    })
    topSpeedKmh!: number | null;

    // Consommation mixte en litres / 100 km.
    // La valeur est nulle pour les véhicules électriques.
    @Column({
        name: 'consumption_l_100km',
        type: 'numeric',
        precision: 4,
        scale: 1,
        nullable: true,
    })
    consumptionL100km!: string | null;

    // S'agit-il d'une édition spéciale ?
    @Column({
        name: 'is_special',
        type: 'boolean',
        default: false,
    })
    isSpecial!: boolean;

    // S'agit-il d'une édition limitée ?
    @Column({
        name: 'is_limited',
        type: 'boolean',
        default: false,
    })
    isLimited!: boolean;

    // Nombre d'exemplaires produits (éditions limitées).
    @Column({
        name: 'edition_size',
        type: 'integer',
        nullable: true,
    })
    editionSize!: number | null;

    // Date d'annonce / d'arrivée au catalogue.
    @Column({
        name: 'announced_at',
        type: 'timestamptz',
        default: () => 'now()',
    })
    announcedAt!: Date;

    // Statut administratif.
    @Column({
        name: 'status',
        type: 'enum',
        enum: VehicleStatus,
        enumName: 'vehicle_status',
        default: VehicleStatus.ACTIVE,
    })
    status!: VehicleStatus;

    // Date de création.
    @Column({
        name: 'created_at',
        type: 'timestamptz',
        default: () => 'now()',
    })
    createdAt!: Date;

    // Date de dernière modification.
    // Le trigger PostgreSQL la met à jour.
    @Column({
        name: 'updated_at',
        type: 'timestamptz',
        default: () => 'now()',
    })
    updatedAt!: Date;

    // Photos associées à cette voiture (table vehicle_images).
    // Ce n'est PAS une colonne : la propriété est remplie
    // explicitement par le service. La relation est gérée à la
    // main afin d'éviter une importation circulaire entre les
    // entités Vehicle et VehicleImage.
    images?: VehicleImage[];
}
