import {
    Column,
    Entity,
    PrimaryColumn,
} from 'typeorm';

@Entity('customer_profiles')
export class CustomerProfile {
    @PrimaryColumn({
        name: 'user_id',
        type: 'uuid',
    })
    userId!: string;

    @Column({
        name: 'date_of_birth',
        type: 'date',
    })
    dateOfBirth!: string;

    @Column({
        name: 'address_line',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    addressLine!: string | null;

    @Column({
        name: 'city',
        type: 'varchar',
        length: 100,
        nullable: true,
    })
    city!: string | null;

    @Column({
        name: 'postal_code',
        type: 'varchar',
        length: 20,
        nullable: true,
    })
    postalCode!: string | null;

    @Column({
        name: 'country',
        type: 'char',
        length: 2,
        nullable: true,
    })
    country!: string | null;

    // Le permis reste une information obligatoire
    // du profil client.
    @Column({
        name: 'license_number',
        type: 'varchar',
        length: 50,
    })
    licenseNumber!: string;

    @Column({
        name: 'license_country',
        type: 'char',
        length: 2,
    })
    licenseCountry!: string;

    @Column({
        name: 'license_issued_on',
        type: 'date',
    })
    licenseIssuedOn!: string;

    @Column({
        name: 'license_expires_on',
        type: 'date',
    })
    licenseExpiresOn!: string;
}

