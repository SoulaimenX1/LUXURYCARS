
import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

// Cette entité représente une marque automobile.
// Exemple : Porsche, BMW ou Mercedes-Benz.

@Entity('brands')
export class Brand {
    // Identifiant généré automatiquement par PostgreSQL.
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    // Nom de la marque.
    @Column({
        type: 'varchar',
    })
    name!: string;
}
