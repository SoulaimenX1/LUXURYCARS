
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
    CUSTOMER = 'customer',
    STAFF = 'staff',
    ADMIN = 'admin',
}

export enum AccountStatus {
    INVITED = 'invited',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
    @PrimaryColumn({
        type: 'uuid',
        default: () => 'gen_random_uuid()',
    })
    id!: string;

    @Column({
        type: 'citext',
        unique: true,
    })
    email!: string;

    @Column({
        name: 'password_hash',
        type: 'text',
        nullable: true,
        select: false,
    })
    passwordHash!: string | null;

    @Column({
        type: 'enum',
        enum: UserRole,
        enumName: 'user_role',
        default: UserRole.CUSTOMER,
    })
    role!: UserRole;

    @Column({
        type: 'enum',
        enum: AccountStatus,
        enumName: 'account_status',
        default: AccountStatus.ACTIVE,
    })
    status!: AccountStatus;

    @Column({
        name: 'first_name',
        type: 'varchar',
        length: 100,
    })
    firstName!: string;

    @Column({
        name: 'last_name',
        type: 'varchar',
        length: 100,
    })
    lastName!: string;

    @Column({
        type: 'varchar',
        length: 30,
        nullable: true,
    })
    phone!: string | null;

    @Column({
        name: 'email_verified_at',
        type: 'timestamptz',
        nullable: true,
    })
    emailVerifiedAt!: Date | null;

    @Column({
        name: 'last_login_at',
        type: 'timestamptz',
        nullable: true,
    })
    lastLoginAt!: Date | null;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamptz',
    })
    createdAt!: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'timestamptz',
    })
    updatedAt!: Date;
}
