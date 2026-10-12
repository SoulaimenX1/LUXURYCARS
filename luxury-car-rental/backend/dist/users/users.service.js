function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for(var i = decorators.length - 1; i >= 0; i--){
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(metadataKey, metadataValue);
    }
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AccountStatus, User, UserRole } from './entities/user.entity.js';
export class UsersService {
    // ==========================================
    // 1. FIND USER BY ID
    // ==========================================
    async findById(id) {
        return this.usersRepository.findOne({
            where: {
                id
            }
        });
    }
    // ==========================================
    // 2. FIND USER BY EMAIL
    // ==========================================
    async findByEmail(email) {
        return this.usersRepository.findOne({
            where: {
                email: email.trim().toLowerCase()
            }
        });
    }
    // ==========================================
    // 3. REGISTER A NEW CUSTOMER
    // ==========================================
    async createCustomer(input) {
        const user = this.usersRepository.create({
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email.trim().toLowerCase(),
            passwordHash: input.passwordHash,
            phone: input.phone ?? null,
            role: UserRole.CUSTOMER,
            status: AccountStatus.ACTIVE
        });
        try {
            return await this.usersRepository.save(user);
        } catch (error) {
            // PostgreSQL unique constraint violation
            if (error instanceof QueryFailedError && error.driverError.code === '23505') {
                throw new ConflictException('An account with this email already exists');
            }
            throw error;
        }
    }
    // ==========================================
    // 4. FIND USER FOR AUTHENTICATION
    // ==========================================
    async findByEmailForAuth(email) {
        return this.usersRepository.createQueryBuilder('user').addSelect('user.passwordHash').where('user.email = :email', {
            email: email.trim().toLowerCase()
        }).getOne();
    }
    // ==========================================
    // 5. UPDATE MY PROFILE
    // ==========================================
    async updateMyProfile(userId, input) {
        const changes = {};
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
            throw new BadRequestException('No profile changes provided');
        }
        // Save changes to PostgreSQL
        const result = await this.usersRepository.update(userId, changes);
        // Check if the user exists
        if (result.affected === 0) {
            throw new NotFoundException('User not found');
        }
        // Retrieve the updated user
        const updatedUser = await this.findById(userId);
        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }
        return updatedUser;
    }
    constructor(usersRepository){
        this.usersRepository = usersRepository;
    }
}
UsersService = _ts_decorate([
    Injectable(),
    _ts_param(0, InjectRepository(User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof Repository === "undefined" ? Object : Repository
    ])
], UsersService);

//# sourceMappingURL=users.service.js.map