
import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

// Cette entité représente un modèle automobile.
// Exemple : Porsche 911 ou BMW Série 3.

@Entity('vehicle_models')
export class VehicleModel {
    // Identifiant du modèle.
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    // Identifiant de la marque associée.
    @Column({
        name: 'brand_id',
        type: 'uuid',
    })
    brandId!: string;

    // Identifiant de la catégorie associée.
    @Column({
        name: 'category_id',
        type: 'uuid',
    })
    categoryId!: string;

    // Nom du modèle.
    @Column({
        type: 'varchar',
    })
    name!: string;
}
