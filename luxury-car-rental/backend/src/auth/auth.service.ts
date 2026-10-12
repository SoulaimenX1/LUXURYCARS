
import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';

import { UsersService } from '../users/users.service.js';

import {
    AccountStatus,
} from '../users/entities/user.entity.js';

import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    // ==========================================
    // 1. CUSTOMER REGISTRATION
    // ==========================================

    async register(dto: RegisterDto) {
        const passwordHash = await argon2.hash(
            dto.password,
        );

        const user = await this.usersService.createCustomer({
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            passwordHash,
            phone: dto.phone,
        });

        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
        };
    }

    // ==========================================
    // 2. USER LOGIN
    // ==========================================

    async login(dto: LoginDto) {
        const user =
            await this.usersService.findByEmailForAuth(
                dto.email,
            );

        // Check that the account exists
        // and has a password
        if (!user || !user.passwordHash) {
            throw new UnauthorizedException(
                'Invalid email or password',
            );
        }

        // Verify the password using Argon2
        const passwordIsValid = await argon2.verify(
            user.passwordHash,
            dto.password,
        );

        if (!passwordIsValid) {
            throw new UnauthorizedException(
                'Invalid email or password',
            );
        }

        // Only active accounts can log in
        if (user.status !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException(
                'Invalid email or password',
            );
        }

        // Generate the JWT access token
        const accessToken =
            await this.jwtService.signAsync({
                sub: user.id,
                role: user.role,
            });

        return {
            accessToken,
            tokenType: 'Bearer',
            // 30 days, aligned with the JWT and cookie.
            expiresIn: 30 * 24 * 60 * 60,

            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            },
        };
    }
}
