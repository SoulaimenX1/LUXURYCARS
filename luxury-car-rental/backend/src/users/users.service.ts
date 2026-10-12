
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
    QueryFailedError,
    Repository,
} from 'typeorm';

import {
    AccountStatus,
    User,
    UserRole,
} from './entities/user.entity.js';

// ==========================================
// DATA REQUIRED TO CREATE A CUSTOMER
// ==========================================

export interface CreateCustomerInput {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    phone?: string;
}

// ==========================================
// DATA ALLOWED FOR PROFILE UPDATES
// ==========================================

export interface UpdateMyProfileInput {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
}

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    // ==========================================
    // 1. FIND USER BY ID
    // ==========================================

    async findById(
        id: string,
    ): Promise<User | null> {
        return this.usersRepository.findOne({
            where: { id },
        });
    }

    // ==========================================
    // 2. FIND USER BY EMAIL
    // ==========================================

    async findByEmail(
        email: string,
    ): Promise<User | null> {
        return this.usersRepository.findOne({
            where: {
                email: email.trim().toLowerCase(),
            },
        });
    }

    // ==========================================
    // 3. REGISTER A NEW CUSTOMER
    // ==========================================

    async createCustomer(
        input: CreateCustomerInput,
    ): Promise<User> {
        const user = this.usersRepository.create({
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email.trim().toLowerCase(),
            passwordHash: input.passwordHash,
            phone: input.phone ?? null,
            role: UserRole.CUSTOMER,
            status: AccountStatus.ACTIVE,
        });

        try {
            return await this.usersRepository.save(user);
        } catch (error) {
            // PostgreSQL unique constraint violation
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string })
                    .code === '23505'
            ) {
                throw new ConflictException(
                    'An account with this email already exists',
                );
            }

            throw error;
        }
    }

    // ==========================================
    // 4. FIND USER FOR AUTHENTICATION
    // ==========================================

    async findByEmailForAuth(
        email: string,
    ): Promise<User | null> {
        return this.usersRepository
            .createQueryBuilder('user')
            .addSelect('user.passwordHash')
            .where('user.email = :email', {
                email: email.trim().toLowerCase(),
            })
            .getOne();
    }

    // ==========================================
    // 5. UPDATE MY PROFILE
    // ==========================================

    async updateMyProfile(
        userId: string,
        input: UpdateMyProfileInput,
    ): Promise<User> {
        const changes: Partial<
            Pick<User, 'firstName' | 'lastName' | 'phone'>
        > = {};

        // Update first name
        if (input.firstName !== undefined) {
            changes.firstName = input.firstName;
        }

        // Update last name
        if (input.lastName !== undefined) {
            changes.lastName = input.lastName;
        }

        // Update phone
        if (input.phone !== undefined) {
            changes.phone = input.phone;
        }

        // Reject empty updates
        if (Object.keys(changes).length === 0) {
            throw new BadRequestException(
                'No profile changes provided',
            );
        }

        // Save changes to PostgreSQL
        const result = await this.usersRepository.update(
            userId,
            changes,
        );

        // Check if the user exists
        if (result.affected === 0) {
            throw new NotFoundException(
                'User not found',
            );
        }

        // Retrieve the updated user
        const updatedUser = await this.findById(
            userId,
        );

        if (!updatedUser) {
            throw new NotFoundException(
                'User not found',
            );
        }

        return updatedUser;
    }
}
