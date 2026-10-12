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
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import { AccountStatus } from '../users/entities/user.entity.js';
export class AuthService {
    // ==========================================
    // 1. CUSTOMER REGISTRATION
    // ==========================================
    async register(dto) {
        const passwordHash = await argon2.hash(dto.password);
        const user = await this.usersService.createCustomer({
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            passwordHash,
            phone: dto.phone
        });
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt
        };
    }
    // ==========================================
    // 2. USER LOGIN
    // ==========================================
    async login(dto) {
        const user = await this.usersService.findByEmailForAuth(dto.email);
        // Check that the account exists
        // and has a password
        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid email or password');
        }
        // Verify the password using Argon2
        const passwordIsValid = await argon2.verify(user.passwordHash, dto.password);
        if (!passwordIsValid) {
            throw new UnauthorizedException('Invalid email or password');
        }
        // Only active accounts can log in
        if (user.status !== AccountStatus.ACTIVE) {
            throw new UnauthorizedException('Invalid email or password');
        }
        // Generate the JWT access token
        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            role: user.role
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
                role: user.role
            }
        };
    }
    constructor(usersService, jwtService){
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
}
AuthService = _ts_decorate([
    Injectable(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof UsersService === "undefined" ? Object : UsersService,
        typeof JwtService === "undefined" ? Object : JwtService
    ])
], AuthService);

//# sourceMappingURL=auth.service.js.map