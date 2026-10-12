
import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

// Cette entité représente une catégorie de véhicule.
// Exemple : SUV, berline, sportive ou cabriolet.

@Entity('categories')
export class Category {
    // Identifiant généré par PostgreSQL.
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    // Nom de la catégorie.
    @Column({
        type: 'varchar',
    })
    name!: string;

    // Description facultative de la catégorie.
    @Column({
        type: 'text',
        nullable: true,
    })
    description!: string | null;
}
